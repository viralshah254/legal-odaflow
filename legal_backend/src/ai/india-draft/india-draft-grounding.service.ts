import { Injectable } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { findRemap } from '@/legal-search/statute-registry';
import { DraftSectionFinderGroundingService } from '@/ai/drafting/draft-section-finder-grounding.service';
import { truncateAtSentence } from '@/legal-search/text-truncate';
import type { GoverningSection } from '@/ai/drafting/draft-procedural-router.types';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import {
  buildPinnedSectionsPromptBlock,
  type PinnedSection,
} from '@/ai/drafting/draft-pinned-authorities';

/** Primary statute sections implied by India draft document kind slugs. */
const KIND_SECTION_HINTS: Record<string, Array<{ actId: string; section: string }>> = {
  india_habeas_corpus_petition: [
    { actId: 'bnss', section: '35' },
    { actId: 'bnss', section: '36' },
    { actId: 'bnss', section: '47' },
    { actId: 'bnss', section: '48' },
    { actId: 'bnss', section: '57' },
    { actId: 'bnss', section: '58' },
    { actId: 'bnss', section: '62' },
  ],
  india_maintenance_application_bnss_144: [{ actId: 'bnss', section: '144' }],
  india_maintenance_application_bnss_144_family: [{ actId: 'bnss', section: '144' }],
  india_maintenance_order_revision: [
    { actId: 'bnss', section: '144' },
    { actId: 'bnss', section: '438' },
  ],
  india_maintenance_appeal_final: [
    { actId: 'bnss', section: '144' },
    { actId: 'bnss', section: '427' },
  ],
  india_family_court_maintenance_appeal: [{ actId: 'bnss', section: '144' }],
  // Regular bail is forum-dependent (BNSS §480 before Magistrate; §483 before
  // Sessions/HC). Router-selected sections are merged at call sites.
  india_regular_bail_bnss_480: [
    { actId: 'bnss', section: '480' },
    { actId: 'bnss', section: '483' },
  ],
  india_anticipatory_bail_bnss_482: [{ actId: 'bnss', section: '482' }],
  india_default_bail_bnss_187: [{ actId: 'bnss', section: '187' }],
  india_bail_bailable_bnss_478: [{ actId: 'bnss', section: '478' }],
  india_bail_cancellation_bnss_483: [{ actId: 'bnss', section: '483' }],
  india_discharge_application_bnss_250: [
    { actId: 'bnss', section: '250' },
    { actId: 'bnss', section: '262' },
  ],
  india_charge_framing_objection: [
    { actId: 'bnss', section: '251' },
    { actId: 'bnss', section: '263' },
  ],
  india_quashing_petition_bnss_528: [{ actId: 'bnss', section: '528' }],
  india_criminal_revision: [{ actId: 'bnss', section: '438' }],
  india_revision_petition_bnss_438: [{ actId: 'bnss', section: '438' }],
  india_cheque_bounce_complaint_ni138: [{ actId: 'ni_act', section: '138' }],
  india_criminal_appeal: [{ actId: 'bnss', section: '427' }],
  // Procedural vehicle only — substantive offence sections come from
  // LegalSectionRouter / DraftArchetypeRouter (never pin BNS §78 on every FIR).
  india_fir_complaint: [{ actId: 'bnss', section: '173' }],
  india_complaint_magistrate_bnss_223: [{ actId: 'bnss', section: '223' }],
};

const MAINTENANCE_PREDECESSOR = { actId: 'crpc', section: '125', successor: '144' };

@Injectable()
export class IndiaDraftGroundingService {
  constructor(
    private readonly bareActLookup: BareActLookupService,
    private readonly sectionFinderGrounding: DraftSectionFinderGroundingService,
  ) {}

  resolvePrimarySections(kind: string): Array<{ actId: string; section: string }> {
    if (KIND_SECTION_HINTS[kind]) return KIND_SECTION_HINTS[kind];

    const fromSlug = kind.match(/bnss[_-]?(\d+[a-z]?)/i);
    if (fromSlug) {
      return [{ actId: 'bnss', section: fromSlug[1] }];
    }

    if (/maintenance|muslim_maintenance/i.test(kind)) {
      return [{ actId: 'bnss', section: '144' }];
    }

    return [];
  }

