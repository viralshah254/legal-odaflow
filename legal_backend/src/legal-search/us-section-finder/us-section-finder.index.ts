import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';
import { US_FEDERAL_CURATED, US_FEDERAL_SEED_ACT_IDS } from './us-curated.federal';
import { US_STATE_CURATED, US_STATE_SEED_ACT_IDS } from './us-curated.state';

export const US_SECTION_FINDER_DATA: SectionFinderEntry[] = [
  ...US_FEDERAL_CURATED,
  ...US_STATE_CURATED,
];

/** Registry act id for each curated entry (parallel to US_SECTION_FINDER_DATA). */
export const US_SECTION_FINDER_ACT_IDS: string[] = [
  ...US_FEDERAL_SEED_ACT_IDS,
  ...US_STATE_SEED_ACT_IDS,
];

export const US_SECTION_FINDER_INDEX = new Map<string, SectionFinderEntry>(
  US_SECTION_FINDER_DATA.map((entry) => [entry.id, entry]),
);

/** Lookup curated entry by registry act id + section number. */
export const US_SECTION_FINDER_BY_ACT = new Map<string, SectionFinderEntry>(
  US_SECTION_FINDER_DATA.map((entry, i) => [
    `${US_SECTION_FINDER_ACT_IDS[i]}:${entry.legacySection.toUpperCase()}`,
    entry,
  ]),
);

export const US_SECTION_FINDER_STATS = {
  total: US_SECTION_FINDER_DATA.length,
  federal: US_FEDERAL_CURATED.length,
  state: US_STATE_CURATED.length,
};

export const US_LAW_CURRENCY_CUTOFF = '2026-06-30' as const;

export const US_DISCLAIMER =
  'This section finder draws on ingested U.S. Code, CFR, and state statute sources (Cornell LII, eCFR, and official state codes). ' +
  'This is legal information only — not legal advice. Consult a qualified attorney for your specific matter.';
