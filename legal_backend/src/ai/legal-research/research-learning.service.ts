import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrainingConsentGateService } from '@/ai/feedback/training-consent-gate.service';
import { PrismaService } from '@/prisma/prisma.service';

export interface RecordResearchOutcomeInput {
  tenantId?: string;
  countryCode: string;
  legalDomain?: string;
  taskKind?: string;
  verificationStatus: string;
  /** Propositions the verifier could not tie to a retrieved source. */
  unsupportedClaims?: string[];
  /** Citations removed or marked as an authority gap during sanitisation. */
  strippedCitations?: string[];
  /** Domain-completeness requirements still unmet when the run finished. */
  unmetRequirements?: string[];
  /** Purposes of the retrieval hops the agentic loop needed. */
  hopPurposes?: string[];
  authoritiesUsed?: number;
}

export interface ResearchPreference {
  guidance: string[];
  avoidPatterns: string[];
  retrievalHints: string[];
  sampleCount: number;
}

interface CacheEntry {
  block: string | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
/** Below this, a pattern is noise rather than a habit worth correcting. */
const MIN_OCCURRENCES = 3;
const MAX_ITEMS_PER_LIST = 6;

/**
 * The research counterpart of the drafting training pipeline.
 *
 * Research runs produce verdicts nobody ever reads back: an unsupported claim
 * here, a citation stripped there, a checklist item that never got covered.
 * Recording those and distilling them per (country, legal domain) lets the next
 * run start from what the last one got wrong, which is the only way the system
 * gets better without a human writing new prompts every week.
 */
@Injectable()
export class ResearchLearningService {
  private readonly logger = new Logger(ResearchLearningService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Optional() private readonly prisma: PrismaService | null,
    @Optional() private readonly consentGate?: TrainingConsentGateService,
  ) {}

  /** Persist one run's verification signals. Never throws into the caller. */
  async record(input: RecordResearchOutcomeInput): Promise<void> {
    if (process.env.DISABLE_TRAINING_PIPELINE === '1') return;
    if (!this.prisma) return;
    const countryCode = normalizeCode(input.countryCode);
    if (!countryCode) return;

    try {
      await (this.prisma as any).researchVerificationOutcome.create({
        data: {
          tenantId: input.tenantId ?? null,
          countryCode,
          legalDomain: (input.legalDomain ?? '').toUpperCase(),
          taskKind: input.taskKind ?? '',
          verificationStatus: input.verificationStatus,
          unsupportedClaims: (input.unsupportedClaims ?? []).slice(0, 20).map(truncate),
          strippedCitations: (input.strippedCitations ?? []).slice(0, 20).map(truncate),
          unmetRequirements: (input.unmetRequirements ?? []).slice(0, 20),
          hopPurposes: input.hopPurposes ?? [],
          authoritiesUsed: input.authoritiesUsed ?? 0,
        },
      });
    } catch (err) {
      this.logger.warn(`Research outcome not recorded: ${message(err)}`);
    }
  }

  /**
   * Distil unprocessed signals into per-(country, domain) preferences.
   * Runs on a schedule; safe to call repeatedly.
   */
  @Cron('0 3 * * *') // Nightly at 03:00 UTC, after the drafting pipeline.
  async distil(): Promise<number> {
    if (process.env.DISABLE_TRAINING_PIPELINE === '1') return 0;
    if (!this.prisma) return 0;

    // Fail closed: without a consent gate we cannot establish that anyone agreed
    // to have their research text shape future prompts, so we learn from nobody.
    if (!this.consentGate) {
      this.logger.warn('Research distillation skipped — no training consent gate available.');
      return 0;
    }
    const consentedTenantIds = await this.consentGate.consentedTenantIds('promptImprove');
    if (consentedTenantIds.length === 0) return 0;

    const rows: Array<{
      id: string;
      countryCode: string;
      legalDomain: string;
      unsupportedClaims: unknown;
      strippedCitations: unknown;
      unmetRequirements: string[];
      hopPurposes: string[];
    }> = await (this.prisma as any).researchVerificationOutcome
      .findMany({
        where: { usedAsTraining: false, tenantId: { in: consentedTenantIds } },
        orderBy: { createdAt: 'asc' },
        take: 2000,
      })
      .catch(() => []);

    if (rows.length === 0) return 0;

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${row.countryCode}||${row.legalDomain ?? ''}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    let updated = 0;
    // A group whose patterns are still below the frequency threshold has not been
    // consumed — retiring it here would mean those signals can never reach the
    // threshold, and a real habit would stay invisible forever.
    const consumedIds: string[] = [];
    for (const [key, group] of groups) {
      const [countryCode, legalDomain] = key.split('||');
      const preference = this.aggregate(group);
      if (
        preference.guidance.length === 0 &&
        preference.avoidPatterns.length === 0 &&
        preference.retrievalHints.length === 0
      ) {
        continue;
      }
      await this.upsert(countryCode, legalDomain, preference, group.length);
      consumedIds.push(...group.map((row) => row.id));
      updated++;
    }

    if (consumedIds.length > 0) {
      await (this.prisma as any).researchVerificationOutcome
        .updateMany({
          where: { id: { in: consumedIds } },
          data: { usedAsTraining: true },
        })
        .catch(() => undefined);
    }

    this.cache.clear();
    this.logger.log(
      `Distilled ${consumedIds.length} of ${rows.length} research signals into ${updated} preferences`,
    );
    return updated;
  }

