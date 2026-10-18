export const KENYA_JURISDICTION = 'KE' as const;

export type KenyaAuthorityLevel =
  | 'OFFICIAL_PRIMARY'
  | 'OFFICIAL_PROSPECTIVE'
  | 'OFFICIAL_ADMINISTRATIVE'
  | 'SECONDARY';

export type KenyaDocumentType =
  | 'CONSTITUTION'
  | 'ACT'
  | 'REGULATION'
  | 'RULE'
  | 'ORDER'
  | 'LEGAL_NOTICE'
  | 'GAZETTE_NOTICE'
  | 'COUNTY_ACT'
  | 'BILL'
  | 'JUDGMENT'
  | 'PRACTICE_DIRECTION'
  | 'TREATY'
  | 'EAC_INSTRUMENT'
  | 'REGULATOR_MATERIAL'
  | 'FORM'
  | 'OTHER';

export type KenyaCorpusStatus =
  | 'IN_FORCE'
  | 'PARTIALLY_IN_FORCE'
  | 'REPEALED'
  | 'SPENT'
  | 'PROSPECTIVE'
  | 'SUPERSEDED'
  | 'UNKNOWN';

export interface KenyaProvisionInput {
  provisionKey: string;
  provisionType: string;
  label?: string;
  heading?: string;
  parentProvisionKey?: string;
  ordinal: number;
  text: string;
  citationSafeText?: string;
  sourceAnchor?: string;
  metadata?: Record<string, unknown>;
}

export interface KenyaExpressionInput {
  workUri: string;
  expressionUri: string;
  expressionDate?: Date;
  title: string;
  shortTitle?: string;
  capNumber?: string;
  actNumber?: string;
  year?: number;
  documentType: KenyaDocumentType;
  authorityLevel: KenyaAuthorityLevel;
  status: KenyaCorpusStatus;
  officialSource: boolean;
  sourceUrl: string;
  sourceName: string;
  sourceLicense?: string;
  sourcePolicyKey: string;
  parserVersion: string;
  extractionMethod: 'XML' | 'HTML' | 'PDF_TEXT' | 'OCR' | 'API' | 'MANUAL';
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'REJECTED';
  originalContent?: Buffer;
  originalMediaType?: string;
  normalizedText: string;
  searchText: string;
  citationSafeText: string;
  provisions: KenyaProvisionInput[];
  metadata?: Record<string, unknown>;
}

export interface KenyaSourcePolicyDefinition {
  sourceKey: string;
  displayName: string;
  baseUrl: string;
  accessMethod: 'api' | 'crawl' | 'feed' | 'manual';
  authorityLevel: KenyaAuthorityLevel;
  enabledByDefault: boolean;
  productionApprovedByDefault: boolean;
  maxConcurrency: number;
  requestsPerMinute: number;
  retryBudget: number;
  attributionText: string;
}

export const KENYA_SOURCE_POLICIES: readonly KenyaSourcePolicyDefinition[] = [
  {
    sourceKey: 'KENYA_LAW',
    displayName: 'Kenya Law',
    baseUrl: 'https://new.kenyalaw.org',
    accessMethod: 'crawl',
    authorityLevel: 'OFFICIAL_PRIMARY',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 2,
    requestsPerMinute: 20,
    retryBudget: 3,
    attributionText: 'Source: Kenya Law, National Council for Law Reporting.',
  },
  {
    sourceKey: 'KENYA_GAZETTE',
    displayName: 'Kenya Gazette',
    baseUrl: 'https://new.kenyalaw.org/gazettes/',
    accessMethod: 'crawl',
    authorityLevel: 'OFFICIAL_PRIMARY',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 1,
    requestsPerMinute: 10,
    retryBudget: 3,
    attributionText: 'Source: Kenya Gazette via Kenya Law.',
  },
  {
    sourceKey: 'KENYA_PARLIAMENT',
    displayName: 'Parliament of Kenya',
    baseUrl: 'https://www.parliament.go.ke',
    accessMethod: 'crawl',
    authorityLevel: 'OFFICIAL_PROSPECTIVE',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 1,
    requestsPerMinute: 10,
    retryBudget: 3,
    attributionText: 'Source: Parliament of Kenya.',
  },
  {
    sourceKey: 'LAWS_AFRICA_KE',
    displayName: 'Laws.Africa Kenya API',
    baseUrl: 'https://api.laws.africa/v3/akn/ke/',
    accessMethod: 'api',
    authorityLevel: 'SECONDARY',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 2,
    requestsPerMinute: 30,
    retryBudget: 3,
    attributionText: 'Source: Laws.Africa; verify against Kenya Law.',
  },
  {
    sourceKey: 'KENYA_COUNTY_LAW',
    displayName: 'Kenya Law County Legislation',
    baseUrl: 'https://new.kenyalaw.org/legislation/county/',
    accessMethod: 'crawl',
    authorityLevel: 'OFFICIAL_PRIMARY',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 1,
    requestsPerMinute: 10,
    retryBudget: 3,
    attributionText: 'Source: Kenya Law county legislation collection.',
  },
  {
    sourceKey: 'KENYA_TREATIES',
    displayName: 'Kenya Law Treaty Collection',
    baseUrl: 'https://new.kenyalaw.org/treaties/',
    accessMethod: 'crawl',
    authorityLevel: 'OFFICIAL_PRIMARY',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 1,
    requestsPerMinute: 10,
    retryBudget: 3,
    attributionText: 'Source: Kenya Law treaty collection.',
  },
  {
    sourceKey: 'EAC_LAW',
    displayName: 'East African Community Law',
    baseUrl: 'https://www.eac.int',
    accessMethod: 'crawl',
    authorityLevel: 'OFFICIAL_PRIMARY',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 1,
    requestsPerMinute: 10,
    retryBudget: 3,
    attributionText: 'Source: East African Community.',
  },
  {
    sourceKey: 'KENYA_REGULATORS',
    displayName: 'Kenya Official Regulators',
    baseUrl: 'https://www.go.ke',
    accessMethod: 'manual',
    authorityLevel: 'OFFICIAL_ADMINISTRATIVE',
    enabledByDefault: false,
    productionApprovedByDefault: false,
    maxConcurrency: 1,
    requestsPerMinute: 6,
    retryBudget: 2,
    attributionText: 'Source: issuing Kenyan regulator.',
  },
] as const;

export function authorityLevelForKenyaDocument(
  documentType: KenyaDocumentType,
): KenyaAuthorityLevel {
  if (documentType === 'BILL') return 'OFFICIAL_PROSPECTIVE';
  if (documentType === 'REGULATOR_MATERIAL') return 'OFFICIAL_ADMINISTRATIVE';
  return 'OFFICIAL_PRIMARY';
}

export function canSatisfyStatutoryAuthority(level: KenyaAuthorityLevel): boolean {
  return level === 'OFFICIAL_PRIMARY';
}
