// Canonical matter types — must match backend src/config/matter-types.ts
export const MATTER_TYPES = {
  LITIGATION: "Litigation",
  TRANSACTION: "Transaction",
  ADVISORY: "Advisory",
  DISPUTE: "Dispute",
  REGISTRATION: "Registration",
  COMPLIANCE: "Compliance",
  DRAFTING: "Drafting",
} as const

export type MatterTypeValue = (typeof MATTER_TYPES)[keyof typeof MATTER_TYPES]

export interface MatterTypeOption {
  value: MatterTypeValue
  label: string
  description: string
  icon: string
}

export const MATTER_TYPE_OPTIONS: MatterTypeOption[] = [
  {
    value: "Litigation",
    label: "Litigation",
    description: "Court proceedings, hearings, trials",
    icon: "⚖️",
  },
  {
    value: "Transaction",
    label: "Transaction",
    description: "M&A, conveyancing, commercial deals",
    icon: "🤝",
  },
  {
    value: "Advisory",
    label: "Advisory",
    description: "Legal opinion, advice note, memo",
    icon: "💡",
  },
  {
    value: "Dispute",
    label: "Dispute",
    description: "ADR, arbitration, mediation, negotiation",
    icon: "🔄",
  },
  {
    value: "Registration",
    label: "Registration",
    description: "IP, company, property registration",
    icon: "📋",
  },
  {
    value: "Compliance",
    label: "Compliance",
    description: "Regulatory, tax, corporate governance",
    icon: "✅",
  },
  {
    value: "Drafting",
    label: "Drafting",
    description: "Contracts, wills, deeds, policies",
    icon: "📝",
  },
]

// Practice areas — slugs must match backend src/config/practice-areas.ts
export interface PracticeAreaConfig {
  slug: string
  label: string
  matterTypes: MatterTypeValue[]
  defaultMatterType: MatterTypeValue
}

export const PRACTICE_AREA_CONFIGS: PracticeAreaConfig[] = [
  {
    slug: "litigation_disputes",
    label: "Litigation & Disputes",
    matterTypes: ["Litigation", "Dispute", "Advisory"],
    defaultMatterType: "Litigation",
  },
  {
    slug: "corporate_commercial",
    label: "Corporate & Commercial",
    matterTypes: ["Transaction", "Drafting", "Compliance", "Advisory"],
    defaultMatterType: "Transaction",
  },
  {
    slug: "real_estate_property",
    label: "Real Estate & Property",
    matterTypes: ["Transaction", "Drafting", "Advisory"],
    defaultMatterType: "Transaction",
  },
  {
    slug: "family_matrimonial",
    label: "Family & Matrimonial",
    matterTypes: ["Litigation", "Dispute", "Advisory"],
    defaultMatterType: "Litigation",
  },
  {
    slug: "criminal_defense",
    label: "Criminal Defense",
    matterTypes: ["Litigation", "Advisory"],
    defaultMatterType: "Litigation",
  },
  {
    slug: "employment_labour",
    label: "Employment & Labour",
    matterTypes: ["Dispute", "Litigation", "Advisory"],
    defaultMatterType: "Dispute",
  },
  {
    slug: "immigration",
    label: "Immigration",
    matterTypes: ["Registration", "Advisory"],
    defaultMatterType: "Registration",
  },
  {
    slug: "intellectual_property",
    label: "Intellectual Property",
    matterTypes: ["Registration", "Drafting", "Advisory"],
    defaultMatterType: "Registration",
  },
  {
    slug: "tax",
    label: "Tax",
    matterTypes: ["Compliance", "Advisory"],
    defaultMatterType: "Compliance",
  },
  {
    slug: "wills_estates_probate",
    label: "Wills, Estates & Probate",
    matterTypes: ["Drafting", "Advisory"],
    defaultMatterType: "Drafting",
  },
]

export function getPracticeAreaConfig(slug: string): PracticeAreaConfig | undefined {
  return PRACTICE_AREA_CONFIGS.find((pa) => pa.slug === slug)
}

export function getMatterTypeOption(value: string): MatterTypeOption | undefined {
  return MATTER_TYPE_OPTIONS.find((mt) => mt.value === value)
}

// Conditional field visibility helpers

/** Opposing party field — shown for adversarial matter types */
export function showsOpposingParty(matterType: string): boolean {
  return matterType === "Litigation" || matterType === "Dispute"
}

/** Court fields (court name, level, case number) — litigation proceedings only */
export function showsCourtFields(matterType: string): boolean {
  return matterType === "Litigation"
}

/** Legal form/template picker — document-production matter types */
export function showsFormPicker(matterType: string): boolean {
  return (
    matterType === "Drafting" ||
    matterType === "Transaction" ||
    matterType === "Registration" ||
    matterType === "Compliance"
  )
}

/** Desired outcome field — shown for adversarial/advisory matters */
export function showsDesiredOutcome(matterType: string): boolean {
  return matterType === "Litigation" || matterType === "Dispute" || matterType === "Advisory"
}

export const COURT_LEVEL_OPTIONS = [
  { value: "magistrate", label: "Magistrate Court" },
  { value: "high", label: "High Court" },
  { value: "appeal", label: "Court of Appeal" },
  { value: "supreme", label: "Supreme Court" },
  { value: "tribunal", label: "Tribunal" },
  { value: "arbitration", label: "Arbitration Panel" },
  { value: "other", label: "Other" },
]
