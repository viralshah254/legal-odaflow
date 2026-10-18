import { getCreditCost } from '@/ai-credits/credit-costs';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import {
  LEGAL_REPORT_SECTIONS,
  type LegalReportSectionTitle,
} from './legal-report-sections.constants';

const SECTION_CREDIT_OVERRIDES: Partial<Record<LegalReportSectionTitle, number>> = {
  'Draft Letter': 3,
  Sources: 1,
  Disclaimer: 0,
};

/** Default à la carte cost per report section (bundle remains CONSUMER_FULL_REPORT = 20). */
export function getReportSectionCreditCost(
  sectionTitle: LegalReportSectionTitle | string,
): number {
  const title = sectionTitle as LegalReportSectionTitle;
  if (SECTION_CREDIT_OVERRIDES[title] !== undefined) {
    return SECTION_CREDIT_OVERRIDES[title]!;
  }
  if (!LEGAL_REPORT_SECTIONS.includes(title)) {
    return getCreditCost(AI_TASK_TYPES.CONSUMER_REPORT_SECTION);
  }
  return getCreditCost(AI_TASK_TYPES.CONSUMER_REPORT_SECTION);
}

export function getReportSectionCreditCostsMap(): Record<string, number> {
  return Object.fromEntries(
    LEGAL_REPORT_SECTIONS.map((title) => [title, getReportSectionCreditCost(title)]),
  );
}

/** Sum of à la carte costs — should exceed full-report bundle for profitability. */
export function sumAlaCarteSectionCredits(): number {
  return LEGAL_REPORT_SECTIONS.reduce(
    (sum, title) => sum + getReportSectionCreditCost(title),
    0,
  );
}
