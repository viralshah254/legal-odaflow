import { INDIA_DRAFT_FORMATS, type IndiaDraftCategory } from "./formats"
import { getDraftFieldSchema } from "@/lib/drafting/draft-field-schemas"

export interface DraftFieldConfig {
  caseDetailsLabel: string
  caseDetailsPlaceholder: string

  clientNameLabel: string
  clientNamePlaceholder: string

  showCourtName: boolean
  courtNameLabel: string
  courtNamePlaceholder: string

  showOpposingParty: boolean
  opposingPartyLabel: string
  opposingPartyPlaceholder: string
}

const DEFAULT_FIELD_CONFIG: DraftFieldConfig = {
  caseDetailsLabel: "Case details / facts",
  caseDetailsPlaceholder:
    "Describe the facts, relevant dates, sections or provisions involved, and any grounds or relief you want emphasised…",

  clientNameLabel: "Client name",
  clientNamePlaceholder: "e.g. Ramesh Kumar s/o Suresh Kumar",

  showCourtName: true,
  courtNameLabel: "Court name",
  courtNamePlaceholder: "e.g. Sessions Court, Delhi",

  showOpposingParty: true,
  opposingPartyLabel: "Opposing party",
  opposingPartyPlaceholder: "e.g. State of Delhi / Sita Devi",
}

type DraftCategory = Exclude<IndiaDraftCategory, "All">

