import { Injectable } from '@nestjs/common';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { StructuredLegalQueryContext } from '@/legal-search/legal-retrieval.types';
import { assessCandidateRelevance } from '@/legal-search/retrieval-relevance';
import { extractStatuteReferences } from '@/ai/citations/statute-reference';
import type {
  SimilarCase,
  CaseVerificationStatus,
  SimilarCasesSearchOutcome,
} from './similar-cases.types';

const STATUTE_TITLE_PATTERN =
  /\b(Act|Code|Rules?|Regulation|Ordinance|Constitution|Appendix)\b/i;
const STATUTE_SECTION_PATTERN =
  /\b(?:s\.?|sec\.?|section|§)\s*\d+[A-Za-z]?\b|\barticle\s+\d+/i;

/** True when the authority is clearly legislation / constitutional material, not a judgment. */
export function isStatuteAuthority(a: RetrievedAuthority): boolean {
  const tier = (a.sourceTier ?? '').toLowerCase();
  const type = (a.authorityType ?? '').toUpperCase();
  if (tier === 'primary' || tier === 'statute' || tier === 'legislation') return true;
  if (type === 'STATUTE' || type === 'LEGISLATION' || type === 'RULE' || type === 'REGULATION') {
    return true;
  }
  const title = a.title ?? '';
  const citation = a.citation ?? '';
  const blob = `${title} ${citation}`;
  // Statute-like title without party-vs-party naming
  if (STATUTE_TITLE_PATTERN.test(title) && !/\bv\.?\s|\bvs\.?\s/i.test(title)) return true;
  if (STATUTE_SECTION_PATTERN.test(blob) && !/\bv\.?\s|\bvs\.?\s/i.test(title)) {
    // e.g. "DPDP Act s.38", "CPC s.35"
    if (/\bAct\b|\bCPC\b|\bCrPC\b|\bBNSS\b|\bBNS\b|\bIPC\b/i.test(blob)) return true;
  }
  return false;
}

function isCaseLawAuthority(a: RetrievedAuthority): boolean {
  // Never promote statutes into the case pool
  if (isStatuteAuthority(a)) return false;

  const tier = (a.sourceTier ?? '').toLowerCase();
  const type = (a.authorityType ?? '').toUpperCase();
  if (tier === 'case_law' || tier === 'aggregator') return true;
  if (type === 'CASE' || type === 'CASE_LAW' || type === 'JUDGMENT') return true;
  if (a.id?.startsWith('ik-') || a.id?.startsWith('cl-')) {
    // Indian Kanoon / CourtListener ids — require judgment-like title when possible
    if (/\bv\.?\s|\bvs\.?\s/i.test(a.title ?? '')) return true;
    if (tier === 'case_law') return true;
  }
  if (/indian\s*kanoon|courtlistener|judis|scc online/i.test(a.sourceName ?? '')) {
    if (!isStatuteAuthority(a) && (/\bv\.?\s|\bvs\.?\s/i.test(a.title ?? '') || tier === 'case_law')) {
      return true;
    }
  }
  if (/\bv\.?\s|\bvs\.?\s/i.test(a.title ?? '')) return true;
  return false;
}

const MINIMUM_RELEVANCE_SCORE = 0.15;

/**
 * Extract statute/code section references like "NI Act s.138", "BNSS 482",
 * "42 USC s.1983", "Human Rights Act s.6".
 *
 * Parsing is jurisdiction-agnostic so the section cross-check and correction
 * capture downstream work outside India's act ontology.
 */
export function extractSectionRefs(text: string, countryCode?: string): string[] {
  const refs = new Set<string>();
  for (const reference of extractStatuteReferences(text, countryCode)) {
    if (!reference.act) continue;
    refs.add(`${reference.act.toUpperCase()} s.${reference.section.toUpperCase()}`);
  }
  return [...refs];
}

function deriveBrief(authority: RetrievedAuthority): { year: string | null; court: string | null } {
  const ext = authority as unknown as Record<string, unknown>;
  const parsedYear = ext.decisionDate ? new Date(ext.decisionDate as string).getUTCFullYear() : authority.decisionYear;
  const year = parsedYear && Number.isFinite(parsedYear) ? String(parsedYear) : null;
  const court = (ext.court as string | null | undefined) ?? null;
  return { year, court };
}

function verificationStatus(authority: RetrievedAuthority): CaseVerificationStatus {
  const provenance = authority.sourceProvenance;
  // A familiar publisher name or URL is not evidence that the exact judgment,
  // holding and disposition have been checked.
  const anchoredHolding = authority.sourcePassages?.some((passage) =>
    passage.sourcePinpoint && Boolean(passage.paragraph || passage.page) &&
    ['HOLDING', 'RATIO'].includes(passage.classification ?? ''),
  );
  if (provenance?.canonicalIdentity && provenance.documentHash &&
      provenance.completeness === 'COMPLETE' && provenance.dispositionComplete &&
      !provenance.missingPages?.length && provenance.paragraphNumberingIntegrity !== 'CORRUPT' &&
      anchoredHolding) return 'verified';
  return authority.sourceTier === 'case_law' ? 'needs_verification' : 'source_only';
}