  async buildGroundingBlock(
    kind: string,
    caseDetails: string,
    governingSections: GoverningSection[] = [],
    pinnedSections: PinnedSection[] = [],
  ): Promise<string> {
    const pinnedAsGoverning = pinnedSections
      .filter((p) => p.section?.trim())
      .map((p) => ({
        actId: (p.actId?.trim() || 'unknown').toLowerCase(),
        section: p.section.trim(),
      }));
    const sections = this.mergeSections(
      this.resolvePrimarySections(kind),
      [...governingSections, ...pinnedAsGoverning.map((g) => ({ ...g, label: `${g.actId} §${g.section}` }))],
    );
    const lines: string[] = [
      'AUTHORITATIVE SECTIONS (do not contradict — use these numbers in the draft):',
    ];

    const pinBlock = buildPinnedSectionsPromptBlock(pinnedSections);
    if (pinBlock) {
      lines.push(pinBlock, '');
    }

    for (const { actId, section } of sections) {
      const lookup = await this.bareActLookup.lookupExactSection(actId, section, 'IN');
      if (lookup.found && lookup.authority) {
        const excerpt = truncateAtSentence(
          lookup.authority.fullText ?? lookup.authority.summary ?? '',
          600,
        );
        lines.push(
          `- ${lookup.authority.citation ?? `${actId.toUpperCase()} s.${section}`}: ${excerpt}`,
        );
      } else {
        lines.push(`- ${actId.toUpperCase()} s.${section} (primary section for this document kind)`);
      }

      const remap = findRemap('IN', actId === 'bnss' ? 'crpc' : actId, section);
      if (remap && remap.from.actId !== actId) {
        lines.push(
          `  Schedule I: ${remap.from.actId.toUpperCase()} §${remap.from.section} → ${remap.to.actId.toUpperCase()} §${remap.to.section}` +
            (remap.note ? ` (${remap.note})` : ''),
        );
      }
    }

    if (/maintenance/i.test(kind) || /maintenance|wife|husband|alimony/i.test(caseDetails)) {
      const crpcRemap = findRemap('IN', MAINTENANCE_PREDECESSOR.actId, MAINTENANCE_PREDECESSOR.section);
      lines.push(
        `- Schedule I crosswalk: CrPC §125 → BNSS §144 (maintenance of wives, children and parents). ` +
          'Never cite BNS §125 for maintenance — BNS §125 is an unrelated substantive offence.',
      );
      if (crpcRemap?.note) {
        lines.push(`  (${crpcRemap.note})`);
      }
    }

    try {
      const finderContext = await this.sectionFinderGrounding.buildContext(kind, caseDetails);
      lines.push('', finderContext.promptBlock);
    } catch {
      /* non-fatal */
    }

    lines.push(
      'When citing predecessor CrPC/IPC sections, always pair with the correct BNSS/BNS successor from Schedule I.',
      'Never cite BNS for procedural or maintenance provisions — use BNSS.',
    );

    return lines.join('\n');
  }

  async buildGroundingAuthorities(
    kind: string,
    governingSections: GoverningSection[] = [],
  ): Promise<RetrievedAuthority[]> {
    const sections = this.mergeSections(this.resolvePrimarySections(kind), governingSections);
    const authorities: RetrievedAuthority[] = [];
    const seen = new Set<string>();
    for (const { actId, section } of sections) {
      const lookup = await this.bareActLookup.lookupExactSection(actId, section, 'IN');
      if (!lookup.found || !lookup.authority || seen.has(lookup.authority.id)) continue;
      seen.add(lookup.authority.id);
      authorities.push({
        id: lookup.authority.id,
        title: lookup.authority.title,
        citation: lookup.authority.citation,
        sourceName: lookup.authority.sourceName ?? 'Bare Act Corpus',
        summary: lookup.authority.summary ?? null,
        fullText: lookup.authority.fullText ?? null,
        sourceUrl: lookup.authority.sourceUrl ?? null,
        sourceTier: 'primary',
        authorityType: 'STATUTE_SECTION',
        score: lookup.authority.score,
        isRepealed: lookup.authority.isRepealed,
        repealNotes: lookup.authority.repealNotes,
        treatmentStatus: lookup.authority.isRepealed ? 'repealed' : undefined,
      });
    }
    return authorities;
  }

  private mergeSections(
    primary: Array<{ actId: string; section: string }>,
    governing: GoverningSection[],
  ): Array<{ actId: string; section: string }> {
    const seen = new Set<string>();
    const merged: Array<{ actId: string; section: string }> = [];
    for (const item of [
      ...primary,
      ...governing.map((g) => ({ actId: g.actId, section: g.section })),
    ]) {
      const key = `${item.actId}:${item.section}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged;
  }
}
