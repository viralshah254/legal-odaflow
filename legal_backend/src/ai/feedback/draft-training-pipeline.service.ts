import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { TrainingConsentGateService } from './training-consent-gate.service';

/**
 * Jurisdiction strings arrive as "IN", "IN-DL", "in-dl" or empty. Learning is
 * grouped at country level, which is the granularity at which drafting rules
 * actually differ.
 */
export function normalizeCountry(jurisdiction: string | null | undefined): string {
  const value = (jurisdiction ?? '').trim();
  if (!value) return '';
  return value.split(/[-_]/)[0].toUpperCase();
}

interface FeedbackGroup {
  tenantId: string;
  documentKind: string;
  sectionType: string;
  /** Normalised country the feedback came from. "" when the row predates capture. */
  countryCode: string;
  items: Array<{
    id: string;
    rating: string;
    aiGeneratedText: string;
    userEditedText: string | null;
    editRatio: number;
    editCategories: string[];
  }>;
}

/**
 * Nightly pipeline that aggregates DraftSectionFeedback rows into
 * FirmDraftPreference entries used by PromptInjectionService.
 *
 * Grouped by country as well as tenant and section, because what a firm accepts
 * in one jurisdiction says nothing about what a court in another will take.
 *
 * For each (tenant, documentKind, sectionType, country) group:
 *   - Computes acceptance rate
 *   - Picks up to 3 best "accepted" examples
 *   - Distills avoidPatterns, accuracyPatterns, antiExamples, styleNotes
 *   - Merges verification-derived avoid patterns from DraftVerificationOutcome
 *   - Upserts FirmDraftPreference
 *   - Marks processed rows as usedAsTraining = true
 */
@Injectable()
export class DraftTrainingPipelineService {
  private readonly logger = new Logger(DraftTrainingPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmCompletionService,
    private readonly consentGate: TrainingConsentGateService,
  ) {}

  @Cron('0 2 * * *') // Nightly at 02:00 UTC
  async runNightlyCycle(): Promise<void> {
    if (process.env.DISABLE_TRAINING_PIPELINE === '1') return;
    this.logger.log('Draft training pipeline: starting nightly cycle');

    try {
      const groups = await this.loadUnprocessedGroups();
      this.logger.log(`Training pipeline: processing ${groups.length} feedback groups`);

      for (const group of groups) {
        await this.processGroup(group).catch((err: unknown) => {
          this.logger.error(
            `Training pipeline error for ${group.tenantId}/${group.documentKind}/${group.sectionType}: ${String(err)}`,
          );
        });
      }

      this.logger.log('Draft training pipeline: nightly cycle complete');
    } catch (err: unknown) {
      this.logger.error(`Training pipeline nightly cycle failed: ${String(err)}`);
    }
  }

  /** Can be called manually (e.g. from admin endpoint) for a specific tenant. */
  async runForTenant(tenantId: string): Promise<{ groupsProcessed: number }> {
    const groups = await this.loadUnprocessedGroups(tenantId);
    for (const group of groups) {
      await this.processGroup(group).catch(() => {});
    }
    return { groupsProcessed: groups.length };
  }