  /**
   * Prompt block to append to the research system prompt. Domain-specific
   * guidance is layered on top of country-wide guidance.
   */
  async buildPromptBlock(countryCode: string, legalDomain?: string): Promise<string | null> {
    if (process.env.DISABLE_TRAINING_PIPELINE === '1') return null;
    if (!this.prisma) return null;
    const country = normalizeCode(countryCode);
    if (!country) return null;
    const domain = (legalDomain ?? '').toUpperCase();

    const cacheKey = `${country}||${domain}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.block;

    const [countryWide, domainSpecific] = await Promise.all([
      this.load(country, ''),
      domain ? this.load(country, domain) : Promise.resolve(null),
    ]);

    const merged: ResearchPreference = {
      guidance: dedupe([...(countryWide?.guidance ?? []), ...(domainSpecific?.guidance ?? [])]),
      avoidPatterns: dedupe([
        ...(countryWide?.avoidPatterns ?? []),
        ...(domainSpecific?.avoidPatterns ?? []),
      ]),
      retrievalHints: dedupe([
        ...(countryWide?.retrievalHints ?? []),
        ...(domainSpecific?.retrievalHints ?? []),
      ]),
      sampleCount: (countryWide?.sampleCount ?? 0) + (domainSpecific?.sampleCount ?? 0),
    };

    const block = this.format(merged, country, domain);
    this.cache.set(cacheKey, { block, expiresAt: Date.now() + CACHE_TTL_MS });
    return block;
  }

  private async load(countryCode: string, legalDomain: string): Promise<ResearchPreference | null> {
    return (this.prisma as any).researchPromptPreference
      .findUnique({
        where: { countryCode_legalDomain: { countryCode, legalDomain } },
        select: {
          guidance: true,
          avoidPatterns: true,
          retrievalHints: true,
          sampleCount: true,
        },
      })
      .catch(() => null);
  }

  private async upsert(
    countryCode: string,
    legalDomain: string,
    preference: ResearchPreference,
    newSamples: number,
  ): Promise<void> {
    const existing = await this.load(countryCode, legalDomain);
    const data = {
      guidance: dedupe([...(existing?.guidance ?? []), ...preference.guidance]).slice(
        0,
        MAX_ITEMS_PER_LIST,
      ),
      avoidPatterns: dedupe([
        ...(existing?.avoidPatterns ?? []),
        ...preference.avoidPatterns,
      ]).slice(0, MAX_ITEMS_PER_LIST),
      retrievalHints: dedupe([
        ...(existing?.retrievalHints ?? []),
        ...preference.retrievalHints,
      ]).slice(0, MAX_ITEMS_PER_LIST),
      sampleCount: (existing?.sampleCount ?? 0) + newSamples,
    };

    await (this.prisma as any).researchPromptPreference
      .upsert({
        where: { countryCode_legalDomain: { countryCode, legalDomain } },
        create: { countryCode, legalDomain, ...data },
        update: { ...data, version: { increment: 1 } },
      })
      .catch((err: unknown) =>
        this.logger.warn(`Research preference upsert failed for ${countryCode}: ${message(err)}`),
      );
  }

  /**
   * Turn repeated failures into instructions. A single bad run says nothing;
   * the same failure three times is a habit the prompt should name explicitly.
   */
  private aggregate(rows: Array<Record<string, unknown>>): ResearchPreference {
    const unmet = new Map<string, number>();
    const stripped = new Map<string, number>();
    const hops = new Map<string, number>();
    let unsupportedRuns = 0;

    for (const row of rows) {
      for (const requirement of asStringArray(row.unmetRequirements)) {
        unmet.set(requirement, (unmet.get(requirement) ?? 0) + 1);
      }
      for (const purpose of asStringArray(row.hopPurposes)) {
        hops.set(purpose, (hops.get(purpose) ?? 0) + 1);
      }
      const citations = asStringArray(row.strippedCitations);
      for (const citation of citations) {
        const family = citationFamily(citation);
        if (family) stripped.set(family, (stripped.get(family) ?? 0) + 1);
      }
      if (asStringArray(row.unsupportedClaims).length > 0) unsupportedRuns++;
    }

    const guidance: string[] = [];
    const avoidPatterns: string[] = [];
    const retrievalHints: string[] = [];

    for (const [requirement, count] of frequent(unmet)) {
      const safe = sanitizeForPrompt(requirement);
      if (!safe) continue;
      guidance.push(
        `Prior runs left "${safe}" unanswered ${count}x — address it explicitly or state why it does not arise.`,
      );
    }

    for (const [family, count] of frequent(stripped)) {
      const safe = sanitizeForPrompt(family);
      if (!safe) continue;
      avoidPatterns.push(
        `Citations of the form "${safe}" were unverifiable and removed ${count}x — only cite this reporter when you have the retrieved source in hand.`,
      );
    }

    if (unsupportedRuns >= MIN_OCCURRENCES) {
      avoidPatterns.push(
        `${unsupportedRuns} prior runs asserted propositions no retrieved source supported — every legal proposition must quote a retrieved passage or be marked as an authority gap.`,
      );
    }

    for (const [purpose, count] of frequent(hops)) {
      const safe = sanitizeForPrompt(purpose);
      if (!safe) continue;
      retrievalHints.push(
        `"${safe}" retrieval was needed as a follow-up hop ${count}x — search for it in the first retrieval pass.`,
      );
    }

    return { guidance, avoidPatterns, retrievalHints, sampleCount: rows.length };
  }

  private format(
    preference: ResearchPreference,
    countryCode: string,
    legalDomain: string,
  ): string | null {
    if (
      preference.guidance.length === 0 &&
      preference.avoidPatterns.length === 0 &&
      preference.retrievalHints.length === 0
    ) {
      return null;
    }

    const scope = legalDomain ? `${countryCode} · ${legalDomain}` : countryCode;
    const parts = [
      `\n## LEARNED RESEARCH CORRECTIONS — ${scope}`,
      `(Distilled from ${preference.sampleCount} verified runs in this jurisdiction.)`,
    ];
    if (preference.guidance.length > 0) {
      parts.push(preference.guidance.map((g) => `- ${g}`).join('\n'));
    }
    if (preference.avoidPatterns.length > 0) {
      parts.push('AVOID:', preference.avoidPatterns.map((a) => `- ${a}`).join('\n'));
    }
    if (preference.retrievalHints.length > 0) {
      parts.push('RETRIEVE EARLY:', preference.retrievalHints.map((r) => `- ${r}`).join('\n'));
    }
    return parts.join('\n');
  }
}

