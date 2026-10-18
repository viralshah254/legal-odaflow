import { Injectable, Logger } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { findRemap, findStatuteById, resolveAcronym } from '@/legal-search/statute-registry';
import { extractSectionRefs } from './similar-cases.service';
import type { SimilarCase } from './similar-cases.types';
import type { SectionChecksAudit, SectionCheckEntry } from './similar-cases.types';

/**
 * Detect if the answer cites only BNSS §480 when the forum is Sessions/HC,
 * which should also cite §483. Returns a warning if the correction cannot be
 * confirmed via bare-act lookup (so the caller can surface a UI warning).
 */
function detectBailForumMismatch(
  outputMarkdown: string,
  countryCode: string,
): { hasMismatch: boolean; warning: string } | null {
  if (countryCode.toUpperCase() !== 'IN') return null;

  const cites480 = /bnss\s*§?\s*480|section\s*480\s+bnss|bnss.*s\.480/i.test(outputMarkdown);
  const cites483 = /bnss\s*§?\s*483|section\s*483\s+bnss|bnss.*s\.483/i.test(outputMarkdown);

  const isSessionsOrHC = /sessions court|court of sessions|high court|successive bail|post.?rejection|bail was refused|bail.*dismissed/i.test(outputMarkdown);

  if (cites480 && !cites483 && isSessionsOrHC) {
    return {
      hasMismatch: true,
      warning:
        'This research cites BNSS §480 (Magistrate-level bail provision) but the context appears to be a Sessions Court or High Court application. ' +
        'Sessions/HC applications should invoke BNSS §483 (Special Powers — replaces CrPC §439) as the primary provision, with §480 as general framework context. ' +
        'Verify BNSS §483 from the bare act before filing.',
    };
  }
  return null;
}

const INDIA_ACT_ID_MAP: Record<string, string> = {
  BNSS: 'bnss',
  BNS: 'bns',
  BSA: 'bsa',
  IPC: 'ipc',
  CRPC: 'crpc',
  IEA: 'iea',
  'NI ACT': 'ni_act',
  NDPS: 'ndps',
  PMLA: 'pmla',
  POCSO: 'pocso',
};

/**
 * Parse a section ref string like "NI ACT s.138" → { actId: 'ni_act', section: '138' }.
 * Falls back to the statute registry so non-India acts resolve too.
 */
function parseSectionRef(
  ref: string,
  countryCode?: string,
): { actId: string; section: string } | null {
  const m = ref.match(/^(.+?)\s+s\.(\S+)$/i);
  if (!m) return null;
  const actRaw = m[1].trim().toUpperCase();
  const section = m[2].trim().toUpperCase();

  const mapped = INDIA_ACT_ID_MAP[actRaw];
  if (mapped) return { actId: mapped, section };

  const statute = resolveAcronym(actRaw, countryCode) ?? resolveAcronym(actRaw);
  if (statute) return { actId: statute.id, section };

  return null;
}

function formatSectionRef(input: { actId: string; section: string }): string {
  if (input.actId === 'ni_act') return `NI ACT s.${input.section}`;
  const statute = findStatuteById(input.actId);
  const act = statute?.shortName?.toUpperCase() ?? input.actId.toUpperCase();
  return `${act} s.${input.section}`;
}

function normalizeLegacyRef(ref: string, countryCode: string): string {
  const parsed = parseSectionRef(ref, countryCode);
  if (!parsed || countryCode.toUpperCase() !== 'IN') return ref;
  const remap = findRemap('IN', parsed.actId, parsed.section);
  if (!remap || remap.to.actId === 'unchanged' || !remap.to.section) return ref;
  return formatSectionRef({ actId: remap.to.actId, section: remap.to.section });
}

/**
 * Detects statute/section mismatches by comparing the AI answer's cited sections
 * against sections appearing in similar case law, then confirms any corrections
 * via primary-law lookup before patching the answer.
 */
@Injectable()
export class SectionMismatchService {
  private readonly logger = new Logger(SectionMismatchService.name);

  constructor(private readonly bareActLookup: BareActLookupService) {}

