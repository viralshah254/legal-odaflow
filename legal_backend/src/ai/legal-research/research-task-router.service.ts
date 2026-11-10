import { Injectable, Optional } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { extractNamedStatuteQueries } from './named-statute-extract';
import { isStructuredMatterBrief } from './research-task-context';
import type {
  NormalizedResearchRequest,
  ResearchCapability,
  ResearchTaskKind,
  ResearchTaskProfile,
} from './research-planning.types';

const TASK_KINDS: ResearchTaskKind[] = [
  'SECTION_LOOKUP',
  'STATUTORY_INTERPRETATION',
  'CASE_LOOKUP',
  'CASE_SURVEY',
  'CASE_ANALYSIS',
  'CASE_COMPARISON',
  'CITATION_VERIFICATION',
  'CURRENT_LAW',
  'ADVERSE_AUTHORITY',
  'PROCEDURE',
  'GENERAL_RESEARCH',
  'MATTER_OPINION',
];

const REQUIRED_CAPABILITIES: Record<ResearchTaskKind, ResearchCapability[]> = {
  SECTION_LOOKUP: ['STATUTES'],
  STATUTORY_INTERPRETATION: ['STATUTES', 'CASE_LAW'],
  CASE_LOOKUP: ['CASE_LAW'],
  CASE_SURVEY: ['CASE_LAW'],
  CASE_ANALYSIS: ['CASE_LAW', 'TREATMENT'],
  CASE_COMPARISON: ['CASE_LAW', 'TREATMENT'],
  CITATION_VERIFICATION: ['CASE_LAW'],
  CURRENT_LAW: ['CURRENT_LAW', 'CASE_LAW', 'STATUTES', 'TREATMENT'],
  ADVERSE_AUTHORITY: ['CASE_LAW', 'TREATMENT'],
  PROCEDURE: ['STATUTES', 'CASE_LAW'],
  GENERAL_RESEARCH: ['CASE_LAW', 'STATUTES'],
  MATTER_OPINION: ['CASE_LAW', 'STATUTES'],
};

const SIGNALS: Array<{
  kind: Exclude<ResearchTaskKind, 'GENERAL_RESEARCH' | 'MATTER_OPINION'>;
  weight: number;
  patterns: RegExp[];
}> = [
  {
    kind: 'CITATION_VERIFICATION',
    weight: 6,
    patterns: [/\b(?:citation|neutral citation|reporter citation)\b/i, /\b(?:AIR|SCC|SCR|All ER)\s+\d{4}\b/i],
  },
  {
    kind: 'ADVERSE_AUTHORITY',
    weight: 5,
    patterns: [/\b(?:adverse|contrary|negative|unfavourable|unfavorable)\s+(?:authority|case|precedent)/i, /\b(?:overruled|distinguished|doubted)\b|\blimited\s+(?:by|on appeal|in scope)\b|\b(?:subsequently|later|was|been)\s+limited\b/i],
  },
  {
    kind: 'CASE_SURVEY',
    weight: 6,
    patterns: [
      /\b(?:similar|analogous|comparable|leading|relevant)\s+(?:cases?|judgments?|authorities)\b/i,
      /\b(?:cases?|judgments?|authorities)\b.*\b(?:key\s+)?(?:outcomes?|holdings?|decisions?)\b/i,
      /\b(?:types?|examples?)\s+of\s+cases?\b/i,
    ],
  },
  {
    kind: 'CASE_COMPARISON',
    weight: 5,
    patterns: [
      /\b(?:compare|comparison)\b.*\b(?:facts?|holdings?|treatment|precedential|ratio|disposition)\b/i,
      /\b[A-Z][A-Za-z.&' -]{2,50}\s+(?:v\.?|versus)\s+[A-Z][A-Za-z.&' -]{2,50}\b.*\b(?:and|with|versus|vs\.?)\b/i,
    ],
  },
  {
    kind: 'CURRENT_LAW',
    weight: 4,
    patterns: [/\b(?:current|latest|recent|present|up[- ]to[- ]date)\s+(?:law|position|status|authority)/i, /\b(?:still good law|in force|latest amendment|as of 20\d{2})\b/i],
  },
  {
    kind: 'SECTION_LOOKUP',
    weight: 6,
    patterns: [/\b(?:text|wording|copy|show|locate|find)\s+(?:of\s+)?(?:section|article|rule|regulation)\b/i, /\b(?:section|article|rule)\s+\d+[A-Za-z]?(?:\(\d+\))?\s+(?:text|bare act)\b/i],
  },
  {
    kind: 'STATUTORY_INTERPRETATION',
    weight: 4,
    patterns: [/\b(?:interpretation|meaning|scope|construction|applicability)\s+of\s+(?:this\s+)?(?:section|article|rule|regulation)/i, /\bwhat does\s+(?:this\s+)?(?:section|article|rule)\b/i],
  },
  {
    kind: 'PROCEDURE',
    weight: 4,
    patterns: [/\b(?:procedure|procedural|how to file|which court|which forum|limitation|deadline|maintainability|appeal route)\b/i],
  },
  {
    kind: 'CASE_ANALYSIS',
    weight: 4,
    patterns: [/\b(?:analyse|analyze|explain|summarize|holding|ratio|outcome|treatment)\b.*\b(?:case|judgment|decision)\b/i],
  },
  {
    kind: 'CASE_LOOKUP',
    weight: 3,
    patterns: [/\b(?:find|locate|identify)\s+(?:the\s+)?(?:case|judgment|decision)\b/i, /\b(?:case law|precedent|judgments?|authorities|leading decisions?)\b/i],
  },
];

