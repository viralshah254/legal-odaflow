export type KycDocType =
  | "ID_PASSPORT"
  | "PROOF_OF_ADDRESS"
  | "COMPANY_REGISTRATION"
  | "KRA_PIN"
  | "CR12"
  | "DIRECTOR_IDS"
  | "PARTNERSHIP_DEED"
  | "NGO_REGISTRATION"
  | "BANK_STATEMENT"
  | "OTHER"

export type KycDocStatus = "MISSING" | "RECEIVED" | "VERIFIED" | "EXPIRED"

export interface KycDocument {
  id: string
  docType: KycDocType
  fileName?: string
  uploadedAt?: Date
  expiryDate?: Date
  status: KycDocStatus
  verifiedBy?: string
  verifiedByName?: string
  verifiedAt?: Date
  notes?: string
}

export interface KycChecklist {
  clientId: string
  documents: KycDocument[]
  completed: boolean
  lastUpdated: Date
}

export const getKycDocTypeLabel = (type: KycDocType): string => {
  const labels: Record<KycDocType, string> = {
    ID_PASSPORT: "ID/Passport",
    PROOF_OF_ADDRESS: "Proof of Address",
    COMPANY_REGISTRATION: "Company Registration",
    KRA_PIN: "KRA PIN Certificate",
    CR12: "CR12 Form",
    DIRECTOR_IDS: "Director IDs",
    PARTNERSHIP_DEED: "Partnership Deed",
    NGO_REGISTRATION: "NGO Registration",
    BANK_STATEMENT: "Bank Statement",
    OTHER: "Other Document",
  }
  return labels[type]
}

export const getRequiredKycDocsForClientType = (clientType: string): KycDocType[] => {
  switch (clientType) {
    case "Individual":
      return ["ID_PASSPORT", "PROOF_OF_ADDRESS", "KRA_PIN"]
    case "Company":
      return ["COMPANY_REGISTRATION", "CR12", "DIRECTOR_IDS", "KRA_PIN"]
    case "NGO":
      return ["NGO_REGISTRATION", "DIRECTOR_IDS", "KRA_PIN"]
    case "Partnership":
      return ["PARTNERSHIP_DEED", "DIRECTOR_IDS", "KRA_PIN"]
    default:
      return ["ID_PASSPORT", "PROOF_OF_ADDRESS"]
  }
}

