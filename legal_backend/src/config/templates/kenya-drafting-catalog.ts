import type { TemplateDef } from './helpers';

export type KenyaAdvocateReviewStatus = 'pending' | 'reviewed';

export interface KenyaDraftAuthorityField {
  id: string;
  label: string;
  required: boolean;
  description: string;
}

export interface KenyaDraftCatalogEntry {
  kind: string;
  documentKind: string;
  label: string;
  practiceArea: string;
  advocateReview: {
    status: KenyaAdvocateReviewStatus;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  requiredAuthorityFields: KenyaDraftAuthorityField[];
  verification: {
    jurisdiction: 'Kenya';
    authorityVerificationRequired: true;
    filingRequirementsVerificationRequired: true;
  };
}

const COURT_AUTHORITY_FIELDS: KenyaDraftAuthorityField[] = [
  {
    id: 'courtStation',
    label: 'Court and station',
    required: true,
    description: 'The Kenyan court or tribunal and the station where the document is intended to be filed.',
  },
  {
    id: 'legalBasis',
    label: 'Legal basis and enabling provisions',
    required: true,
    description: 'The Act, rules, constitutional provision, or other authority relied on.',
  },
  {
    id: 'authorityCheckedAt',
    label: 'Authority checked date',
    required: true,
    description: 'Date on which cited legislation, rules, and authorities were checked for currency.',
  },
];

const NON_FILING_AUTHORITY_FIELDS: KenyaDraftAuthorityField[] = [
  {
    id: 'governingLaw',
    label: 'Governing Kenyan law',
    required: true,
    description: 'The Kenyan statutory or common-law basis governing the document.',
  },
  {
    id: 'authorityCheckedAt',
    label: 'Authority checked date',
    required: true,
    description: 'Date on which any legal authority used in the draft was checked for currency.',
  },
];

function entry(
  kind: string,
  documentKind: string,
  label: string,
  practiceArea: string,
  filing = true,
): KenyaDraftCatalogEntry {
  return {
    kind,
    documentKind,
    label,
    practiceArea,
    advocateReview: { status: 'pending' },
    requiredAuthorityFields: filing ? COURT_AUTHORITY_FIELDS : NON_FILING_AUTHORITY_FIELDS,
    verification: {
      jurisdiction: 'Kenya',
      authorityVerificationRequired: true,
      filingRequirementsVerificationRequired: true,
    },
  };
}

/** Initial Kenya drafting set. Review remains pending until an advocate records review metadata. */
export const KENYA_DRAFT_CATALOG: KenyaDraftCatalogEntry[] = [
  entry('kenya_civil_plaint', 'civil_plaint', 'Civil Plaint', 'litigation_disputes'),
  entry('kenya_notice_of_motion', 'notice_of_motion', 'Notice of Motion', 'litigation_disputes'),
  entry(
    'kenya_supporting_affidavit',
    'supporting_affidavit',
    'Supporting Affidavit',
    'litigation_disputes',
  ),
  entry(
    'kenya_memorandum_of_claim',
    'employment_claim',
    'Memorandum of Claim',
    'employment_labour',
  ),
  entry('kenya_demand_letter', 'demand_letter', 'Demand Letter', 'litigation_disputes', false),
];

export const KENYA_FORM_CATALOG_KIND = 'kenya_form_catalog';

const BY_KIND = new Map(KENYA_DRAFT_CATALOG.map((item) => [item.kind, item]));
const BY_DOCUMENT_KIND = new Map(
  KENYA_DRAFT_CATALOG.map((item) => [item.documentKind, item]),
);

export function getKenyaDraftCatalogEntry(kind?: string | null): KenyaDraftCatalogEntry | undefined {
  if (!kind) return undefined;
  return BY_KIND.get(kind) ?? BY_DOCUMENT_KIND.get(kind);
}

export function resolveKenyaDraftKind(documentKind: string): string {
  return getKenyaDraftCatalogEntry(documentKind)?.kind ?? KENYA_FORM_CATALOG_KIND;
}

export const KENYA_TEMPLATE_DEFS: TemplateDef[] = [
  {
    kind: 'civil_plaint',
    title: 'Civil Plaint',
    body:
      '<h2>IN THE {{courtStation}}</h2><p>Plaintiff: {{clientName}}</p><p>Defendant: {{respondentName}}</p><h3>Jurisdiction</h3><p>{{jurisdictionBasis}}</p><h3>Facts and cause of action</h3><p>{{factsOfCase}}</p><h3>Relief sought</h3><p>{{desiredOutcome}}</p><h3>Authority</h3><p>{{legalBasis}}</p>',
  },
  {
    kind: 'notice_of_motion',
    title: 'Notice of Motion',
    body:
      '<h2>IN THE {{courtStation}}</h2><p>TAKE NOTICE that the Court will be moved for the following orders:</p><p>{{desiredOutcome}}</p><h3>Grounds</h3><p>{{factsOfCase}}</p><h3>Authority</h3><p>{{legalBasis}}</p>',
  },
  {
    kind: 'supporting_affidavit',
    title: 'Supporting Affidavit',
    body:
      '<h2>IN THE {{courtStation}}</h2><p>I, {{clientName}}, of {{clientAddress}}, make oath and state:</p><p>{{factsOfCase}}</p><p>SWORN at {{swornAt}} on {{today}}.</p><p>Before a Commissioner for Oaths.</p><h3>Authority for application</h3><p>{{legalBasis}}</p>',
  },
  {
    kind: 'employment_claim',
    title: 'Memorandum of Claim',
    body:
      '<h2>IN THE EMPLOYMENT AND LABOUR RELATIONS COURT AT {{courtStation}}</h2><p>Claimant: {{clientName}}</p><p>Respondent: {{respondentName}}</p><h3>Material facts</h3><p>{{factsOfCase}}</p><h3>Legal basis</h3><p>{{legalBasis}}</p><h3>Reliefs sought</h3><p>{{desiredOutcome}}</p>',
  },
  {
    kind: 'demand_letter',
    title: 'Demand Letter',
    body:
      '<p>To: {{respondentName}}</p><p>We act for {{clientName}} regarding {{matterDescription}}.</p><p>{{factsOfCase}}</p><p>Our client demands {{desiredOutcome}} within {{noticePeriod}} days.</p><h3>Legal basis</h3><p>{{governingLaw}}</p>',
  },
];