function emptyScores(): Record<ResearchTaskKind, number> {
  return Object.fromEntries(TASK_KINDS.map((kind) => [kind, 0])) as Record<ResearchTaskKind, number>;
}

const NAMED_INSTRUMENT =
  /\b(?:Act|Code|Rules|Regulations|Sanhita|Constitution|BNSS|BNS|BSA|IPC|CrPC|CPC|NI\s*Act|TPA|Article)\b/i;

function hasConcreteStatuteAnchor(
  request: Pick<NormalizedResearchRequest, 'objective' | 'facts' | 'statuteReferences'>,
): boolean {
  const haystack = `${request.objective} ${request.facts ?? ''}`;
  if (extractNamedStatuteQueries(haystack).length > 0) return true;
  if (request.statuteReferences.length > 0) {
    return request.statuteReferences.some(
      (reference) =>
        (/\b(?:section|article|§)\s*\d/i.test(reference) && NAMED_INSTRUMENT.test(reference)) ||
        NAMED_INSTRUMENT.test(reference),
    );
  }
  return NAMED_INSTRUMENT.test(haystack) && /\b(?:section|article|§|rule)\s*\d/i.test(haystack);
}

type ClarificationRequest = Pick<
  NormalizedResearchRequest,
  'objective' | 'facts' | 'jurisdiction' | 'statuteReferences'
> &
  Partial<Pick<NormalizedResearchRequest, 'countryCode'>>;

/**
 * Asking the user to narrow scope is the most expensive possible answer, so it
 * is reserved for requests that genuinely cannot be researched.
 *
 * A request that names a provision, or arrives as a structured matter brief, is
 * always researchable: answer it. Applies to every jurisdiction.
 */
function legalClarification(
  kind: ResearchTaskKind,
  request: ClarificationRequest,
): ResearchTaskProfile['clarification'] {
  const haystack = `${request.objective} ${request.facts ?? ''}`;
  if (hasConcreteStatuteAnchor(request) || isStructuredMatterBrief(haystack)) {
    return undefined;
  }

  if (kind === 'SECTION_LOOKUP' || kind === 'STATUTORY_INTERPRETATION') {
    return {
      question:
        'Which statute, section or rule, jurisdiction, and relevant date should be researched?',
      reason: 'The operative provision and version cannot be identified safely from the request.',
      missingFields: ['statute', 'provision', 'jurisdiction', 'relevantDate'],
    };
  }
  // The workspace country is a jurisdiction floor: procedure can be researched
  // for a country even when no specific forum was named.
  if (kind === 'PROCEDURE' && !request.jurisdiction && !request.countryCode) {
    return {
      question: 'Which court, tribunal, regulator, or forum and jurisdiction should the procedure cover?',
      reason: 'Procedure, timing, and maintainability vary by forum.',
      missingFields: ['forum', 'jurisdiction'],
    };
  }
  return undefined;
}

