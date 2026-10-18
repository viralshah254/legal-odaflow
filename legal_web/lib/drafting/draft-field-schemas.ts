/** Mirrors backend draft-field-schemas for client-side field visibility. */

export type DraftProfile = 'litigation' | 'agreement' | 'letter' | 'form'

export interface DraftFieldSchema {
  profile: DraftProfile
  showCourtName: boolean
  showOpposingParty: boolean
  caseDetailsLabel: string
  caseDetailsPlaceholder: string
  clientNameLabel: string
  clientNamePlaceholder: string
  courtNameLabel?: string
  opposingPartyLabel?: string
}

const AGREEMENT: DraftFieldSchema = {
  profile: 'agreement',
  showCourtName: false,
  showOpposingParty: false,
  caseDetailsLabel: 'Agreement details',
  caseDetailsPlaceholder:
    'Describe the parties, business purpose, key terms, jurisdiction, and any specific clauses you need…',
  clientNameLabel: 'Primary party name',
  clientNamePlaceholder: 'e.g. Viral Shah / ABC Pvt. Ltd.',
}

const LITIGATION: DraftFieldSchema = {
  profile: 'litigation',
  showCourtName: true,
  showOpposingParty: true,
  caseDetailsLabel: 'Case details / facts',
  caseDetailsPlaceholder:
    'Describe the facts, relevant dates, sections or provisions involved, and relief sought…',
  clientNameLabel: 'Client / petitioner name',
  clientNamePlaceholder: 'e.g. Ramesh Kumar s/o Suresh Kumar',
  courtNameLabel: 'Court name',
  opposingPartyLabel: 'Opposing party',
}

const LETTER: DraftFieldSchema = {
  profile: 'letter',
  showCourtName: false,
  showOpposingParty: false,
  caseDetailsLabel: 'Letter purpose & details',
  caseDetailsPlaceholder: 'Describe the purpose, recipient, key points, and desired tone…',
  clientNameLabel: 'Sender name',
  clientNamePlaceholder: 'e.g. ABC Pvt. Ltd.',
}

const FORM: DraftFieldSchema = {
  profile: 'form',
  showCourtName: false,
  showOpposingParty: false,
  caseDetailsLabel: 'Form details',
  caseDetailsPlaceholder: 'Describe the filing context, parties, and information to include…',
  clientNameLabel: 'Applicant / filer name',
  clientNamePlaceholder: 'e.g. John Smith',
}

const AGREEMENT_KINDS = new Set([
  'partnership_agreement',
  'partnership_deed',
  'service_agreement',
  'nda',
  'lease_agreement',
  'employment_contract',
  'shareholders_agreement',
  'llc_operating_agreement',
  'settlement_agreement',
  'sale_agreement',
  'construction_contract',
  'master_service_agreement',
  'licensing_agreement',
  'joint_venture_agreement',
  'franchise_agreement',
  'loan_agreement',
  'prenuptial_agreement',
  'share_purchase_agreement',
  'asset_purchase_agreement',
])

const LITIGATION_KINDS = new Set([
  'bail_application',
  'defense_memo',
  'plea_in_mitigation',
  'police_complaint',
  'particulars_of_claim',
  'appeal_grounds',
  'protective_injunction',
  'consent_order',
])

const LETTER_KINDS = new Set([
  'demand_letter',
  'engagement_letter',
  'grievance_letter',
  'representation_letter',
  'cover_letter',
  'appeal_letter',
  'termination_letter',
])

export function getDraftFieldSchema(documentKind?: string | null): DraftFieldSchema {
  const kind = (documentKind ?? '').toLowerCase()
  if (AGREEMENT_KINDS.has(kind)) return AGREEMENT
  if (LITIGATION_KINDS.has(kind)) return LITIGATION
  if (LETTER_KINDS.has(kind)) return LETTER
  // Research / strategy memos — keep court + parties visible
  if (/research_memo|case_strategy|legal_research/.test(kind)) return LITIGATION
  // Consumer / interim production — litigation-shaped fields
  if (/consumer|document_production/.test(kind)) return LITIGATION
  if (kind.includes('form') || kind.includes('petition') || kind.includes('application')) {
    return FORM
  }
  if (kind.includes('agreement') || kind.includes('contract') || kind.includes('deed')) {
    return AGREEMENT
  }
  return LITIGATION
}
