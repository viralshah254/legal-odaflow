import { PRACTICE_AREAS } from '../practice-areas';
import { TEMPLATE_DEFS } from '../template-library.seed';
import {
  applyCountryOverlay,
  COUNTRY_DEFAULT_JURISDICTION,
  COUNTRY_PREFIX,
  type Tier1Country,
} from './shared/country-overlays';
import { getConditionalFields, injectConditionals } from './shared/conditional-syntax';
import { KENYA_TEMPLATE_DEFS } from './kenya-drafting-catalog';

export interface SystemTemplateSeed {
  countryCode: string;
  practiceArea: string;
  name: string;
  content: string;
  documentKind: string;
  jurisdiction?: string;
  conditionalFields?: string[];
  sortOrder: number;
}

const REVIEW_FOOTER =
  '<p><em>Draft for attorney review only — adapt to client facts and local rules before use.</em></p>';

function wrapBody(title: string, body: string): string {
  return `<h1>${title}</h1>${body}<p><br/></p><p>Client: {{clientName}}</p><p>Firm: {{firmName}}</p><p>Date: {{today}}</p>${REVIEW_FOOTER}`;
}

const TIER1_COUNTRIES: Tier1Country[] = ['IN', 'US', 'KE', 'GB'];

export function buildTemplateLibrarySeeds(): SystemTemplateSeed[] {
  const seeds: SystemTemplateSeed[] = [];
  let order = 0;

  for (const countryCode of TIER1_COUNTRIES) {
    const prefix = COUNTRY_PREFIX[countryCode] ?? countryCode;
    const jurisdiction = COUNTRY_DEFAULT_JURISDICTION[countryCode];

    for (const area of PRACTICE_AREAS) {
      const baseDefs = TEMPLATE_DEFS[area.slug];
      const kenyaDefs =
        countryCode === 'KE'
          ? KENYA_TEMPLATE_DEFS.filter((definition) => {
              const metadata = definition.kind === 'employment_claim'
                ? 'employment_labour'
                : 'litigation_disputes';
              return metadata === area.slug;
            })
          : [];
      const kenyaKinds = new Set(kenyaDefs.map((definition) => definition.kind));
      const defs =
        countryCode === 'KE'
          ? [...(baseDefs ?? []).filter((definition) => !kenyaKinds.has(definition.kind)), ...kenyaDefs]
          : baseDefs;
      if (!defs || defs.length === 0) continue;

      for (const def of defs) {
        let body = def.body;
        body = applyCountryOverlay(countryCode, def.kind, body);
        body = injectConditionals(def.kind, body);

        const conditionalFields = getConditionalFields(def.kind);

        seeds.push({
          countryCode,
          practiceArea: area.slug,
          name: `${prefix} — ${def.title}`,
          content: wrapBody(def.title, body),
          documentKind: def.kind,
          jurisdiction,
          conditionalFields,
          sortOrder: order++,
        });
      }
    }
  }

  return seeds;
}

export const TEMPLATE_LIBRARY_SEEDS = buildTemplateLibrarySeeds();
