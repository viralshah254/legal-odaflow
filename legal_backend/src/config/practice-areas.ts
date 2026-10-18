import {
  practiceAreaOptions,
  practiceAreaLabel,
  PRACTICE_AREA_SLUGS,
  PRACTICE_AREA_LABEL_BY_SLUG,
} from '@/config/taxonomy/platform-taxonomy';

export type PracticeAreaOption = { slug: string; label: string };

export const PRACTICE_AREAS: PracticeAreaOption[] = practiceAreaOptions('professional');

export { PRACTICE_AREA_SLUGS, PRACTICE_AREA_LABEL_BY_SLUG, practiceAreaLabel };

export {
  resolvePracticeAreaSlug,
  domainsForJurisdiction,
  legalFormsPracticeAreaSlugs,
  PLATFORM_DOMAINS,
  PROFESSIONAL_DOMAINS,
} from '@/config/taxonomy/platform-taxonomy';
