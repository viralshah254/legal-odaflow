import { LEGAL_REPORT_SECTIONS, type LegalReportSectionTitle } from "./report-sections"

/** Mirrors backend report-section-credit-costs.ts (à la carte vs 20-credit bundle). */
const SECTION_CREDIT_OVERRIDES: Partial<Record<LegalReportSectionTitle, number>> = {
  "Draft Letter": 3,
  Sources: 1,
  Disclaimer: 0,
}

const DEFAULT_SECTION_CREDITS = 2
export const CONSUMER_FULL_REPORT_BUNDLE_CREDITS = 20

export function getReportSectionCreditCost(
  sectionTitle: LegalReportSectionTitle | string,
): number {
  const title = sectionTitle as LegalReportSectionTitle
  if (SECTION_CREDIT_OVERRIDES[title] !== undefined) {
    return SECTION_CREDIT_OVERRIDES[title]!
  }
  if (!LEGAL_REPORT_SECTIONS.includes(title)) {
    return DEFAULT_SECTION_CREDITS
  }
  return DEFAULT_SECTION_CREDITS
}

export function sumAlaCarteSectionCredits(): number {
  return LEGAL_REPORT_SECTIONS.reduce(
    (sum, title) => sum + getReportSectionCreditCost(title),
    0,
  )
}
