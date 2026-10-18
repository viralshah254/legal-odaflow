import { extractNamedStatuteQueries } from './named-statute-extract';
import type { ResearchTaskKind } from './research-planning.types';

const STRUCTURED_LABELS = [
  /\bcase\s+type\s*:/i,
  /\b(?:law|provision|statute)\s*:/i,
  /\bcourt\s*:/i,
  /\bstage\s*:/i,
  /\bissue\s*:/i,
  /\b(?:accused|complainant|petitioner|plaintiff|respondent|tenant|landlord)\s*:/i,
  /\boffences?\s*:/i,
  /\bpolice\s+station\s*:/i,
  /\bstatus\s*:/i,
];

/**
 * A labelled matter brief (Case Type / Law / Court / Issue) is an opinion on
 * those facts — not a case-survey or case-lookup, regardless of domain.
 */
export function isStructuredMatterBrief(text: string): boolean {
  const haystack = text.trim();
  if (!haystack) return false;
  const labelHits = STRUCTURED_LABELS.filter((pattern) => pattern.test(haystack)).length;
  if (labelHits >= 3) return true;
  const hasIssue =
    /\bissue\s*:/i.test(haystack) ||
    /\bwhether\b/i.test(haystack) ||
    /\bshould\s+(?:the|an?)\s+\w[\w\s]{0,40}\s+be\s+granted\b/i.test(haystack) ||
    /\bshould\s+be\s+granted\b/i.test(haystack);
  const hasNamedSection = /\b(?:section|article|§)\s*\d+/i.test(haystack);
  const hasNamedStatute = extractNamedStatuteQueries(haystack).length > 0;
  const hasForum =
    /\b(?:sessions|magistrate|high court|district|tribunal|commission|family court)\b/i.test(
      haystack,
    );
  return hasIssue && hasNamedSection && (hasForum || labelHits >= 2 || hasNamedStatute);
}

const MEMO_KINDS: ResearchTaskKind[] = [
  'GENERAL_RESEARCH',
  'MATTER_OPINION',
  'PROCEDURE',
  'STATUTORY_INTERPRETATION',
];

const EXPLICIT_CASE_ONLY_KINDS: ResearchTaskKind[] = [
  'CASE_LOOKUP',
  'CASE_COMPARISON',
];

/**
 * Replace the Answer with a case-evidence dead-end only for an explicit
 * find/compare-judgments task that has no statute pack. Connector failure is
 * not “no law.”
 */
export function shouldHardAbortOnMissingSimilarCases(input: {
  requireSimilarCases: boolean;
  similarCasesCount: number;
  taskKind: ResearchTaskKind;
  hasStatuteAuthorities: boolean;
  query: string;
}): boolean {
  if (!input.requireSimilarCases || input.similarCasesCount > 0) return false;
  if (input.hasStatuteAuthorities) return false;
  if (MEMO_KINDS.includes(input.taskKind)) return false;
  if (isStructuredMatterBrief(input.query)) return false;
  return EXPLICIT_CASE_ONLY_KINDS.includes(input.taskKind);
}
