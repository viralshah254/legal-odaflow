export const ISSUE_CHECKER_TYPES = [
  'Employment & Workplace',
  'Landlord & Tenant',
  'Family & Divorce',
  'Consumer Rights',
  'Contract Dispute',
  'Debt & Collections',
  'Criminal Matter',
  'Immigration',
  'Other',
] as const;

export type IssueCheckerType = (typeof ISSUE_CHECKER_TYPES)[number];

export const ISSUE_CHECKER_MODES = ['SELF', 'FIRM_INTAKE'] as const;

export type IssueCheckerMode = (typeof ISSUE_CHECKER_MODES)[number];
