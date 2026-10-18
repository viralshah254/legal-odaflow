import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SectionFinderService } from '@/legal-search/india-section-finder/section-finder.service';
import { UsSectionFinderService } from '@/legal-search/us-section-finder/us-section-finder.service';
import { KeSectionFinderService } from '@/legal-search/ke-section-finder/ke-section-finder.service';
import {
  SectionFinderAiFallbackService,
  type SectionFinderAiSuggestion,
} from '@/legal-search/section-finder-ai-fallback.service';
import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';
import type { PinnedSection } from '@/ai/drafting/draft-pinned-authorities';

export type ResolveAndPinStatus = 'found' | 'resolved_ingest' | 'not_found' | 'invalid';

export interface ResolveAndPinResult {
  status: ResolveAndPinStatus;
  pin?: PinnedSection;
  matchSource?: string;
  message?: string;
  addedToSectionFinder?: boolean;
  /** Lower-model AI suggestions — not Verified until corpus/connector confirms. */
  aiSuggestions?: SectionFinderAiSuggestion[];
  aiSuggestionModel?: string;
}

interface PinableSectionEntry {
  id: string;
  legacyActId: string;
  legacyActShort: string;
  legacySection: string;
  legacyTitle: string;
  newActId: string;
  newActShort: string;
  newSection: string;
  newTitle: string;
  sectionText?: string;
  legalAuthorityId?: string;
  matchSource?: string;
}

function entryToPin(
  entry: PinableSectionEntry,
  source: PinnedSection['source'],
): PinnedSection {
  const actId = (entry.newActId && entry.newActId !== 'unchanged'
    ? entry.newActId
    : entry.legacyActId
  ).toLowerCase();
  const section = entry.newSection || entry.legacySection;
  const actShort =
    entry.newActId && entry.newActId !== 'unchanged'
      ? entry.newActShort || entry.newActId.toUpperCase()
      : entry.legacyActShort || entry.legacyActId.toUpperCase();
  const title = entry.newTitle || entry.legacyTitle;
  return {
    actId,
    section,
    label: `${actShort} §${section}${title ? ` — ${title}` : ''}`,
    authorityId: entry.legalAuthorityId || entry.id,
    textExcerpt: (entry.sectionText ?? '').slice(0, 600) || undefined,
    source,
  };
}

@Injectable()
export class SectionFinderResolveService {
  private readonly logger = new Logger(SectionFinderResolveService.name);

  constructor(
    private readonly sectionFinder: SectionFinderService,
    private readonly usSectionFinder: UsSectionFinderService,
    private readonly keSectionFinder: KeSectionFinderService,
    private readonly aiFallback: SectionFinderAiFallbackService,
  ) {}

  /**
   * Resolve a section query for drafting pins.
   * Uses jurisdiction-specific Section Finder (incl. on-demand ingest).
   */
  async resolveAndPin(input: {
    q: string;
    countryCode?: string;
    actId?: string;
    section?: string;
    allowSoftPin?: boolean;
  }): Promise<ResolveAndPinResult> {
    const q = (input.q ?? '').trim();
    if (q.length < 2 && !(input.actId && input.section)) {
      return { status: 'invalid', message: 'Provide a section query (e.g. "BNSS 480").' };
    }

    const code = (input.countryCode ?? 'IN').toUpperCase();
    if (!['IN', 'US', 'KE'].includes(code)) {
      return {
        status: 'invalid',
        message: `Section Finder resolve-and-pin is not available for countryCode=${code}.`,
      };
    }

    try {
      const queryText = q || `${input.actId ?? ''} ${input.section ?? ''}`.trim();
      const result =
        code === 'US'
          ? await this.usSectionFinder.find({ q: queryText, countryCode: 'US' })
          : code === 'KE'
            ? await this.keSectionFinder.find({
                q: queryText,
                countryCode: 'KE',
                actId: input.actId,
                section: input.section,
              })
            : await this.sectionFinder.find({
                q: queryText,
                countryCode: 'IN',
                actId: input.actId,
                section: input.section,
              });

      const match = result.matches?.[0] ?? null;

      if (!match) {
        const nearMisses = (result.matches ?? [])
          .slice(0, 5)
          .map((m) => ({
            label:
              `${(m as { newActShort?: string; legacyActShort?: string }).newActShort ||
                (m as { legacyActShort?: string }).legacyActShort ||
                ''} §${
                (m as { newSection?: string; legacySection?: string }).newSection ||
                (m as { legacySection?: string }).legacySection ||
                ''
              }`.trim(),
          }))
          .filter((m) => m.label.length > 1);
        const ai = await this.aiFallback.suggest({
          query: queryText,
          countryCode: code,
          nearMisses,
        });

        if (input.allowSoftPin) {
          return {
            status: 'not_found',
            pin: {
              section: input.section?.trim() || q,
              actId: input.actId?.trim(),
              label: q || `${input.actId ?? ''} §${input.section ?? ''}`.trim(),
              source: 'user_unresolved',
            },
            message:
              'Section not found in Section Finder. Soft-pinned as unverified — AI suggestions attached (not verified).',
            addedToSectionFinder: false,
            aiSuggestions: ai.suggestions,
            aiSuggestionModel: ai.modelName,
          };
        }
        return {
          status: 'not_found',
          message:
            ai.suggestions.length > 0
              ? 'Section not found in index. AI suggestions attached — confirm before treating as Verified.'
              : 'Section not found. Confirm the act and section number, or soft-pin as unverified.',
          addedToSectionFinder: false,
          aiSuggestions: ai.suggestions,
          aiSuggestionModel: ai.modelName,
        };
      }

      const fromNetwork = match.matchSource === 'network' || match.matchSource === 'ai';
      const source: PinnedSection['source'] = fromNetwork
        ? 'resolved_ingest'
        : 'section_finder';

      return {
        status: fromNetwork ? 'resolved_ingest' : 'found',
        pin: entryToPin(match as PinableSectionEntry, source),
        matchSource: match.matchSource,
        addedToSectionFinder: fromNetwork || match.matchSource === 'corpus',
        message: fromNetwork
          ? 'Resolved via ingest and available in Section Finder for future searches.'
          : 'Found in Section Finder.',
      };
    } catch (err) {
      if (err instanceof BadRequestException) {
        return {
          status: 'invalid',
          message: err.message,
        };
      }
      this.logger.warn(
        `resolveAndPin failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        status: 'invalid',
        message: 'Unable to resolve section right now. Try again or soft-pin as unverified.',
      };
    }
  }
}
