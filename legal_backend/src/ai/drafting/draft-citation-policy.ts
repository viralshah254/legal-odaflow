import { isExpressIndiaDraftKind } from '@/ai/india-draft/india-draft-express';
import { isPoliceComplaintRegister } from '@/ai/drafting/draft-legal-register.service';
import { resolveDraftReadinessPolicy } from './playbooks/draft-readiness-policy';

const CONTRACT_KIND_PATTERN =
  /contract|agreement|nda|lease|deed|poa|partnership|mou|loan|offer_letter|appointment_letter|shareholders|share_purchase|service_agreement|employment_contract/i;

/** Dispute pleadings and applications that must cite verified case law. */
export function requiresCaseLawCitations(kind: string): boolean {
  return resolveDraftReadinessPolicy(kind).citationPolicy === 'case_law_required';
}

/** Pre-litigation notices: statute-first, but property disputes may cite landmark cases. */
export function isHybridNoticeWithCaseLaw(kind: string, caseDetails: string): boolean {
  if (!isExpressIndiaDraftKind(kind)) return false;
  const lower = caseDetails.toLowerCase();
  return (
    /\b(specific performance|agreement to sell|sale deed|immovable property|breach of contract)\b/i.test(
      lower,
    ) && /\b(notice|demand|legal notice)\b/i.test(kind)
  );
}

export function documentClassForKind(kind: string): 'contract' | 'pleading' {
  return CONTRACT_KIND_PATTERN.test(kind) ? 'contract' : 'pleading';
}

export function caseLawPromptBlock(kind: string): string {
  if (!requiresCaseLawCitations(kind)) return '';
  return [
    'DOCUMENT CLASS: Civil/criminal pleading or application (NOT a contract).',
    'Every legal ground MUST cite at least one authority from the VERIFIED AUTHORITIES block.',
    'Do NOT invent AIR, SCC, or neutral citations outside that block.',
  ].join('\n');
}

/** When knowledgeSources is omitted, all tiers are queried (legacy behavior). */
export function wantsKnowledgeSource(
  sources: string[] | undefined,
  source: string,
): boolean {
  if (!sources?.length) return true;
  return sources.includes(source);
}

export function wantsCaseLaw(sources?: string[]): boolean {
  return wantsKnowledgeSource(sources, 'case_law');
}

/** US filing-grade kinds that benefit from case-law grounding. */
export function isFilingGradeDraftKind(kind: string): boolean {
  return resolveDraftReadinessPolicy(kind).filingGrade;
}

function isSkipByDefaultCaseLawKind(kind: string, isContract?: boolean): boolean {
  if (isContract || CONTRACT_KIND_PATTERN.test(kind)) return true;
  if (isExpressIndiaDraftKind(kind)) return true;
  if (isPoliceComplaintRegister(kind)) return true;
  if (/fir_complaint|police_complaint|criminal_complaint/i.test(kind)) return true;
  return false;
}

/**
 * Whether to run case-law retrieval for a draft path.
 * Respects knowledgeSources picker and document-kind safety rules.
 */
export function shouldRetrieveCaseLawForDraft(
  kind: string,
  knowledgeSources?: string[],
  options?: { filingGrade?: boolean; isContract?: boolean; caseDetails?: string },
): boolean {
  const policy = resolveDraftReadinessPolicy(kind);
  if (policy.citationPolicy === 'case_law_required') return true;
  if (policy.citationPolicy === 'none' || policy.citationPolicy === 'statutes_only') {
    return Boolean(
      knowledgeSources?.includes('case_law') &&
        options?.caseDetails &&
        isHybridNoticeWithCaseLaw(kind, options.caseDetails),
    );
  }
  if (!wantsCaseLaw(knowledgeSources)) return false;

  const filingGrade = options?.filingGrade ?? isFilingGradeDraftKind(kind);
  if (requiresCaseLawCitations(kind) || filingGrade) return true;

  if (
    options?.caseDetails &&
    isHybridNoticeWithCaseLaw(kind, options.caseDetails)
  ) {
    return true;
  }

  if (isSkipByDefaultCaseLawKind(kind, options?.isContract)) {
    // Only retrieve when user explicitly passed sources including case_law
    return Boolean(knowledgeSources?.length && knowledgeSources.includes('case_law'));
  }

  return true;
}
