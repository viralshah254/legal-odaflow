import {
  CountryPrivacyRequirements,
  getCountryPrivacyRequirements,
} from './privacy-controls';

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
  privacyRequirements?: CountryPrivacyRequirements;
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

/** EU/EEA member states without a dedicated policy fall back to the EU seed. */
export const EU_MEMBER_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'CH',
]);

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
    privacyRequirements: getCountryPrivacyRequirements('KE'),
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
    countryCode: 'FR',
    countryName: 'France',
    requireLawyerReviewForAdvice: true,
    requireExplicitTrainingConsent: true,
    allowAutomatedDecisioning: false,
    dataResidencyRequired: true,
    defaultDataRegion: 'eu-west-3',
    restrictedPhrases: [
      ...COMMON_RESTRICTED_PHRASES,
      'CNB certified AI',
      'substitut de avocat',
      'conseil juridique garanti',
    ],
    approvedProductLabels: COMMON_APPROVED_LABELS,
    notes: 'French bar / GDPR posture — legal information only; lawyer review for advice.',
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
