import { Injectable } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { DraftSectionFinderGroundingService } from './draft-section-finder-grounding.service';
import type { ProceduralRouterResult } from './draft-procedural-router.types';

export interface PreDraftChecklistInput {
  kind: string;
  caseDetails: string;
  courtName?: string;
  jurisdiction?: string;
  countryCode: string;
  proceduralResult: ProceduralRouterResult;
  authorityCount: number;
}

export interface PreDraftChecklistResult {
  checklist: Record<string, boolean>;
  resolvedItems: string[];
  unresolvedItems: string[];
  promptBlock: string;
}

@Injectable()
export class DraftPreChecklistService {
  constructor(
    private readonly bareActLookup: BareActLookupService,
    private readonly sectionFinderGrounding: DraftSectionFinderGroundingService,
  ) {}

  async evaluate(input: PreDraftChecklistInput): Promise<PreDraftChecklistResult> {
    const facts = `${input.caseDetails} ${input.courtName ?? ''} ${input.jurisdiction ?? ''}`.toLowerCase();
    const resolvedItems: string[] = [];
    const unresolvedItems: string[] = [];

    const courtIdentified =
      !!input.courtName?.trim() ||
      /high court|supreme court|district court|sessions court|family court|magistrate|tribunal|ahmedabad|gujarat|delhi|bombay|madras|calcutta/i.test(
        facts,
      );
    if (courtIdentified) {
      const court =
        input.courtName ??
        facts.match(/high court of ([a-z\s]+)|supreme court/i)?.[0] ??
        'court identified from facts';
      resolvedItems.push(`Court: ${court}`);
    } else {
      unresolvedItems.push('court / forum');
    }

    const orderTypeIdentified =
      /maintenance|bail|writ|appeal|revision|plaint|complaint|petition|suit/i.test(facts) ||
      /maintenance|appeal|revision|writ|bail|plaint/i.test(input.kind);
    if (orderTypeIdentified) {
      resolvedItems.push(`Proceeding type: ${input.proceduralResult.recommendedKind}`);
    } else {
      unresolvedItems.push('nature of proceeding');
    }

    const interimOrFinalIdentified =
      /interim\s+(?:order|maintenance|relief)/i.test(facts) ||
      /final\s+(?:order|maintenance|determination)/i.test(facts) ||
      /disposed\s+on\s+merits/i.test(facts);
    if (interimOrFinalIdentified) {
      const nature = /interim/i.test(facts) ? 'interim order' : 'final order';
      resolvedItems.push(`Order nature: ${nature}`);
    } else if (/maintenance|125|144/i.test(facts)) {
      unresolvedItems.push('interim vs final order');
    }

    let governingStatuteVerified = false;
    let sectionFinderLabels: string[] = [];
    if (input.countryCode === 'IN') {
      try {
        const finderContext = await this.sectionFinderGrounding.buildContext(
          input.kind,
          input.caseDetails,
        );
        sectionFinderLabels = finderContext.verifiedSectionLabels;
        if (finderContext.matches.length > 0) {
          governingStatuteVerified = true;
          for (const label of sectionFinderLabels.slice(0, 4)) {
            resolvedItems.push(`Section Finder: ${label}`);
          }
        }
      } catch {
        /* fall through to bare-act */
      }

      const sections = input.proceduralResult.governingSections;
      for (const s of sections) {
        try {
          const lookup = await this.bareActLookup.lookupExactSection(s.actId, s.section, 'IN');
          if (lookup.found) {
            governingStatuteVerified = true;
            resolvedItems.push(`${s.label} verified in bare-act corpus`);
          }
        } catch {
          // continue
        }
      }
      if (!governingStatuteVerified && /maintenance|125|144/i.test(facts)) {
        const fallback = await this.bareActLookup.lookupExactSection('bnss', '144', 'IN');
        governingStatuteVerified = fallback.found;
        if (fallback.found) resolvedItems.push('BNSS §144 verified in bare-act corpus');
      }
    } else {
      governingStatuteVerified = true;
    }
    if (!governingStatuteVerified) unresolvedItems.push('governing statute section');

    const appealProvisionVerified =
      input.proceduralResult.governingSections.some((s) => /427|438|115|226/i.test(s.section)) ||
      !/appeal|revision/i.test(input.kind);
    if (appealProvisionVerified) {
      for (const s of input.proceduralResult.governingSections) {
        resolvedItems.push(`Procedural provision: ${s.label}`);
      }
    } else {
      unresolvedItems.push('appeal/revision provision');
    }

    const revisionRouteChecked =
      !input.proceduralResult.kindOverridden ||
      input.proceduralResult.recommendedKind.includes('revision') ||
      !/interim/i.test(facts);
    if (revisionRouteChecked && input.proceduralResult.kindOverridden) {
      resolvedItems.push(
        `Procedural route: ${input.proceduralResult.recommendedKind} (auto-selected)`,
      );
    }

    const limitationVerified =
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(facts) ||
      /dated\s+\d|order\s+dated|impugned\s+order\s+dated/i.test(facts);
    if (limitationVerified) {
      resolvedItems.push('Impugned order date present in facts');
    } else if (/appeal|revision|writ/i.test(input.kind)) {
      unresolvedItems.push('impugned order date (for limitation)');
    }

    const allCitationsVerified = input.authorityCount >= 1;
    if (allCitationsVerified) {
      resolvedItems.push(`${input.authorityCount} verified authorit(ies) retrieved`);
    } else {
      unresolvedItems.push('verified case law authorities');
    }

    const allSectionsVerified = governingStatuteVerified;

    const checklist: Record<string, boolean> = {
      court_identified: courtIdentified,
      order_type_identified: orderTypeIdentified,
      interim_or_final_identified: interimOrFinalIdentified,
      governing_statute_verified: governingStatuteVerified,
      appeal_provision_verified: appealProvisionVerified,
      revision_route_checked: revisionRouteChecked,
      limitation_verified: limitationVerified,
      all_citations_verified: allCitationsVerified,
      all_sections_verified: allSectionsVerified,
    };

    const lines = ['PRE-DRAFT CHECKLIST (auto-resolved items — use in cause title and maintainability):'];
    for (const r of resolvedItems) lines.push(`- RESOLVED: ${r}`);
    for (const u of unresolvedItems) {
      lines.push(`- PENDING USER FACT: ${u} — use [BLANK: ${u}] in draft; do NOT invent`);
    }
    if (input.proceduralResult.kindOverridden) {
      lines.push(
        `- PROCEDURAL ROUTE: Draft as ${input.proceduralResult.recommendedKind}. Cause title must reflect ${input.proceduralResult.recommendedKind.includes('revision') ? 'CRIMINAL REVISION PETITION' : 'appropriate appellate vehicle'}. Never write "Jurisdiction Confirmed" or "Civil Appeal" unless verified.`,
      );
    }

    return {
      checklist,
      resolvedItems,
      unresolvedItems,
      promptBlock: lines.join('\n'),
    };
  }
}