export function routeResearchTaskDeterministically(
  request: Pick<
    NormalizedResearchRequest,
    'objective' | 'facts' | 'statuteReferences' | 'citedAuthorities' | 'requestedTaskKind'
  > &
    Partial<Pick<NormalizedResearchRequest, 'countryCode' | 'jurisdiction'>>,
): ResearchTaskProfile {
  const haystack = `${request.objective} ${request.facts ?? ''}`;
  const scores = emptyScores();
  const reasons: string[] = [];
  scores.GENERAL_RESEARCH = 1;
  if (request.facts?.trim()) scores.MATTER_OPINION = 2;
  if (request.requestedTaskKind) scores[request.requestedTaskKind] += 20;

  for (const signal of SIGNALS) {
    const matches = signal.patterns.filter((pattern) => pattern.test(haystack)).length;
    if (matches > 0) {
      scores[signal.kind] += signal.weight + matches - 1;
      reasons.push(`${signal.kind}: ${matches} deterministic signal${matches === 1 ? '' : 's'}`);
    }
  }
  if (scores.CASE_COMPARISON > 0 && !/\bcompare|comparison\b/i.test(haystack) && (haystack.match(/\b(?:v\.?|vs\.?|versus)\s/gi)?.length ?? 0) < 2) {
    scores.CASE_COMPARISON = 0;
  }
  if (request.statuteReferences.length > 0) scores.STATUTORY_INTERPRETATION += 2;
  if (request.citedAuthorities.length > 0) {
    scores.CITATION_VERIFICATION += 2;
    scores.CASE_ANALYSIS += 1;
  }
  if (isStructuredMatterBrief(haystack)) {
    scores.MATTER_OPINION += 8;
    reasons.push('Structured matter brief (case type / provision / issue)');
  }

  const ranked = TASK_KINDS.map((kind) => [kind, scores[kind]] as const).sort(
    ([kindA, scoreA], [kindB, scoreB]) => scoreB - scoreA || kindA.localeCompare(kindB),
  );
  const tied = ranked[0][1] === ranked[1][1];
  let kind = ranked[0][0];
  const topScore = ranked[0][1];
  if (
    !request.requestedTaskKind &&
    isStructuredMatterBrief(haystack) &&
    (kind === 'CASE_LOOKUP' ||
      kind === 'CASE_SURVEY' ||
      kind === 'GENERAL_RESEARCH' ||
      kind === 'STATUTORY_INTERPRETATION')
  ) {
    kind = 'MATTER_OPINION';
    reasons.push('Structured matter brief: routed as MATTER_OPINION');
  }
  return enrichAdaptiveProfile({
    kind,
    confidence: tied || topScore <= 1 ? 'LOW' : topScore >= 5 ? 'HIGH' : 'MEDIUM',
    scores,
    reasons: reasons.length ? reasons : ['No specific task signal; defaulted to issue analysis'],
    tied,
    fallbackUsed: false,
    requiredCapabilities: [...REQUIRED_CAPABILITIES[kind]],
    clarification: legalClarification(kind, request as NormalizedResearchRequest),
  }, request as NormalizedResearchRequest);
}

