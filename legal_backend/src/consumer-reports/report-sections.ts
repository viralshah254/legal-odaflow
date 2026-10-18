import {
  LEGAL_REPORT_SECTIONS,
  type LegalReportSectionTitle,
} from './legal-report-sections.constants';

export { LEGAL_REPORT_SECTIONS, type LegalReportSectionTitle };

/** @deprecated Use LEGAL_REPORT_SECTIONS */
export const CONSUMER_FULL_REPORT_SECTIONS = LEGAL_REPORT_SECTIONS;

export type ConsumerFullReportSection = LegalReportSectionTitle;