function frequent(counts: Map<string, number>): Array<[string, number]> {
  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_OCCURRENCES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ITEMS_PER_LIST);
}

/**
 * Collapse a citation to its reporter/series so repeated fabrications of the
 * same shape aggregate instead of each counting once.
 */
function citationFamily(citation: string): string | null {
  const match = citation.match(/\b((?:[A-Z][A-Za-z.]*\s+){0,3}(?:[A-Z]{2,6}|[A-Z][a-z]+\.?))\b/);
  const family = (match?.[1] ?? '').replace(/\d+/g, '').trim();
  return family.length >= 2 ? family : null;
}

/**
 * These strings originate in user queries and model output, and this loop feeds
 * them straight back into a system prompt. Anything that could end a block, open
 * a new instruction, or impersonate the operator is removed rather than escaped:
 * a learned hint is only ever a short noun phrase, so a strict character
 * whitelist costs nothing and closes the injection path completely.
 */
export function sanitizeForPrompt(value: string): string | null {
  const flattened = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cleaned = flattened
    .replace(/[^A-Za-z0-9 _.,;:()\-/&']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .trim();
  if (cleaned.length < 2) return null;
  if (!/[A-Za-z]/.test(cleaned)) return null;
  if (INSTRUCTION_LIKE.test(cleaned)) return null;
  return cleaned;
}

/**
 * A learned correction is a description of past failure, never a command. If a
 * phrase reads like an instruction to the model, it did not come from our
 * pipeline and must not be replayed as one.
 */
const INSTRUCTION_LIKE =
  /\b(ignore|disregard|override|forget)\b.{0,30}\b(previous|prior|above|earlier|instruction|rule|prompt)\b|\b(system|assistant|developer|user)\s*(prompt|message|role)\b|\byou\s+(must|should|are)\b/i;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function normalizeCode(value: string | null | undefined): string {
  return (value ?? '').trim().split(/[-_]/)[0].toUpperCase();
}

function truncate(value: string): string {
  return value.slice(0, 300);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