export const CATEGORY_FIELD_CONFIG: Record<DraftCategory, DraftFieldConfig> = {
  Bail: {
    caseDetailsLabel: "Case details / facts",
    caseDetailsPlaceholder:
      "Describe the facts: who was arrested, when, under which sections, any prior bail history, FIR number, relevant dates, and any grounds you want emphasised…",
    clientNameLabel: "Accused name",
    clientNamePlaceholder: "e.g. Ramesh Kumar s/o Suresh Kumar",
    showCourtName: true,
    courtNameLabel: "Court name",
    courtNamePlaceholder: "e.g. Sessions Court, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Complainant / State",
    opposingPartyPlaceholder: "e.g. State of Delhi / Sita Devi",
  },

  Criminal: {
    caseDetailsLabel: "Case details / facts",
    caseDetailsPlaceholder:
      "Describe the facts: FIR number, sections charged, arrest or investigation details, prior proceedings, and the relief sought…",
    clientNameLabel: "Accused / Petitioner name",
    clientNamePlaceholder: "e.g. Ramesh Kumar s/o Suresh Kumar",
    showCourtName: true,
    courtNameLabel: "Court name",
    courtNamePlaceholder: "e.g. Sessions Court, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Complainant / Prosecution",
    opposingPartyPlaceholder: "e.g. State of Delhi / Inspector, Crime Branch",
  },

  Civil: {
    caseDetailsLabel: "Case details / facts",
    caseDetailsPlaceholder:
      "Describe the cause of action, contract or dispute background, amounts or property involved, prior notices, and relief sought…",
    clientNameLabel: "Plaintiff / Petitioner name",
    clientNamePlaceholder: "e.g. ABC Pvt. Ltd. / Ramesh Kumar",
    showCourtName: true,
    courtNameLabel: "Court name",
    courtNamePlaceholder: "e.g. District Court, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Defendant / Respondent",
    opposingPartyPlaceholder: "e.g. XYZ Ltd. / Sita Devi",
  },

  Family: {
    caseDetailsLabel: "Case details / facts",
    caseDetailsPlaceholder:
      "Describe the marriage or family background, children (if any), grounds for relief, maintenance or custody issues, and relevant dates…",
    clientNameLabel: "Petitioner name",
    clientNamePlaceholder: "e.g. Sita Devi w/o Ramesh Kumar",
    showCourtName: true,
    courtNameLabel: "Court name",
    courtNamePlaceholder: "e.g. Family Court, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent name",
    opposingPartyPlaceholder: "e.g. Ramesh Kumar s/o Suresh Kumar",
  },

  Constitutional: {
    caseDetailsLabel: "Case details / facts",
    caseDetailsPlaceholder:
      "Describe the impugned action or order, constitutional grounds, relevant articles, prior representations, and relief sought…",
    clientNameLabel: "Petitioner name",
    clientNamePlaceholder: "e.g. Ramesh Kumar / ABC Association",
    showCourtName: true,
    courtNameLabel: "Court name",
    courtNamePlaceholder: "e.g. High Court of Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent / Authority",
    opposingPartyPlaceholder: "e.g. Union of India / State of Delhi",
  },

  Consumer: {
    caseDetailsLabel: "Complaint details / facts",
    caseDetailsPlaceholder:
      "Describe the product or service, deficiency or unfair trade practice, purchase date, prior complaints, and relief sought…",
    clientNameLabel: "Complainant name",
    clientNamePlaceholder: "e.g. Ramesh Kumar, Consumer",
    showCourtName: true,
    courtNameLabel: "Consumer Forum / NCDRC",
    courtNamePlaceholder: "e.g. District Consumer Forum, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Opposite party",
    opposingPartyPlaceholder: "e.g. ABC Electronics Pvt. Ltd.",
  },

  Research: {
    caseDetailsLabel: "Matter facts / research brief",
    caseDetailsPlaceholder:
      "Describe the facts, issues to research, jurisdiction, parties, and any authorities or constraints to emphasise…",
    clientNameLabel: "Client / complainant name",
    clientNamePlaceholder: "e.g. Riya Desai",
    showCourtName: true,
    courtNameLabel: "Forum / Court",
    courtNamePlaceholder: "e.g. District Consumer Disputes Redressal Commission, Ahmedabad",
    showOpposingParty: true,
    opposingPartyLabel: "Opposite parties",
    opposingPartyPlaceholder: "e.g. Hospital; Surgeon; Insurer",
  },

  Procedural: {
    caseDetailsLabel: "Application details / facts",
    caseDetailsPlaceholder:
      "Describe the underlying proceedings, procedural issue, relevant orders or dates, and the relief sought…",
    clientNameLabel: "Applicant name",
    clientNamePlaceholder: "e.g. Ramesh Kumar / ABC Pvt. Ltd.",
    showCourtName: true,
    courtNameLabel: "Court / Tribunal",
    courtNamePlaceholder: "e.g. District Court, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent / Opposite party",
    opposingPartyPlaceholder: "e.g. XYZ Ltd. / State of Delhi",
  },

  Conveyancing: {
    caseDetailsLabel: "Transaction & property details",
    caseDetailsPlaceholder:
      "Describe the property (address, survey/khasra details), consideration amount, parties' relationship, encumbrances, and any special terms…",
    clientNameLabel: "Seller / Transferor",
    clientNamePlaceholder: "e.g. Ramesh Kumar s/o Suresh Kumar",
    showCourtName: false,
    courtNameLabel: "Court name",
    courtNamePlaceholder: "",
    showOpposingParty: true,
    opposingPartyLabel: "Buyer / Transferee",
    opposingPartyPlaceholder: "e.g. Sita Devi w/o Ramesh Kumar",
  },

  Tax: {
    caseDetailsLabel: "Assessment & dispute details",
    caseDetailsPlaceholder:
      "Describe the assessment year, notice or order details, disputed amount, grounds of appeal, and prior proceedings…",
    clientNameLabel: "Assessee / Appellant",
    clientNamePlaceholder: "e.g. ABC Pvt. Ltd. / Ramesh Kumar",
    showCourtName: true,
    courtNameLabel: "Tribunal / Authority",
    courtNamePlaceholder: "e.g. ITAT, Delhi Bench / GST Appellate Tribunal",
    showOpposingParty: false,
    opposingPartyLabel: "Opposing party",
    opposingPartyPlaceholder: "",
  },

  Commercial: {
    caseDetailsLabel: "Commercial dispute details",
    caseDetailsPlaceholder:
      "Describe the contract or transaction, breach or dispute, amounts involved, prior notices, and relief sought…",
    clientNameLabel: "Claimant / Applicant",
    clientNamePlaceholder: "e.g. ABC Pvt. Ltd.",
    showCourtName: true,
    courtNameLabel: "Court / Tribunal",
    courtNamePlaceholder: "e.g. Commercial Court, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent / Opposite party",
    opposingPartyPlaceholder: "e.g. XYZ Ltd.",
  },

  Estates: {
    caseDetailsLabel: "Estate & testamentary details",
    caseDetailsPlaceholder:
      "Describe the deceased's details, date of death, assets, beneficiaries, will details (if any), and the relief sought…",
    clientNameLabel: "Testator / Applicant",
    clientNamePlaceholder: "e.g. Ramesh Kumar (deceased) / Sita Devi (executor)",
    showCourtName: true,
    courtNameLabel: "Court (probate)",
    courtNamePlaceholder: "e.g. District Court, Delhi",
    showOpposingParty: false,
    opposingPartyLabel: "Opposing party",
    opposingPartyPlaceholder: "",
  },

  Labour: {
    caseDetailsLabel: "Employment dispute details",
    caseDetailsPlaceholder:
      "Describe the employment relationship, termination or dispute details, service period, wages or benefits involved, and relief sought…",
    clientNameLabel: "Employee / Applicant",
    clientNamePlaceholder: "e.g. Ramesh Kumar, Workman",
    showCourtName: true,
    courtNameLabel: "Labour Tribunal / Court",
    courtNamePlaceholder: "e.g. Industrial Tribunal, Delhi",
    showOpposingParty: true,
    opposingPartyLabel: "Employer / Respondent",
    opposingPartyPlaceholder: "e.g. ABC Industries Pvt. Ltd.",
  },

  Arbitration: {
    caseDetailsLabel: "Dispute & arbitration details",
    caseDetailsPlaceholder:
      "Describe the underlying contract, dispute, arbitration clause, prior notices under §21, and relief or claim amount…",
    clientNameLabel: "Claimant",
    clientNamePlaceholder: "e.g. ABC Pvt. Ltd.",
    showCourtName: true,
    courtNameLabel: "Arbitral Tribunal",
    courtNamePlaceholder: "e.g. Sole Arbitrator / LCIA / DIAC",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent",
    opposingPartyPlaceholder: "e.g. XYZ Ltd.",
  },

  Insolvency: {
    caseDetailsLabel: "Insolvency proceedings details",
    caseDetailsPlaceholder:
      "Describe the corporate debtor, default amount, CIRP or liquidation stage, prior notices, and relief sought…",
    clientNameLabel: "Applicant / Corporate Debtor",
    clientNamePlaceholder: "e.g. ABC Pvt. Ltd. / Financial Creditor",
    showCourtName: true,
    courtNameLabel: "NCLT / NCLAT",
    courtNamePlaceholder: "e.g. NCLT, New Delhi Bench",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent / Resolution Professional",
    opposingPartyPlaceholder: "e.g. XYZ Ltd. / RP Name",
  },

  IP: {
    caseDetailsLabel: "IP dispute details",
    caseDetailsPlaceholder:
      "Describe the trademark, patent, or copyright involved, infringement or opposition grounds, registration details, and relief sought…",
    clientNameLabel: "Applicant / Proprietor",
    clientNamePlaceholder: "e.g. ABC Brands Pvt. Ltd.",
    showCourtName: true,
    courtNameLabel: "Court / IP Office",
    courtNamePlaceholder: "e.g. High Court of Delhi / IPAB",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent / Opposite party",
    opposingPartyPlaceholder: "e.g. XYZ Traders",
  },

  Regulatory: {
    caseDetailsLabel: "Regulatory matter details",
    caseDetailsPlaceholder:
      "Describe the regulatory action or compliance issue, relevant statutes or notifications, prior correspondence, and relief sought…",
    clientNameLabel: "Applicant / Licensee",
    clientNamePlaceholder: "e.g. ABC Pvt. Ltd.",
    showCourtName: true,
    courtNameLabel: "Authority / Tribunal",
    courtNamePlaceholder: "e.g. SEBI / TRAI / CERC",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent / Regulator",
    opposingPartyPlaceholder: "e.g. SEBI / Department of Telecommunications",
  },

  NRI: {
    caseDetailsLabel: "NRI client & transaction details",
    caseDetailsPlaceholder:
      "Describe the NRI/OCI client status, property or asset details, FEMA/RBI compliance context, repatriation needs, and relief sought…",
    clientNameLabel: "NRI / OCI client name",
    clientNamePlaceholder: "e.g. Rajesh Kumar (NRI, USA resident)",
    showCourtName: true,
    courtNameLabel: "Court / Authority",
    courtNamePlaceholder: "e.g. District Court, Ahmedabad / RBI Regional Office",
    showOpposingParty: true,
    opposingPartyLabel: "Opposite party / Authority",
    opposingPartyPlaceholder: "e.g. Builder / Revenue Authority",
  },

  International: {
    caseDetailsLabel: "Cross-border dispute details",
    caseDetailsPlaceholder:
      "Describe parallel foreign proceedings, arbitration seat, governing law, anti-suit or enforcement context, and relief sought…",
    clientNameLabel: "Applicant / Claimant",
    clientNamePlaceholder: "e.g. ABC India Pvt. Ltd. / Foreign Co.",
    showCourtName: true,
    courtNameLabel: "Court / Seat of arbitration",
    courtNamePlaceholder: "e.g. High Court of Gujarat / London-seated tribunal",
    showOpposingParty: true,
    opposingPartyLabel: "Respondent / Foreign party",
    opposingPartyPlaceholder: "e.g. XYZ Ltd. (UK) / Foreign claimant",
  },
}

export function getFieldConfig(category?: string | null): DraftFieldConfig {
  if (!category) return DEFAULT_FIELD_CONFIG
  const config = CATEGORY_FIELD_CONFIG[category as DraftCategory]
  return config ?? DEFAULT_FIELD_CONFIG
}

/** Resolve field config from URL category, documentKind, or kind lookup in formats catalog. */
export function resolveFieldConfig(
  kind?: string,
  category?: string | null,
  documentKind?: string | null,
): DraftFieldConfig {
  const fromKind = kind
    ? getFieldConfig(INDIA_DRAFT_FORMATS.find((f) => f.id === kind)?.category ?? null)
    : DEFAULT_FIELD_CONFIG
  const base = category ? getFieldConfig(category) : fromKind

  if (!documentKind) return base

  // documentKind schema only controls visibility — keep category/kind labels
  // (otherwise Research/Consumer become generic "Opposing party" / petitioner).
  const schema = getDraftFieldSchema(documentKind)
  return {
    ...base,
    showCourtName: schema.showCourtName,
    showOpposingParty: schema.showOpposingParty,
  }
}