function enrichAdaptiveProfile(
  profile: ResearchTaskProfile,
  request: NormalizedResearchRequest,
): ResearchTaskProfile {
  const kind = profile.kind;
  const isSurvey = kind === 'CASE_SURVEY';
  const isComparison = kind === 'CASE_COMPARISON';
  const isAnalysis = kind === 'CASE_ANALYSIS';
  const isCurrent = kind === 'CURRENT_LAW';
  const isAdverse = kind === 'ADVERSE_AUTHORITY';
  const isMatter = kind === 'MATTER_OPINION';
  const isProcedure = kind === 'PROCEDURE';
  const isSection = kind === 'SECTION_LOOKUP';
  const isInterpretation = kind === 'STATUTORY_INTERPRETATION';
  const strictVerification = request.desiredOutput === 'VERIFICATION';
  const caseCentric =
    isSurvey || isComparison || isAnalysis || kind === 'CASE_LOOKUP';
  const requireTreatment =
    isComparison ||
    isAnalysis ||
    isCurrent ||
    isAdverse ||
    (strictVerification && caseCentric);
  const requireContraryCheck =
    isComparison ||
    isAnalysis ||
    isCurrent ||
    isAdverse ||
    (!isSection &&
      (request.desiredOutput === 'MEMO' ||
        request.desiredOutput === 'VERIFICATION'));
  const sourceClasses: Array<'STATUTES' | 'CASE_LAW' | 'TREATMENT' | 'WEB'> =
    isSection
      ? ['STATUTES']
      : isSurvey
        ? ['CASE_LAW', 'STATUTES', 'WEB']
      : isComparison || isAnalysis || kind === 'CASE_LOOKUP'
        ? ['CASE_LAW']
        : ['STATUTES', 'CASE_LAW'];

  const archetype: NonNullable<ResearchTaskProfile['archetype']> =
    isSection
      ? 'STATUTE_TEXT'
      : isInterpretation
        ? 'STATUTE_MEANING'
        : isProcedure
          ? 'PROCEDURE'
          : isSurvey
            ? 'CASE_SURVEY'
            : isComparison
              ? 'CASE_COMPARE'
              : isAnalysis
                ? 'CASE_ANALYZE'
                : kind === 'CITATION_VERIFICATION' || kind === 'CASE_LOOKUP'
                  ? 'CITATION'
                  : isCurrent
                    ? 'CURRENT_LAW'
                    : isMatter
                      ? 'MATTER_OPINION'
                      : /\b(?:doctrine|principle|rule of|concept of)\b/i.test(request.objective)
                        ? 'DOCTRINE'
                        : 'GENERAL';

  const targetCases =
    isSurvey || isComparison ? 3 : isSection ? 0 : isProcedure ? 1 : 2;
  const targetSections =
    isSection || isInterpretation ? 3 : isSurvey || isComparison || isAnalysis ? 1 : 2;

  return {
    ...profile,
    archetype,
    answerShape: {
      includeShortAnswer: true,
      includeLegalFramework: !isAnalysis && kind !== 'CITATION_VERIFICATION',
      includeApplication: isMatter,
      includeRisks: isMatter,
      includePracticalSteps: isMatter || isProcedure,
      includeCaseSurveyLayers: isSurvey,
      desiredOutput: request.desiredOutput,
    },
    evidenceBundle: {
      requiredCapabilities: [
        ...new Set([
          ...profile.requiredCapabilities,
          ...(requireTreatment ? (['TREATMENT'] as const) : []),
        ]),
      ],
      optionalCapabilities: [
        ...(requireTreatment ? [] : (['TREATMENT'] as const)),
        ...(sourceClasses.includes('STATUTES') ? [] : (['STATUTES'] as const)),
      ],
      sourceClasses,
      minCases: isSurvey ? 1 : isComparison ? 2 : 0,
      targetCases,
      targetSections,
      requireTreatment,
      requireContraryCheck,
      requireSimilarCases:
        isComparison ||
        isAnalysis ||
        kind === 'CASE_LOOKUP' ||
        (isSurvey && strictVerification),
    },
    publicationPolicy: {
      requiredDimensions: [
        'AUTHORITY_IDENTITY',
        'PINPOINT_SUPPORT',
        'PASSAGE_ENTAILMENT',
        ...(requireTreatment ? (['TREATMENT'] as const) : []),
        ...(isCurrent ? (['CURRENT_LAW'] as const) : []),
        ...(isMatter ? (['FACTUAL_SUPPORT'] as const) : []),
        'SOURCE_INTEGRITY',
        'ISSUE_COMPLETENESS',
        'CONCLUSION',
      ],
      allowPartialPublication: isSurvey || request.desiredOutput !== 'VERIFICATION',
      allowResearchLeads: isSurvey,
      hardAbortOnMissingCases: isComparison || isAnalysis || kind === 'CASE_LOOKUP',
    },
  };
}

@Injectable()
export class ResearchTaskRouterService {
  constructor(@Optional() private readonly llm?: LlmCompletionService) {}

  async route(request: NormalizedResearchRequest): Promise<ResearchTaskProfile> {
    // Task classification is routing metadata, not a legal answer. Do not hold
    // discovery behind an extra generative call or a chain of model retries.
    return routeResearchTaskDeterministically(request);
  }
}
