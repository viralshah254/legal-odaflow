import type { LucideIcon } from "lucide-react"
import { BookOpen, Gavel, Scale, FileText, Briefcase, Users, Shield, Globe } from "lucide-react"

export type SectionFinderCountry = "IN" | "US" | "GB" | "KE"

export interface SectionFinderCategoryCard {
  title: string
  description: string
  icon: LucideIcon
  iconClass: string
  bgClass: string
}

export const US_STATE_OPTIONS: { code: string; name: string }[] = [
  { code: "FED", name: "Federal (all)" },
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
]

export const INDIA_CATEGORY_CARDS: SectionFinderCategoryCard[] = [
  {
    title: "IPC → BNS",
    description: "Substantive criminal offences renumbered under Bharatiya Nyaya Sanhita 2023.",
    icon: BookOpen,
    iconClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-100 dark:bg-indigo-950",
  },
  {
    title: "CrPC → BNSS",
    description: "Bail, FIR, remand, investigation, and trial procedure under the new Sanhita.",
    icon: Gavel,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-100 dark:bg-emerald-950",
  },
  {
    title: "IEA → BSA + special Acts",
    description: "Evidence, NI Act, POCSO, NDPS, PMLA, and other Acts that cross-reference the new codes.",
    icon: Scale,
    iconClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-100 dark:bg-violet-950",
  },
  {
    title: "Taxation",
    description: "Income-tax Act, CGST Act, IGST, Customs Act — penalty, ITC, reassessment, and evasion.",
    icon: FileText,
    iconClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-100 dark:bg-amber-950",
  },
  {
    title: "Corporate & Insolvency",
    description: "Companies Act, IBC, SEBI, PMLA, FEMA, and banking regulation statutes.",
    icon: Briefcase,
    iconClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-100 dark:bg-blue-950",
  },
  {
    title: "Labour & Employment",
    description: "Industrial Disputes, EPF, ESI, POSH, maternity benefit, and labour codes.",
    icon: Users,
    iconClass: "text-rose-600 dark:text-rose-400",
    bgClass: "bg-rose-100 dark:bg-rose-950",
  },
]

export const US_CATEGORY_CARDS: SectionFinderCategoryCard[] = [
  {
    title: "Employment Law",
    description: "FLSA, Title VII, ADA, FMLA, ERISA, and federal employment protections.",
    icon: Users,
    iconClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-100 dark:bg-blue-950",
  },
  {
    title: "Criminal Law",
    description: "18 U.S.C. federal offenses, RICO, wire fraud, CFAA, and sentencing provisions.",
    icon: Shield,
    iconClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-100 dark:bg-red-950",
  },
  {
    title: "Securities & Finance",
    description: "Securities Act 1933, Exchange Act 1934, Dodd-Frank, SOX, and Bankruptcy Code.",
    icon: Briefcase,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-100 dark:bg-emerald-950",
  },
  {
    title: "IP & Technology",
    description: "Patent Act, Copyright Act, Lanham Act, COPPA, CFAA, and trade secrets.",
    icon: FileText,
    iconClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-100 dark:bg-violet-950",
  },
  {
    title: "Civil Rights",
    description: "Civil Rights Act 1964, ADA, Fair Housing Act, and 42 U.S.C. § 1983.",
    icon: Scale,
    iconClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-100 dark:bg-indigo-950",
  },
  {
    title: "State Law",
    description: "Select a state below to look up California, New York, Texas, and other state codes.",
    icon: Globe,
    iconClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-100 dark:bg-amber-950",
  },
]

export const GB_CATEGORY_CARDS: SectionFinderCategoryCard[] = [
  {
    title: "Employment Law",
    description: "ERA 1996, Equality Act 2010, unfair dismissal and discrimination.",
    icon: Users,
    iconClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-100 dark:bg-blue-950",
  },
  {
    title: "Data Protection",
    description: "UK GDPR and Data Protection Act 2018 — breach notification and rights.",
    icon: Shield,
    iconClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-100 dark:bg-violet-950",
  },
  {
    title: "Housing & Property",
    description: "Tenancy deposits, possession claims, and conveyancing statutes.",
    icon: Briefcase,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-100 dark:bg-emerald-950",
  },
]

