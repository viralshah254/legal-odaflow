import { Injectable } from '@nestjs/common';
import type { GoverningSection } from '@/ai/drafting/draft-procedural-router.types';
import { INDIA_DRAFT_ARCHETYPE_REGISTRY } from './draft-archetype.registry.in';
import { US_DRAFT_ARCHETYPE_REGISTRY } from './draft-archetype.registry.us';
import {
  archetypeToRegister,
  kindToArchetype,
  toGoverningSection,
  type ArchetypeRouteInput,
  type ArchetypeRouteResult,
  type DraftArchetypeEntry,
  type ProceduralVehicle,
} from './draft-archetype.types';

@Injectable()
export class DraftArchetypeRouterService {
  route(input: ArchetypeRouteInput): ArchetypeRouteResult {
    const registry =
      input.jurisdiction === 'US'
        ? US_DRAFT_ARCHETYPE_REGISTRY
        : INDIA_DRAFT_ARCHETYPE_REGISTRY;
    const haystack = [input.caseDetails, input.documentKind, input.forumIntent]
      .filter(Boolean)
      .join('\n');

    const matches = registry
      .filter((entry) => entry.signals.some((re) => re.test(haystack)))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (matches.length === 0) {
      const archetype = input.documentKind
        ? kindToArchetype(input.documentKind)
        : 'other';
      return {
        matched: false,
        archetype,
        register: archetypeToRegister(archetype),
        substantiveSections: [],
        proceduralSections: [],
        governingSections: [],
        warnings: [
          'No curated offence/case archetype matched — do not invent governing sections; use [BLANK] and counsel review.',
        ],
        missingFacts: this.missingDateFacts(input),
        sourceRefs: [],
      };
    }

    const entry = matches[0];
    const vehicle = this.selectVehicle(entry, haystack, input.forumIntent);
    const substantive = entry.substantiveSections.map(toGoverningSection);
    const alt = (entry.altStatutes ?? [])
      .filter((a) => a.when.test(haystack))
      .map(
        (a): GoverningSection => ({
          actId: a.actId,
          section: a.section,
          label: a.label,
        }),
      );
    const procedural = (vehicle?.sections ?? []).map(toGoverningSection);
    const governingSections = this.dedupeSections([
      ...substantive,
      ...alt,
      ...procedural,
    ]);

    const warnings: string[] = [];
    if (entry.bailabilityNote) warnings.push(entry.bailabilityNote);
    if (alt.length > 0) {
      warnings.push(
        'Alternate special-act sections matched online/cyber signals — verify applicability before citing as governing offence.',
      );
    }
    warnings.push(...this.missingDateFacts(input).map((f) => `Missing: ${f}`));

    return {
      matched: true,
      entry,
      archetype: entry.archetype,
      register: entry.register,
      recommendedKind: vehicle?.kind ?? entry.proceduralVehicles[0]?.kind,
      substantiveSections: substantive,
      proceduralSections: procedural,
      governingSections,
      warnings,
      missingFacts: this.missingDateFacts(input),
      sourceRefs: entry.sourceRefs,
    };
  }

  /** Kind-only lookup for register / case-law policy without fact matching. */
  resolveRegisterForKind(kind: string): ReturnType<typeof archetypeToRegister> {
    return archetypeToRegister(kindToArchetype(kind));
  }

  private selectVehicle(
    entry: DraftArchetypeEntry,
    haystack: string,
    forumIntent?: string,
  ): ProceduralVehicle | undefined {
    const intentHay = `${haystack}\n${forumIntent ?? ''}`;
    const patterned = entry.proceduralVehicles.find(
      (v) => v.whenPattern && v.whenPattern.test(intentHay),
    );
    if (patterned) return patterned;
    return entry.proceduralVehicles[0];
  }

  private missingDateFacts(input: ArchetypeRouteInput): string[] {
    const missing: string[] = [];
    const hasDateInFacts =
      /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
        input.caseDetails,
      );
    if (!input.offenceDate && !hasDateInFacts) {
      missing.push('offence/incident date');
    }
    if (!input.filingDate && input.jurisdiction === 'IN' && !hasDateInFacts) {
      // filing date optional when offence date present
    }
    return missing;
  }

  private dedupeSections(sections: GoverningSection[]): GoverningSection[] {
    const seen = new Set<string>();
    const out: GoverningSection[] = [];
    for (const s of sections) {
      const key = `${s.actId}:${s.section}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }
}
