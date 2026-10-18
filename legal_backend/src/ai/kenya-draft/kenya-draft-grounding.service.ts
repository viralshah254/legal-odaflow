import { Injectable } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { ResearchSectionFinderGroundingService } from '@/ai/legal-research/research-section-finder-grounding.service';
import { truncateAtSentence } from '@/legal-search/text-truncate';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

/** Primary statute sections implied by Kenya draft document kind slugs. */
const KIND_SECTION_HINTS: Record<string, Array<{ actId: string; section: string }>> = {
  kenya_civil_plaint: [
    { actId: 'cap-22', section: '4' },
    { actId: 'constitution-ke', section: '50' },
  ],
  kenya_notice_of_motion: [
    { actId: 'cap-22', section: '4' },
    { actId: 'constitution-ke', section: '47' },
  ],
  kenya_supporting_affidavit: [
    { actId: 'cap-22', section: '4' },
  ],
  kenya_memorandum_of_claim: [
    { actId: 'employment-act-2007', section: '41' },
    { actId: 'employment-act-2007', section: '45' },
    { actId: 'employment-act-2007', section: '49' },
  ],
  kenya_demand_letter: [
    { actId: 'cap-23', section: '3' },
  ],
}

@Injectable()
export class KenyaDraftGroundingService {
  constructor(
    private readonly bareActLookup: BareActLookupService,
    private readonly sectionFinderGrounding: ResearchSectionFinderGroundingService,
  ) {}

  resolvePrimarySections(kind: string): Array<{ actId: string; section: string }> {
    if (KIND_SECTION_HINTS[kind]) return KIND_SECTION_HINTS[kind];
    if (/employment|labour|elrc|memorandum_of_claim/i.test(kind)) {
      return KIND_SECTION_HINTS.kenya_memorandum_of_claim;
    }
    if (/demand/i.test(kind)) return KIND_SECTION_HINTS.kenya_demand_letter;
    if (/motion/i.test(kind)) return KIND_SECTION_HINTS.kenya_notice_of_motion;
    if (/plaint|civil/i.test(kind)) return KIND_SECTION_HINTS.kenya_civil_plaint;
    return [];
  }

  async buildGroundingBlock(kind: string, caseDetails: string): Promise<string> {
    const sections = this.resolvePrimarySections(kind);
    const lines: string[] = [
      'AUTHORITATIVE KENYA SECTIONS (do not contradict — use these where applicable):',
      'Cite Kenya Law Cap / Act section numbers. Prefer current expressions from Kenya Law (new.kenyalaw.org).',
    ];

    for (const { actId, section } of sections) {
      const lookup = await this.bareActLookup.lookupExactSection(actId, section, 'KE');
      if (lookup.found && lookup.authority) {
        const excerpt = truncateAtSentence(
          lookup.authority.fullText ?? lookup.authority.summary ?? '',
          600,
        );
        lines.push(
          `- ${lookup.authority.citation ?? `${actId} s.${section}`}: ${excerpt}`,
        );
      } else {
        lines.push(`- ${actId} s.${section} (primary section for this document kind)`);
      }
    }

    try {
      const finderContext = await this.sectionFinderGrounding.buildContext(
        caseDetails,
        undefined,
        'KE',
      );
      if (finderContext.promptBlock) {
        lines.push('', finderContext.promptBlock);
      }
    } catch {
      /* non-fatal */
    }

    lines.push(
      'Do not invent Cap numbers or eKLR citations. If a section is unverified, mark [TO BE CONFIRMED].',
    );

    return lines.join('\n');
  }

  async buildGroundingAuthorities(
    kind: string,
  ): Promise<RetrievedAuthority[]> {
    const sections = this.resolvePrimarySections(kind);
    const authorities: RetrievedAuthority[] = [];
    const seen = new Set<string>();
    for (const { actId, section } of sections) {
      const lookup = await this.bareActLookup.lookupExactSection(actId, section, 'KE');
      if (!lookup.found || !lookup.authority || seen.has(lookup.authority.id)) continue;
      seen.add(lookup.authority.id);
      authorities.push({
        id: lookup.authority.id,
        title: lookup.authority.title,
        citation: lookup.authority.citation,
        sourceName: lookup.authority.sourceName ?? 'Kenya Law',
        summary: lookup.authority.summary ?? null,
        fullText: lookup.authority.fullText ?? null,
        sourceUrl: lookup.authority.sourceUrl ?? null,
        sourceTier: 'primary',
        authorityType: 'STATUTE_SECTION',
        score: lookup.authority.score,
      });
    }
    return authorities;
  }

  /** Compact governing-law string for empty legalBasis template fields. */
  async resolveLegalBasis(kind: string): Promise<string | undefined> {
    const authorities = await this.buildGroundingAuthorities(kind);
    if (authorities.length === 0) return undefined;
    return authorities
      .map((a) => a.citation ?? a.title)
      .filter(Boolean)
      .slice(0, 4)
      .join('; ');
  }
}
