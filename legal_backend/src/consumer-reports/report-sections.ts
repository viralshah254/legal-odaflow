export const CONSUMER_FULL_REPORT_SECTIONS = [
  'Executive Summary',
  'Issue Overview',
  'Parties Involved',
  'Facts Summary',
  'Applicable Law',
  'Legal Analysis',
  'Strengths',
  'Weaknesses and Risks',
  'Potential Outcomes',
  'Recommended Next Steps',
  'Timeline Considerations',
  'Evidence Needed',
  'Questions for a Lawyer',
  'Cost and Time Estimates',
  'Disclaimer',
] as const;

export type ConsumerFullReportSection = (typeof CONSUMER_FULL_REPORT_SECTIONS)[number];
