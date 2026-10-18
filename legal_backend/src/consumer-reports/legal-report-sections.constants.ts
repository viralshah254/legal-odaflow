/** Fifteen-section consumer legal report (matches legal_web/lib/legal/report-sections.ts). */
export const LEGAL_REPORT_SECTIONS = [
  'Executive Summary',
  'Situation Summary',
  'Legal Issue Classification',
  'Jurisdiction Context',
  'Relevant Legal Principles',
  'Strengths',
  'Risks',
  'Evidence Needed',
  'Options',
  'Suggested Next Steps',
  'Questions to Ask a Lawyer',
  'Draft Letter',
  'Timeline & Deadlines',
  'Sources',
  'Disclaimer',
] as const;

export type LegalReportSectionTitle = (typeof LEGAL_REPORT_SECTIONS)[number];
