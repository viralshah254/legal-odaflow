export interface CountryCompliancePolicySeed {
  countryCode: string;
  countryName: string;
  allowConsumerGuidance?: boolean;
  allowDocumentGeneration?: boolean;
  allowLawyerMarketplace?: boolean;
  requireLawyerReviewForAdvice?: boolean;
  requireDisclaimerOnEveryOutput?: boolean;
  allowTrainingOptIn?: boolean;
  requireExplicitTrainingConsent?: boolean;
  allowAutomatedDecisioning?: boolean;
  restrictedPhrases: string[];
  approvedProductLabels: string[];
  dataResidencyRequired?: boolean;
  defaultDataRegion?: string;
  notes?: string;
}

const COMMON_RESTRICTED_PHRASES = [
  'AI lawyer',
  'guaranteed legal advice',
  'guaranteed win',
  'replace your lawyer',
  'court-proof',
  '100% accurate legal advice',
];

const COMMON_APPROVED_LABELS = [
  'Legal guidance',
  'Legal information',
  'Legal issue checker',
  'Document explanation',
  'Legal position report',
  'Lawyer-reviewed report',
  'Risk analysis',
  'Self-help legal preparation',
];

export const COUNTRY_COMPLIANCE_POLICY_SEEDS: CountryCompliancePolicySeed[] = [
  {
    countryCode: 'IN',
    countryName: 'India',
    requireLawyerReviewForAdvice: true,
    requireExplicitTrainingConsent: true,
    dataResidencyRequired: true,
    defaultDataRegion: 'ap-south-1',
    restrictedPhrases: [
      ...COMMON_RESTRICTED_PHRASES,
      'Bar Council approved AI',
      'substitute for advocate',
    ],
    approvedProductLabels: COMMON_APPROVED_LABELS,
    notes: 'Consumer guidance permitted with mandatory disclaimers and lawyer review for advice.',
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    requireLawyerReviewForAdvice: true,
    requireExplicitTrainingConsent: true,
    dataResidencyRequired: false,
    defaultDataRegion: 'us-east-1',
    restrictedPhrases: [
      ...COMMON_RESTRICTED_PHRASES,
      'attorney-client relationship',
      'unauthorized practice of law',
    ],
    approvedProductLabels: COMMON_APPROVED_LABELS,
    notes: 'UPL-sensitive jurisdiction — no legal advice without licensed attorney review.',
  },
  {
    countryCode: 'KE',
    countryName: 'Kenya',
    requireLawyerReviewForAdvice: true,
    requireExplicitTrainingConsent: true,
    dataResidencyRequired: true,
    defaultDataRegion: 'af-south-1',
    restrictedPhrases: [
      ...COMMON_RESTRICTED_PHRASES,
      'LSK certified AI',
    ],
    approvedProductLabels: COMMON_APPROVED_LABELS,
    notes: 'Advocate Act considerations — information only for consumers.',
  },
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    requireLawyerReviewForAdvice: true,
    requireExplicitTrainingConsent: true,
    dataResidencyRequired: false,
    defaultDataRegion: 'eu-west-2',
    restrictedPhrases: [
      ...COMMON_RESTRICTED_PHRASES,
      'SRA regulated AI',
      'solicitor substitute',
    ],
    approvedProductLabels: COMMON_APPROVED_LABELS,
    notes: 'SRA/LSB context — legal information and self-help only for consumers.',
  },
  {
    countryCode: 'EU',
    countryName: 'European Union / EEA',
    requireLawyerReviewForAdvice: true,
    requireExplicitTrainingConsent: true,
    allowAutomatedDecisioning: false,
    dataResidencyRequired: true,
    defaultDataRegion: 'eu-central-1',
    restrictedPhrases: [
      ...COMMON_RESTRICTED_PHRASES,
      'GDPR compliant legal advice',
      'automated legal decision',
    ],
    approvedProductLabels: COMMON_APPROVED_LABELS,
    notes: 'GDPR + AI Act posture — explicit consent, no automated legal decisioning.',
  },
];
