export const ISSUE_CHECKER_TYPES = [
  // Original categories
  'Employment & Workplace',
  'Landlord & Tenant',
  'Family & Divorce',
  'Consumer Rights',
  'Contract Dispute',
  'Contract & Document Drafting',
  'Debt & Collections',
  'Criminal Matter',
  'Immigration',
  // Expanded categories — full practice area coverage
  'Corporate & Commercial',
  'Real Estate & Conveyancing',
  'Intellectual Property',
  'Tax & Revenue',
  'Wills, Estates & Probate',
  'Other',
] as const;

export type IssueCheckerType = (typeof ISSUE_CHECKER_TYPES)[number];

/** Map issue checker type to firm practice area slug */
export const ISSUE_TYPE_TO_PRACTICE_AREA: Record<IssueCheckerType, string> = {
  'Employment & Workplace': 'employment_labour',
  'Landlord & Tenant': 'real_estate_property',
  'Family & Divorce': 'family_matrimonial',
  'Consumer Rights': 'litigation_disputes',
  'Contract Dispute': 'litigation_disputes',
  'Contract & Document Drafting': 'corporate_commercial',
  'Debt & Collections': 'litigation_disputes',
  'Criminal Matter': 'criminal_defense',
  'Immigration': 'immigration',
  'Corporate & Commercial': 'corporate_commercial',
  'Real Estate & Conveyancing': 'real_estate_property',
  'Intellectual Property': 'intellectual_property',
  'Tax & Revenue': 'tax',
  'Wills, Estates & Probate': 'wills_estates_probate',
  'Other': 'litigation_disputes',
};

export const ISSUE_CHECKER_MODES = ['SELF', 'FIRM_INTAKE'] as const;

export type IssueCheckerMode = (typeof ISSUE_CHECKER_MODES)[number];

/** High-level intent that controls preview prompt and lead workspace UI. */
export const INTAKE_INTENTS = ['TRANSACTIONAL_DRAFT', 'DISPUTE_ADVISORY', 'GENERAL_ADVISORY'] as const;
export type IntakeIntent = (typeof INTAKE_INTENTS)[number];

/** Issue types that always route to drafting workflow. */
const TRANSACTIONAL_ISSUE_TYPES: ReadonlySet<string> = new Set([
  'Contract & Document Drafting',
  'Corporate & Commercial',
  'Real Estate & Conveyancing',
  'Wills, Estates & Probate',
]);

/** Issue types that always route to dispute/advisory workflow. */
const DISPUTE_ISSUE_TYPES: ReadonlySet<string> = new Set([
  'Employment & Workplace',
  'Landlord & Tenant',
  'Family & Divorce',
  'Consumer Rights',
  'Contract Dispute',
  'Debt & Collections',
  'Criminal Matter',
  'Immigration',
]);

/**
 * Keyword pattern that, when present in the free-text facts, promotes the
 * intake to TRANSACTIONAL_DRAFT even if the classified issue type doesn't.
 */
const DRAFTING_KEYWORDS_RE =
  /\b(draft|drafting|write|prepare|create|draw up|template|generate)\b.{0,40}\b(contract|agreement|nda|lease|employment|partnership|document|deed|will|testament)\b|\b(contract|agreement|nda|lease|employment|partnership|document|deed|will|testament)\b.{0,40}\b(draft|drafting|write|prepare|create|draw up|template|generate)\b/i;

type IntakeProfile = { nature?: 'dispute' | 'transaction' | 'compliance' | 'advisory' | 'unknown' };

function intakeIntentFromNature(nature: IntakeProfile['nature']): IntakeIntent | undefined {
  switch (nature) {
    case 'transaction':
      return 'TRANSACTIONAL_DRAFT';
    case 'dispute':
      return 'DISPUTE_ADVISORY';
    case 'compliance':
    case 'advisory':
      return 'GENERAL_ADVISORY';
    default:
      return undefined;
  }
}

/**
 * Derive the intake intent from the classified issue type and optional free-text facts.
 * When a MatterProfile (or nature) is supplied, intent is derived from profile.nature first.
 * The result controls which preview prompt and lead-workspace UI branch is used.
 */
export function getIntakeIntent(
  issueType?: string,
  facts?: string,
  profile?: IntakeProfile,
): IntakeIntent {
  const fromProfile = profile?.nature ? intakeIntentFromNature(profile.nature) : undefined;
  if (fromProfile) return fromProfile;

  if (!issueType && !facts) return 'GENERAL_ADVISORY';
  const type = issueType ?? '';

  if (TRANSACTIONAL_ISSUE_TYPES.has(type)) return 'TRANSACTIONAL_DRAFT';
  if (facts && DRAFTING_KEYWORDS_RE.test(facts)) return 'TRANSACTIONAL_DRAFT';
  if (DISPUTE_ISSUE_TYPES.has(type)) return 'DISPUTE_ADVISORY';
  return 'GENERAL_ADVISORY';
}

/** Locale-aware heuristic fallbacks when AI providers are unavailable. */
export {
  getClassifyFallbackOutcomes,
  getClassifyFallbackQuestions,
  getGenericOutcomeOptionsFallback,
  getPlanQuestionsFallback,
} from './issue-checker.fallbacks';
