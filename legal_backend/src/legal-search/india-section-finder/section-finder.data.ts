/**
 * India Section Finder — re-exports merged index (Schedule I crosswalk + enriched + special acts).
 * @deprecated Import from section-finder.index.ts or section-finder.types.ts directly.
 */
export type {
  LegacyActId,
  NewActId,
  TrialCourt,
  ChangeType,
  SectionFinderTier,
  SectionFinderEntry,
  SectionAmendmentOverlay,
  AmendmentOverlayChangeType,
} from './section-finder.types';

export { LAW_CURRENCY_CUTOFF, OMITTED_SENTINELS } from './section-finder.types';
export { SECTION_FINDER_DATA, SECTION_FINDER_INDEX, SECTION_FINDER_STATS } from './section-finder.index';
export type { SectionFinderSuggestion } from './section-finder.service';
export { parseSectionAuthorityId } from './section-finder.service';
export { ENRICHED_SECTION_FINDER_DATA, LITIGATION_PRIORITY_IDS } from './litigation-enriched.in';
export { SPECIAL_ACTS_SECTION_FINDER_DATA } from './special-acts.in';
export { SCHEDULE1_CROSSWALK_ROWS, SCHEDULE1_CROSSWALK_COUNT } from './schedule1-crosswalk.in.generated';
export { AMENDMENTS_THROUGH_2026_06, findAmendmentOverlay } from './amendments-through-2026-06.in';

import { SECTION_FINDER_DATA } from './section-finder.index';

/** @deprecated Use SECTION_FINDER_DATA */
export const IN_SECTION_FINDER_DATA = SECTION_FINDER_DATA;
