/**
 * Versioned CourtProfile — caption, terminology, and filing-bundle rules.
 */

export interface CourtProfile {
  id: string;
  version: string;
  jurisdiction: string;
  forum: string;
  effectiveFrom: string;
  captionFormat: string;
  partyTerminology: {
    applicant: string;
    respondent: string;
  };
  mandatorySections: string[];
  filingBundleRules: string[];
  valuationRules: string[];
  courtFeeRules: string[];
  affidavitRules: string[];
  annexureRules: string[];
  eFilingRules: string[];
  localWarnings: string[];
  sources: string[];
  verifiedAt: string;
}

export const COURT_PROFILES: CourtProfile[] = [
  {
    id: 'in-district-consumer-ahmedabad',
    version: '2024.1.0',
    jurisdiction: 'IN-GJ',
    forum: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    effectiveFrom: '2021-07-20',
    captionFormat:
      'BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, AHMEDABAD',
    partyTerminology: {
      applicant: 'Complainant',
      respondent: 'Opposite Party',
    },
    mandatorySections: [
      'CAUSE TITLE',
      'MEMO OF PARTIES',
      'FACTS',
      'JURISDICTION',
      'GROUNDS',
      'PRAYER',
      'VERIFICATION',
    ],
    filingBundleRules: [
      'complaint',
      'supporting_affidavit',
      'list_of_documents',
      'vakalatnama',
    ],
    valuationRules: ['CPA 2019 pecuniary thresholds — confirm current notification'],
    courtFeeRules: ['State consumer commission fee schedule — confirm locally'],
    affidavitRules: ['Verification by complainant'],
    annexureRules: ['Numbered annexures with description'],
    eFilingRules: [],
    localWarnings: [
      'Confirm current pecuniary notification before asserting District/State/National band.',
    ],
    sources: ['Consumer Protection Act, 2019'],
    verifiedAt: '2024-01-01',
  },
];

export function resolveCourtProfile(forumHint?: string): CourtProfile | undefined {
  if (!forumHint) return undefined;
  const hay = forumHint.toLowerCase();
  return COURT_PROFILES.find(
    (p) =>
      hay.includes('ahmedabad') && hay.includes('consumer')
        ? p.id === 'in-district-consumer-ahmedabad'
        : hay.includes(p.forum.toLowerCase().slice(0, 20)),
  );
}
