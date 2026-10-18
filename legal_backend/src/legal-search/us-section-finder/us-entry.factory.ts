import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';

export interface UsCuratedSectionInput {
  actId: string;
  actShort: string;
  actFull: string;
  section: string;
  title: string;
  changeSummary: string;
  punishment?: string;
  practiceNote?: string;
  bailPosture?: string;
  trialCourtLabel?: string;
  jurisdiction?: string;
  sourceRef?: string;
}

export type UsCuratedSectionExtra = Partial<
  Pick<
    UsCuratedSectionInput,
    'punishment' | 'practiceNote' | 'bailPosture' | 'trialCourtLabel' | 'jurisdiction' | 'sourceRef'
  >
>;

const DEFAULT_TRIAL = 'Federal district court (subject to jurisdiction and venue rules)';

export function buildUsSectionFinderEntry(input: UsCuratedSectionInput): SectionFinderEntry {
  const id = `${input.actId.toUpperCase().replace(/-/g, '_')}-${input.section}`.replace(/\./g, '_');
  return {
    id,
    legacyActId: 'other',
    legacyActShort: input.actShort,
    legacyActFull: input.actFull,
    legacySection: input.section,
    legacyTitle: input.title,
    newActId: 'unchanged',
    newActShort: input.actShort,
    newActFull: input.actFull,
    newSection: input.section,
    newTitle: input.title,
    changeType: 'unchanged',
    changeSummary: input.changeSummary,
    punishment: input.punishment ?? 'See statute — criminal penalties vary by offense grade and facts.',
    isBailable: false,
    isCognizable: false,
    isCompoundable: false,
    trialCourt: 'special_court',
    trialCourtLabel: input.trialCourtLabel ?? DEFAULT_TRIAL,
    bailPosture:
      input.bailPosture ??
      'Consult the statute, applicable federal/state bail rules, and controlling case law for detention or release posture.',
    practiceNote:
      input.practiceNote ??
      `Review ${input.actShort} §${input.section} in context of controlling circuit precedent and applicable regulations.`,
    sourceRef: input.sourceRef ?? `${input.actShort} §${input.section}`,
    transitionDate: '2024-07-01',
    tier: 'enriched',
    isInForce: true,
    matchSource: 'curated',
  };
}