  private async loadUnprocessedGroups(tenantId?: string): Promise<FeedbackGroup[]> {
    // Learned preferences are re-injected into prompts, so only tenants that
    // consented to prompt improvement may contribute.
    const consented = await this.consentGate.consentedTenantIds('promptImprove');
    if (consented.length === 0) return [];
    if (tenantId && !consented.includes(tenantId)) return [];

    const rows = await (this.prisma as any).draftSectionFeedback.findMany({
      where: {
        usedAsTraining: false,
        tenantId: tenantId ? tenantId : { in: consented },
      },
      select: {
        id: true,
        tenantId: true,
        documentKind: true,
        sectionType: true,
        jurisdiction: true,
        rating: true,
        aiGeneratedText: true,
        userEditedText: true,
        editRatio: true,
        editCategories: true,
      },
      orderBy: { createdAt: 'asc' as const },
      take: 5000,
    });

    const groupMap = new Map<string, FeedbackGroup>();
    for (const row of rows) {
      const countryCode = normalizeCountry(row.jurisdiction);
      const key = `${row.tenantId}||${row.documentKind}||${row.sectionType}||${countryCode}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          tenantId: row.tenantId,
          documentKind: row.documentKind,
          sectionType: row.sectionType,
          countryCode,
          items: [],
        });
      }
      groupMap.get(key)!.items.push(row);
    }

    return Array.from(groupMap.values());
  }

  private async processGroup(group: FeedbackGroup): Promise<void> {
    const { tenantId, documentKind, sectionType, countryCode, items } = group;

    const total = items.length;
    const accepted = items.filter((i) => i.rating === 'accepted' || i.rating === 'minor_edit');
    const rejected = items.filter((i) => i.rating === 'major_edit' || i.rating === 'rejected');
    const acceptanceRate = accepted.length / Math.max(total, 1);

    const exampleTexts = accepted
      .filter((i) => i.editRatio <= 0.15 || i.rating === 'accepted')
      .sort((a, b) => a.editRatio - b.editRatio)
      .slice(0, 3)
      .map((i) => (i.userEditedText && i.editRatio > 0.01 ? i.userEditedText : i.aiGeneratedText));

    // Accuracy patterns from edit categories
    const categoryCounts: Record<string, number> = {};
    for (const item of rejected) {
      for (const cat of item.editCategories ?? []) {
        categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
      }
    }
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    const accuracyPatterns = this.buildAccuracyPatterns(topCategories, rejected.length);

    // Anti-examples: short snippets of rejected AI text
    const antiExamples = rejected
      .filter((i) => i.aiGeneratedText && i.aiGeneratedText.length > 40)
      .slice(0, 3)
      .map((i) => i.aiGeneratedText.slice(0, 280));

    let avoidPatterns: string[] = topCategories;
    let styleNotes: string | null = null;

    if (rejected.length >= 3) {
      const distilled = await this.distilPatterns(rejected, sectionType).catch(() => null);
      if (distilled) {
        avoidPatterns = distilled.avoidPatterns;
        styleNotes = distilled.styleNotes;
      }
    }

    // Merge verification-derived avoid patterns
    const verificationAvoid = await this.loadVerificationAvoidPatterns(
      tenantId,
      documentKind,
      countryCode,
    );
    avoidPatterns = [...new Set([...avoidPatterns, ...verificationAvoid])].slice(0, 10);

    const key = {
      tenantId_documentKind_sectionType_countryCode: {
        tenantId,
        documentKind,
        sectionType,
        countryCode,
      },
    };
    const existing = await (this.prisma as any).firmDraftPreference.findUnique({
      where: key,
      select: { version: true, sampleCount: true, exampleTexts: true },
    });

    await (this.prisma as any).firmDraftPreference.upsert({
      where: key,
      create: {
        tenantId,
        documentKind,
        sectionType,
        countryCode,
        exampleTexts: exampleTexts.length > 0 ? exampleTexts : [],
        avoidPatterns,
        accuracyPatterns,
        antiExamples,
        styleNotes,
        acceptanceRate,
        sampleCount: total,
        version: 1,
      },
      update: {
        exampleTexts: exampleTexts.length > 0 ? exampleTexts : (existing?.exampleTexts ?? []),
        avoidPatterns,
        accuracyPatterns,
        antiExamples,
        styleNotes,
        acceptanceRate,
        sampleCount: (existing?.sampleCount ?? 0) + total,
        version: (existing?.version ?? 0) + 1,
      },
    });

    const ids = items.map((i) => i.id);
    await (this.prisma as any).draftSectionFeedback.updateMany({
      where: { id: { in: ids } },
      data: { usedAsTraining: true },
    });

    // Mark consumed verification outcomes for this tenant/kind
    await (this.prisma as any).draftVerificationOutcome.updateMany({
      where: {
        tenantId,
        documentKind,
        usedAsTraining: false,
        ...(countryCode ? { jurisdiction: { startsWith: countryCode } } : {}),
      },
      data: { usedAsTraining: true },
    }).catch(() => {});

    this.logger.log(
      `Processed ${total} feedback rows for ${tenantId}/${documentKind}/${sectionType}/${countryCode || 'any'} (acceptance: ${(acceptanceRate * 100).toFixed(0)}%)`,
    );
  }

  private buildAccuracyPatterns(categories: string[], rejectedCount: number): string[] {
    const patterns: string[] = [];
    const map: Record<string, string> = {
      wrong_law: 'Never cite a statute or case unless it appears in the retrieved authority list for this matter.',
      missing_citation: 'Every legal proposition in this section must cite a verified authority from the evidence pack.',
      factual_error: 'Do not invent facts; only use facts present in the intake / case details.',
      poor_structure: 'Follow the court pleading structure for this document kind strictly.',
      style: 'Match the firm preferred register and tone for this section.',
    };
    for (const cat of categories) {
      if (map[cat]) patterns.push(map[cat]);
    }
    if (rejectedCount >= 5 && patterns.length === 0) {
      patterns.push('Prior drafts of this section were frequently edited — prefer conservative, citation-grounded prose.');
    }
    return patterns.slice(0, 5);
  }

  private async loadVerificationAvoidPatterns(
    tenantId: string,
    documentKind: string,
    countryCode: string,
  ): Promise<string[]> {
    const rows = await (this.prisma as any).draftVerificationOutcome.findMany({
      where: {
        tenantId,
        documentKind,
        usedAsTraining: false,
        // Legacy rows carry no jurisdiction; only a country-tagged group may claim them.
        ...(countryCode ? { jurisdiction: { startsWith: countryCode } } : {}),
      },
      select: { strippedCitations: true, claimFailures: true, findings: true },
      take: 100,
    }).catch(() => []);

    const patterns: string[] = [];
    for (const row of rows) {
      const stripped = Array.isArray(row.strippedCitations) ? row.strippedCitations : [];
      for (const s of stripped.slice(0, 3)) {
        const original = typeof s === 'object' && s?.original ? String(s.original) : null;
        if (original) {
          patterns.push(`Do not cite unverified authority: ${original.slice(0, 80)}`);
        }
      }
      const failures = Array.isArray(row.claimFailures) ? row.claimFailures : [];
      for (const f of failures.slice(0, 2)) {
        const type = typeof f === 'object' && f?.type ? String(f.type) : null;
        if (type) {
          patterns.push(`Strengthen support for ${type} propositions with retrieved passages.`);
        }
      }
    }
    return [...new Set(patterns)].slice(0, 5);
  }

  private async distilPatterns(
    rejectedItems: FeedbackGroup['items'],
    sectionType: string,
  ): Promise<{ avoidPatterns: string[]; styleNotes: string } | null> {
    const samples = rejectedItems
      .slice(0, 6)
      .map(
        (item, idx) =>
          `SAMPLE ${idx + 1} (rating: ${item.rating}, categories: ${item.editCategories.join(', ')}):\n` +
          `AI VERSION:\n${item.aiGeneratedText.slice(0, 400)}\n` +
          (item.userEditedText ? `USER CORRECTION:\n${item.userEditedText.slice(0, 400)}` : ''),
      )
      .join('\n\n---\n\n');

    const prompt = `You are analysing lawyer edits to AI-generated legal document sections of type "${sectionType}".

The following samples show AI-generated text that lawyers rejected or heavily edited, along with their corrections.

${samples}

Based on these samples, respond with a JSON object with exactly two keys:
- "avoidPatterns": array of 3–6 short phrases describing what to avoid in this section type
- "styleNotes": 1–2 sentences describing the preferred writing style for this section

Respond with ONLY valid JSON, no markdown, no explanation.`;

    const result = await this.llm.complete({
      modelName: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 400,
      temperature: 0.1,
    });

    try {
      const parsed = JSON.parse(result.content.trim());
      return {
        avoidPatterns: Array.isArray(parsed.avoidPatterns) ? parsed.avoidPatterns.slice(0, 6) : [],
        styleNotes: typeof parsed.styleNotes === 'string' ? parsed.styleNotes : '',
      };
    } catch {
      return null;
    }
  }
}