export const KE_CATEGORY_CARDS: SectionFinderCategoryCard[] = [
  {
    title: "Constitutional Law",
    description: "Constitution of Kenya 2010 — Bill of Rights, fair hearing, and constitutional petitions.",
    icon: Scale,
    iconClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-100 dark:bg-indigo-950",
  },
  {
    title: "Land & Property",
    description: "Land Act 2012, Land Registration Act, adverse possession, and title disputes.",
    icon: Briefcase,
    iconClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-100 dark:bg-amber-950",
  },
  {
    title: "Employment & Labour",
    description: "Employment Act 2007, Labour Relations Act, termination, redundancy, and ELRC practice.",
    icon: Users,
    iconClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-100 dark:bg-blue-950",
  },
  {
    title: "Criminal Law",
    description: "Penal Code (Cap 63), Criminal Procedure Code (Cap 75), and related offences.",
    icon: Shield,
    iconClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-100 dark:bg-red-950",
  },
  {
    title: "Corporate & Commercial",
    description: "Companies Act 2015, Insolvency Act 2015, contract, and commercial statutes.",
    icon: FileText,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-100 dark:bg-emerald-950",
  },
  {
    title: "Tax & Succession",
    description: "Income Tax Act (Cap 470), VAT Act 2013, and Law of Succession Act (Cap 160).",
    icon: Gavel,
    iconClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-100 dark:bg-violet-950",
  },
]

export function getSectionFinderMeta(country: SectionFinderCountry) {
  if (country === "US") {
    return {
      title: "US Section Finder",
      badge: "Federal + State Codes",
      flag: "🇺🇸",
      flagLabel: "United States",
      description:
        "Look up any section of US federal law — employment, criminal, IP, securities, civil rights, bankruptcy, immigration, and more. Select a state to look up California, New York, Texas, and other state codes from ingested bare-act sources.",
      placeholder: "e.g. \"207 FLSA\", \"Title VII sec 703\", \"11 USC 362\", \"12101 ADA\"…",
      categoryCards: US_CATEGORY_CARDS,
    }
  }
  if (country === "GB") {
    return {
      title: "UK Section Finder",
      badge: "England & Wales statutes",
      flag: "🇬🇧",
      flagLabel: "United Kingdom",
      description:
        "Look up UK statutes — employment (ERA 1996), data protection (DPA 2018), housing, and consumer law. Official text via legislation.gov.uk.",
      placeholder: 'e.g. "ERA 1996 s.98", "DPA 2018", "Housing Act 2004 deposit"…',
      categoryCards: GB_CATEGORY_CARDS,
    }
  }
  if (country === "KE") {
    return {
      title: "Kenya Section Finder",
      badge: "Kenya Law statutes",
      flag: "🇰🇪",
      flagLabel: "Kenya",
      description:
        "Look up Kenyan statutes — land (Land Registration Act 2012), employment, constitution, and commercial law.",
      placeholder: 'e.g. "Land Registration Act s.26", "Employment Act 2007"…',
      categoryCards: KE_CATEGORY_CARDS,
    }
  }
  return {
    title: "India Section Finder",
    badge: "All India Central Acts",
    flag: "🇮🇳",
    flagLabel: "India",
    description:
      "Look up any section of India's central statutes — criminal codes (BNS, BNSS, BSA; IPC, CrPC, IEA for legacy matters), taxation (Income-tax, CGST, Customs, GST Acts), corporate & commercial (Companies Act, IBC, SEBI, FEMA, PMLA), property, IP, family law, environment, labour, and all other central Acts. Get the 2023-code equivalent where applicable, punishment/penalty/bail posture, trial forum, and practical litigation notes.",
    placeholder: "e.g. \"420 IPC\", \"138 NI Act\", \"80C Income Tax\", \"16 CGST\", \"29 Contract Act\"…",
    categoryCards: INDIA_CATEGORY_CARDS,
  }
}
