import type {
  RetrievedAuthority,
  StructuredLegalQueryContext,
} from './legal-retrieval.types';

const STOP_WORDS = new Set([
  'about',
  'against',
  'case',
  'cases',
  'client',
  'comparable',
  'court',
  'facts',
  'from',
  'have',
  'india',
  'indian',
  'involving',
  'judgment',
  'key',
  'legal',
  'law',
  'matter',
  'outcome',
  'outcomes',
  'similar',
  'section',
  'their',
  'there',
  'these',
  'this',
  'under',
  'with',
  'what',
  'where',
  'were',
]);

export interface CandidateRelevanceAssessment {
  admitted: boolean;
  score: number;
  reason: string;
  rejectionCode?:
    | 'INSUFFICIENT_TEXT'
    | 'NO_MATERIAL_OVERLAP'
    | 'MISSING_SUBJECT_ANCHOR'
    | 'AUTHORITY_TYPE_MISMATCH'
    | 'JURISDICTION_MISMATCH'
    | 'NO_ISSUE_COVERAGE'
    | 'BELOW_THRESHOLD'
    | 'NEAR_MISS';
  matchedQueryTokens: number;
  /** Near-miss candidates may be retained for second-stage rerank. */
  nearMiss?: boolean;
}

export interface CandidateRelevanceOptions {
  /** When true, missing one subject anchor does not hard-reject — marks near_miss instead. */
  relaxSubjectAnchor?: boolean;
  /** Minimum score for near-miss retention during hydration recovery. */
  nearMissThreshold?: number;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return [
    ...new Set(
      normalise(value)
        .split(' ')
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
        .map(stem),
    ),
  ];
}

function stem(token: string): string {
  return token
    .replace(/(?:ments?|ships?|ations?|itions?|ions?|ings?|ied|ed|es|s)$/i, '')
    .replace(/i$/, 'y');
}

const SUBJECT_ANCHOR_GROUPS: string[][] = [
  ['partner', 'partnership'],
  ['arbitrat', 'arbitration', 'arbitral'],
  ['nonsignatory', 'non-signatory'],
  ['insolven', 'bankrupt', 'liquidat'],
  ['employ', 'worker', 'labour', 'labor'],
  ['consumer', 'deficien'],
  ['property', 'tenan', 'landlord', 'possession', 'vacate', 'premises'],
  ['matrimonial', 'divorce', 'maintenance', 'custody'],
  ['bail', 'anticipatory'],
  ['cheque', 'dishonour', 'dishonor'],
  ['trademark', 'copyright', 'patent'],
  ['privacy', 'data'],
  ['crypto', 'cryptocurrency', 'bitcoin', 'blockchain', 'virtualasset'],
  ['tax', 'gst', 'income'],
  ['contract', 'waiver', 'consideration', 'unlawful', 'unenforceable'],
];

function matchedSubjectAnchors(value: string): string[] {
  const valueTokens = new Set(tokens(value));
  if (/\bvirtual[\s-]+assets?\b/i.test(value)) valueTokens.add("crypto");
  return SUBJECT_ANCHOR_GROUPS
    .filter((group) => group.some((token) => valueTokens.has(stem(token))))
    .map((group) => group[0]);
}

function overlap(needles: string[], haystack: Set<string>): number {
  if (needles.length === 0) return 0;
  return needles.filter((token) => haystack.has(token)).length / needles.length;
}

/**
 * Conservative, deterministic admission gate for live case-law candidates.
 * It rewards issue/proposition phrases and exact statute references, while the
 * token score keeps the fallback useful when no structured planner context exists.
 */