function jurisdictionMatchWeight(
  authority: RetrievedAuthority,
  countryCode: string,
  jurisdiction?: string,
): number {
  const blob = `${authority.sourceName} ${authority.title} ${authority.citation ?? ''}`.toLowerCase();
  const cc = countryCode.toLowerCase();
  if (cc === 'in' && /india|supreme court of india|delhi|bombay|madras|gujarat|ahmedabad/.test(blob)) {
    return 0.12;
  }
  if (cc === 'ke' && /kenya|eklr/.test(blob)) return 0.12;
  if ((cc === 'us' || cc === 'us-federal') && /united states|u\.s\.|circuit|federal/.test(blob)) {
    return 0.12;
  }
  if ((cc === 'gb' || cc === 'uk') && /england|wales|uksc|bailii|ewca|ewhc/.test(blob)) {
    return 0.12;
  }
  if (jurisdiction && blob.includes(jurisdiction.toLowerCase())) return 0.1;
  return 0.04;
}

function recencyScore(year: string | null): number {
  if (!year) return 0.03;
  const y = Number(year);
  if (!Number.isFinite(y)) return 0.03;
  const age = Math.max(0, new Date().getFullYear() - y);
  if (age <= 5) return 0.1;
  if (age <= 15) return 0.07;
  if (age <= 30) return 0.04;
  return 0.02;
}

function citationNetworkHint(authority: RetrievedAuthority): number {
  const text = `${authority.summary ?? ''} ${authority.fullText ?? ''}`;
  // Lightweight signal: judgment text that cites other cases is richer for network expansion.
  const cites = (text.match(/\bv\.?\s+[A-Z][a-zA-Z]+/g) ?? []).length;
  return Math.min(0.08, cites * 0.01);
}

function bindingWeight(
  authority: RetrievedAuthority,
  countryCode: string,
): SimilarCase['bindingWeight'] {
  const precedent = authority.precedent;
  const controllingCountry = precedent?.controllingJurisdiction?.toUpperCase().split(/[-_/]/)[0];
  const requestedCountry = countryCode.toUpperCase() === 'UK' ? 'GB' : countryCode.toUpperCase();
  const adverseTreatment = /overruled|reversed|superseded|repealed/i.test(
    `${authority.treatmentStatus ?? ''} ${precedent?.treatmentStatus ?? ''}`,
  );
  if (adverseTreatment || precedent?.bindingStatus === 'NON_PRECEDENTIAL') return 'informational';
  if (precedent?.bindingStatus === 'BINDING' && controllingCountry === requestedCountry) return 'binding';
  if (precedent?.bindingStatus === 'PERSUASIVE' || authority.sourceTier === 'case_law') return 'persuasive';
  return 'informational';
}

