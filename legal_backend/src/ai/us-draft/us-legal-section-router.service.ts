import { Injectable } from '@nestjs/common';
import { DraftArchetypeRouterService } from '@/ai/drafting/archetypes/draft-archetype-router.service';
import type { GoverningSection } from '@/ai/drafting/draft-procedural-router.types';

export interface UsLegalSectionRouterInput {
  rawFacts: string;
  documentKind?: string;
  stateCode?: string;
  forumIntent?: string;
}

export interface UsLegalSectionRouteResult {
  governingSections: GoverningSection[];
  substantiveSections: GoverningSection[];
  proceduralSections: GoverningSection[];
  recommendedKind?: string;
  register: string;
  federalNexus: boolean;
  warnings: string[];
  missingFacts: string[];
  promptBlock: string;
}

const FEDERAL_NEXUS =
  /\b(?:18\s*u\.?\s*s\.?\s*c|federal\s+(?:court|crime|criminal|indictment)|wire\s+fraud|mail\s+fraud|fbi|usa\s+v\.?)\b/i;

/**
 * US parallel to LegalSectionRouterService.
 * Routes offence/case facts to curated kinds and section labels —
 * never invents state penal code numbers without grounding.
 */
@Injectable()
export class UsLegalSectionRouterService {
  constructor(private readonly archetypeRouter: DraftArchetypeRouterService) {}

  resolve(input: UsLegalSectionRouterInput): UsLegalSectionRouteResult {
    const federalNexus = FEDERAL_NEXUS.test(input.rawFacts);
    const route = this.archetypeRouter.route({
      jurisdiction: 'US',
      caseDetails: input.rawFacts,
      documentKind: input.documentKind,
      forumIntent: input.forumIntent,
    });

    let recommendedKind = route.recommendedKind;
    if (federalNexus && /criminal|fraud|indictment/i.test(input.rawFacts)) {
      recommendedKind = 'us_federal_criminal_complaint';
    }

    const warnings = [...route.warnings];
    if (!route.matched) {
      warnings.push(
        'No US offence archetype matched — do not invent USC or state penal citations; use [BLANK: governing statute].',
      );
    }
    if (federalNexus && recommendedKind?.startsWith('us_state_')) {
      warnings.push(
        'Federal nexus signals present but state kind selected — confirm jurisdiction before filing.',
      );
    }
    if (!federalNexus && recommendedKind?.startsWith('us_federal_criminal')) {
      warnings.push(
        'Federal criminal kind selected without clear federal nexus — prefer state complaint unless nexus is established.',
      );
    }
    if (input.stateCode) {
      warnings.push(`Apply ${input.stateCode.toUpperCase()} state overlay for captions and local statutes.`);
    }

    const promptBlock = [
      'US LEGAL SECTION ROUTING (do not invent cites outside grounding):',
      `Register: ${route.register}`,
      recommendedKind ? `Recommended kind: ${recommendedKind}` : null,
      route.governingSections.length
        ? `Governing labels: ${route.governingSections.map((s) => s.label).join('; ')}`
        : 'Governing sections: unresolved — use [BLANK: governing statute] until counsel confirms.',
      ...warnings.map((w) => `Warning: ${w}`),
    ]
      .filter(Boolean)
      .join('\n');

    return {
      governingSections: route.governingSections,
      substantiveSections: route.substantiveSections,
      proceduralSections: route.proceduralSections,
      recommendedKind,
      register: route.register,
      federalNexus,
      warnings,
      missingFacts: route.missingFacts,
      promptBlock,
    };
  }
}