export function assessCandidateRelevance(
  authority: Pick<
    RetrievedAuthority,
    'title' | 'citation' | 'summary' | 'fullText'
  > &
    Partial<Pick<RetrievedAuthority, 'authorityType' | 'court' | 'sourceTier'>>,
  context: StructuredLegalQueryContext & {
    query: string;
    countryCode?: string;
    jurisdiction?: string;
  },
  options: CandidateRelevanceOptions = {},
): CandidateRelevanceAssessment {
  const corpus = normalise(
    [authority.title, authority.citation, authority.summary, authority.fullText?.slice(0, 5000)]
      .filter(Boolean)
      .join(' '),
  );
  if (corpus.length < 20) {
    return {
      admitted: false,
      score: 0,
      reason: 'rejected: insufficient candidate text',
      rejectionCode: 'INSUFFICIENT_TEXT',
      matchedQueryTokens: 0,
    };
  }

  const corpusTokens = new Set(tokens(corpus));
  const queryTokens = tokens(context.query).slice(0, 16);
  const requestedTypes = new Set(context.requestedAuthorityTypes ?? []);
  const authorityType = (authority.authorityType ?? '').toUpperCase();
  const isCase =
    authority.sourceTier === 'case_law' ||
    ['CASE', 'CASE_LAW', 'JUDGMENT'].includes(authorityType);
  const isPrimary =
    authority.sourceTier === 'primary' ||
    authority.sourceTier === 'seed' ||
    ['STATUTE', 'LEGISLATION', 'RULE', 'REGULATION'].includes(authorityType);
  if (
    requestedTypes.size > 0 &&
    !(
      (isCase &&
        [...requestedTypes].some((type) =>
          ['CASE_LAW', 'BINDING_PRECEDENT', 'ADVERSE_AUTHORITY', 'CITATION'].includes(type),
        )) ||
      (isPrimary &&
        [...requestedTypes].some((type) =>
          ['STATUTE', 'RULE', 'REGULATION'].includes(type),
        ))
    )
  ) {
    return {
      admitted: false,
      score: 0,
      reason: 'rejected: candidate authority type does not match requested authority types',
      rejectionCode: 'AUTHORITY_TYPE_MISMATCH',
      matchedQueryTokens: 0,
    };
  }

  const court = normalise(authority.court ?? '');
  const countryCode = context.countryCode?.toUpperCase();
  const foreignCourt =
    countryCode === 'IN' &&
    /\b(?:united states|u s court|england|united kingdom|kenya|australia|canada)\b/i.test(court);
  const jurisdiction = normalise(context.jurisdiction ?? '');
  const differentHighCourt =
    jurisdiction.includes('high court') &&
    court.includes('high court') &&
    !court.includes(jurisdiction) &&
    !jurisdiction.split(' ').some((token) => token.length >= 5 && court.includes(token));
  if (foreignCourt || differentHighCourt) {
    return {
      admitted: false,
      score: 0,
      reason: 'rejected: candidate court does not match the requested jurisdiction',
      rejectionCode: 'JURISDICTION_MISMATCH',
      matchedQueryTokens: 0,
    };
  }
  const requiredSubjectAnchors = matchedSubjectAnchors(context.query);
  const candidateSubjectAnchors = new Set(matchedSubjectAnchors(corpus));
  const missingSubjectAnchors = requiredSubjectAnchors.filter(
    (anchor) => !candidateSubjectAnchors.has(anchor),
  );
  const subjectPairMatched =
    requiredSubjectAnchors.length >= 2 && missingSubjectAnchors.length === 0;
  const nearMissThreshold = options.nearMissThreshold ?? 0.18;
  if (requiredSubjectAnchors.length >= 1 && missingSubjectAnchors.length > 0) {
    const queryOverlapEarly = overlap(queryTokens, corpusTokens);
    if (options.relaxSubjectAnchor && queryOverlapEarly >= nearMissThreshold) {
      // Defer hard rejection — caller may hydrate full text and rerank.
    } else if (
      options.relaxSubjectAnchor &&
      missingSubjectAnchors.length === 1 &&
      queryOverlapEarly >= nearMissThreshold * 0.75
    ) {
      // Single missing anchor with partial overlap — near miss.
    } else {
      return {
        admitted: false,
        score: Number(queryOverlapEarly.toFixed(3)),
        reason: `rejected: missing query subject anchor(s): ${missingSubjectAnchors.join(', ')}`,
        rejectionCode: 'MISSING_SUBJECT_ANCHOR',
        matchedQueryTokens: queryTokens.filter((token) => corpusTokens.has(token)).length,
        nearMiss:
          options.relaxSubjectAnchor &&
          missingSubjectAnchors.length === 1 &&
          queryOverlapEarly >= nearMissThreshold * 0.5,
      };
    }
  }
  const queryOverlap = overlap(queryTokens, corpusTokens);
  let score = queryOverlap * 0.45;
  const reasons: string[] = [];
  if (queryOverlap > 0) reasons.push(`query overlap ${Math.round(queryOverlap * 100)}%`);

  const phraseGroups: Array<[string, string[], number]> = [
    ['issue', context.legalIssues ?? [], 0.24],
    ['proposition', context.propositionPhrases ?? [], 0.22],
    ['doctrine', context.doctrines ?? [], 0.14],
  ];
  let exactStructuredMatch = false;
  for (const [label, phrases, weight] of phraseGroups) {
    const matches = phrases
      .map(normalise)
      .filter((phrase) => phrase.length >= 5 && corpus.includes(phrase));
    if (matches.length > 0) {
      score += weight;
      exactStructuredMatch = true;
      reasons.push(`${label} phrase matched`);
    } else if (phrases.length > 0) {
      const bestOverlap = Math.max(
        0,
        ...phrases.map((phrase) => overlap(tokens(phrase), corpusTokens)),
      );
      if (bestOverlap >= 0.5) {
        score += weight * bestOverlap;
        reasons.push(`${label} terms ${Math.round(bestOverlap * 100)}%`);
      }
    }
  }
  if ((context.legalIssues?.length ?? 0) > 0) {
    const bestIssueOverlap = Math.max(
      0,
      ...(context.legalIssues ?? []).map((issue) => overlap(tokens(issue), corpusTokens)),
    );
    if (!exactStructuredMatch && bestIssueOverlap < 0.2 && !subjectPairMatched) {
      return {
        admitted: false,
        score: Number(score.toFixed(3)),
        reason: 'rejected: candidate does not cover any planned legal issue',
        rejectionCode: 'NO_ISSUE_COVERAGE',
        matchedQueryTokens: queryTokens.filter((token) => corpusTokens.has(token)).length,
      };
    }
  }

  const statuteSections = (context.statuteSections ?? []).map(normalise);
  const exactStatuteMatch = statuteSections.some(
    (section) => section.length >= 2 && corpus.includes(section),
  );
  const statuteTermOverlap = Math.max(
    0,
    ...statuteSections.map((section) => overlap(tokens(section), corpusTokens)),
  );
  if (exactStatuteMatch || statuteTermOverlap >= 0.75) {
    score += exactStatuteMatch ? 0.3 : 0.24;
    exactStructuredMatch = true;
    reasons.push('statute section matched');
  }

  const posture = normalise(context.proceduralPosture ?? '');
  if (posture && corpus.includes(posture)) {
    score += 0.08;
    reasons.push('procedural posture matched');
  }

  if (
    subjectPairMatched &&
    /\b(?:held|holding|allowed|dismissed|enforce|valid|invalid|referred|appoint|award|dispute|disposition)\b/i.test(
      corpus,
    )
  ) {
    score += 0.16;
    exactStructuredMatch = true;
    reasons.push('subject pair and outcome passage matched');
  } else if (subjectPairMatched) {
    score += 0.1;
    reasons.push('subject pair matched');
  }

  score = Math.min(1, Number(score.toFixed(3)));
  const matchedQueryTokens = queryTokens.filter((token) => corpusTokens.has(token)).length;
  const admitted =
    exactStructuredMatch ||
    score >= 0.24 ||
    (matchedQueryTokens >= 2 && queryOverlap >= 0.2);

  const nearMiss =
    !admitted &&
    options.relaxSubjectAnchor &&
    (score >= nearMissThreshold ||
      (matchedQueryTokens >= 2 && queryOverlap >= nearMissThreshold * 0.85));

  return {
    admitted: admitted || Boolean(nearMiss),
    score,
    matchedQueryTokens,
    nearMiss,
    rejectionCode: admitted
      ? undefined
      : nearMiss
        ? 'NEAR_MISS'
        : reasons.length === 0
          ? 'NO_MATERIAL_OVERLAP'
          : 'BELOW_THRESHOLD',
    reason: nearMiss
      ? `near-miss retained for rerank: ${reasons.join(', ') || 'partial overlap'}`
      : reasons.length > 0
        ? `${admitted ? 'admitted' : 'rejected'}: ${reasons.join(', ')}`
        : 'rejected: no material issue, proposition, statute, or query overlap',
  };
}