@Injectable()
export class SimilarCasesService {
  /**
   * Selects, ranks, and shapes similar cases from the retrieved authorities array.
   * Only returns authorities that look like case law (sourceTier = case_law or authorityType = CASE).
   * Returns at most `limit` cases ranked by credibility + relevance.
   */
  extractAndRank(
    authorities: RetrievedAuthority[],
    query: string,
    countryCode: string,
    limit = 8,
    context: StructuredLegalQueryContext & { jurisdiction?: string } = {},
  ): SimilarCase[] {
    // Strict case-only pool. Do NOT fall back to "any citation length > 5"
    // (that promoted unrelated statutes into the case-law enrich path).
    const pool = authorities.filter(
      (a) =>
        isCaseLawAuthority(a) &&
        /^https?:\/\//i.test(a.sourceUrl ?? '') &&
        ((a.fullText ?? a.summary ?? '').trim().length >= 80),
    );

    if (pool.length === 0) return [];

    const scored = pool.flatMap((a) => {
      const assessment = assessCandidateRelevance(a, {
        query,
        countryCode,
        ...context,
      });
      if (!assessment.admitted || assessment.score < MINIMUM_RELEVANCE_SCORE) return [];
      const bw = bindingWeight(a, countryCode);
      // CaseScore = authority + jurisdiction + issue + factual + treatment + recency + cite-network
      const authorityWeight = bw === 'binding' ? 0.28 : bw === 'persuasive' ? 0.16 : 0.06;
      const jurisdictionWeight = jurisdictionMatchWeight(a, countryCode, context.jurisdiction);
      const issueSimilarity = assessment.score * 0.22;
      const factualSimilarity = Math.min(0.18, (a.score ?? 0.4) * 0.18);
      const treatmentWeight = a.precedent?.treatmentVerified &&
        /^(good_law|followed|affirmed)$/.test(a.precedent.treatmentStatus ?? '') ? 0.06 : 0;
      const { year } = deriveBrief(a);
      const recencyWeight = recencyScore(year);
      const citationNetworkWeight = citationNetworkHint(a);
      const total =
        authorityWeight +
        jurisdictionWeight +
        issueSimilarity +
        factualSimilarity +
        treatmentWeight +
        recencyWeight +
        citationNetworkWeight;
      return [
        {
          authority: a,
          total,
          relevanceReason: assessment.reason,
          breakdown: {
            authorityWeight,
            jurisdictionWeight,
            issueSimilarity,
            factualSimilarity,
            treatmentWeight,
            recencyWeight,
            citationNetworkWeight,
          },
        },
      ];
    });

    scored.sort((a, b) => b.total - a.total);

    return scored.slice(0, limit).map(({ authority: a, total, relevanceReason, breakdown }) => {
      const { year, court } = deriveBrief(a);
      const content = `${a.title ?? ''} ${a.summary ?? ''}`;
      return {
        authorityId: a.id,
        title: a.title,
        citation: a.citation,
        neutralCitation: a.neutralCitation ?? null,
        court: court ?? null,
        year,
        sourceUrl: a.sourceUrl ?? null,
        sourceName: a.sourceName,
        summary: a.summary ?? null,
        relevantSections: extractSectionRefs(content, countryCode),
        relevance: relevanceReason,
        bindingWeight: bindingWeight(a, countryCode),
        confidence: Math.min(total, 1),
        verificationStatus: verificationStatus(a),
        // A search/seed summary is not a judgment holding. Use a classified,
        // source-anchored passage; do not invent an outcome from keywords.
        keyHolding: a.sourcePassages?.find((passage) =>
          passage.sourcePinpoint && ['HOLDING', 'RATIO'].includes(passage.classification ?? ''),
        )?.text ?? null,
        outcome: a.sourceProvenance?.dispositionComplete ? a.proceduralPosture?.disposition ?? null : null,
        proceduralStage: a.proceduralPosture?.stage ?? null,
        relevantPassage: a.fullText ? a.fullText.slice(0, 400) : a.summary?.slice(0, 400) ?? null,
        whyItMatters: relevanceReason,
        caseScoreBreakdown: breakdown,
      };
    });
  }

  /**
   * Honest empty-state taxonomy — never claim "no similar cases exist" on provider failure.
   */
  classifySearchOutcome(input: {
    attempted: boolean;
    similarCases: SimilarCase[];
    caseLawSearchStatus?: string | null;
    rawCaseLawAuthorityCount: number;
  }): SimilarCasesSearchOutcome {
    if (!input.attempted) return 'NOT_ATTEMPTED';
    if (input.similarCases.length > 0) {
      const anyVerified = input.similarCases.some((c) => c.verificationStatus === 'verified');
      return anyVerified ? 'CASES_FOUND' : 'AUTHORITIES_FOUND_BUT_UNVERIFIED';
    }
    const status = input.caseLawSearchStatus ?? '';
    if (
      status === 'not_configured' ||
      status === 'timeout' ||
      status === 'rate_limited' ||
      status === 'unauthorized' ||
      status === 'circuit_open' ||
      status === 'error'
    ) {
      return 'PROVIDER_FAILURE';
    }
    if (input.rawCaseLawAuthorityCount > 0) {
      return 'AUTHORITIES_FOUND_BUT_UNVERIFIED';
    }
    if (status === 'searched' || status === 'no_hits') {
      return 'NO_RESULTS_AFTER_SUCCESSFUL_SEARCH';
    }
    return 'SEARCH_INCOMPLETE';
  }

  /** Builds a compact prompt block listing similar cases for LLM grounding. */
  buildPromptBlock(cases: SimilarCase[]): string {
    if (cases.length === 0) return '';
    const lines = cases.map(
      (c, i) =>
        `[Case ${i + 1}] ${c.title}` +
        (c.citation ? ` (${c.citation})` : '') +
        (c.court ? ` — ${c.court}` : '') +
        (c.year ? ` ${c.year}` : '') +
        (c.relevantSections.length
          ? `\n  Sections cited: ${c.relevantSections.slice(0, 5).join(', ')}`
          : '') +
        (c.summary ? `\n  Summary: ${c.summary.slice(0, 300)}` : ''),
    );
    return [
      '## Admitted Case-Law Evidence',
      'These judgments passed the query-relevance gate and are primary case-law evidence for the requested comparison.',
      'For each relied-on judgment, state the material facts, disputed clause or issue, holding, disposition/outcome, and why it is analogous or distinguishable.',
      'Do not infer a holding or outcome beyond the retrieved passage. Do not use a judgment as primary proof that a statute section exists.',
      '',
      ...lines,
    ].join('\n');
  }
}