  async checkAndCorrect(input: {
    outputMarkdown: string;
    similarCases: SimilarCase[];
    countryCode: string;
  }): Promise<{ markdown: string; audit: SectionChecksAudit }> {
    const { outputMarkdown, similarCases, countryCode } = input;

    // Extract sections the answer currently cites
    const answerSections = extractSectionRefs(outputMarkdown, countryCode).map((s) =>
      normalizeLegacyRef(s, countryCode),
    );

    // Extract sections from similar cases (aggregated frequency map)
    const caseFrequency = new Map<string, number>();
    for (const c of similarCases) {
      for (const s of c.relevantSections) {
        const normalized = normalizeLegacyRef(s, countryCode);
        caseFrequency.set(normalized, (caseFrequency.get(normalized) ?? 0) + 1);
      }
    }

    // Find sections that appear in ≥2 similar cases but NOT in the answer
    const MIN_CASE_FREQUENCY = 2;
    const caseSuggested = [...caseFrequency.entries()]
      .filter(([, count]) => count >= MIN_CASE_FREQUENCY)
      .map(([sec]) => sec);

    const entries: SectionCheckEntry[] = [];
    let correctedMarkdown = outputMarkdown;

    for (const answerSec of answerSections) {
      const parsed = parseSectionRef(answerSec, countryCode);
      if (!parsed) continue;

      // Check if similar cases suggest a meaningfully different section for the same act
      const sameActSuggestions = caseSuggested.filter((s) => {
        const p = parseSectionRef(s, countryCode);
        return p && p.actId === parsed.actId && p.section !== parsed.section;
      });

      if (sameActSuggestions.length === 0) continue;

      const warnings: string[] = [];
      const confirmedSections: string[] = [];
      let corrected = false;

      // Try to confirm each suggestion via primary-law lookup
      for (const suggested of sameActSuggestions) {
        const sugParsed = parseSectionRef(suggested, countryCode);
        if (!sugParsed) continue;

        try {
          const lookup = await this.bareActLookup.lookupExactSection(
            sugParsed.actId,
            sugParsed.section,
            countryCode,
          );

          if (lookup.found) {
            confirmedSections.push(suggested);

            // Replace in markdown if the original section appears verbatim
            const escapedAct = parsed.actId.toUpperCase().replace(/_/g, ' ');
            const replaceRegex = new RegExp(
              `\\b(${escapedAct})\\s*(?:s\\.?|section\\s*)?${parsed.section}\\b`,
              'gi',
            );
            if (replaceRegex.test(correctedMarkdown)) {
              correctedMarkdown = correctedMarkdown.replace(
                replaceRegex,
                `$1 s.${sugParsed.section}`,
              );
              corrected = true;
            }
          } else {
            warnings.push(
              `Similar cases suggest ${suggested} but primary-law corpus could not confirm it. ` +
                `Original section ${answerSec} retained. Lawyer review recommended.`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Primary-law lookup failed for ${suggested}: ${err instanceof Error ? err.message : String(err)}`,
          );
          warnings.push(`Could not confirm ${suggested} via primary-law lookup.`);
        }
      }

      entries.push({
        originalSection: answerSec,
        caseSuggestedSections: sameActSuggestions,
        confirmedSections,
        warnings,
        corrected,
      });
    }

    // Always run bail-forum mismatch check regardless of similar-cases frequency
    const bailMismatch = detectBailForumMismatch(correctedMarkdown, countryCode);
    if (bailMismatch?.hasMismatch) {
      entries.push({
        originalSection: 'BNSS s.480',
        caseSuggestedSections: ['BNSS s.483'],
        confirmedSections: [],
        warnings: [bailMismatch.warning],
        corrected: false,
      });
    }

    const audit: SectionChecksAudit = {
      entries,
      anyCorrections: entries.some((e) => e.corrected),
      anyUnconfirmedMismatches: entries.some((e) => e.warnings.length > 0 && !e.corrected),
    };

    // Append a compact note to the answer if corrections were made
    if (audit.anyCorrections) {
      const note = entries
        .filter((e) => e.corrected)
        .map(
          (e) =>
            `> *Section cross-check: ${e.originalSection} replaced with ${e.confirmedSections.join(', ')} based on ${similarCases.length} similar case(s) + primary-law confirmation.*`,
        )
        .join('\n');
      correctedMarkdown += `\n\n${note}`;
    }

    // Append bail-forum warning if not already corrected automatically
    if (bailMismatch?.hasMismatch) {
      correctedMarkdown +=
        `\n\n> ⚠️ **Section cross-check notice:** ${bailMismatch.warning}`;
    }

    return { markdown: correctedMarkdown, audit };
  }
}
