import type {
  LegalResearchClassification,
  LegalResearchIntent,
} from '@/ai/legal-research/legal-research-classifier.service';
import type { ResearchTaskKind } from '@/ai/legal-research/research-planning.types';
import type {
  LegalQueryEntity,
  RequestedAuthorityType,
  StructuredLegalQueryContext,
} from './legal-retrieval.types';

const ENTITY_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  type: NonNullable<LegalQueryEntity['type']>;
}> = [
  { pattern: /\bpartner(?:ship|s)?\b/i, label: 'partnership', type: 'LEGAL_RELATIONSHIP' },
  { pattern: /\blimited liability partnership|\bLLP\b/i, label: 'limited liability partnership', type: 'LEGAL_RELATIONSHIP' },
  { pattern: /\bcompany|corporation|shareholder|director\b/i, label: 'company', type: 'ORGANISATION' },
  { pattern: /\bbank|lender|regulated entity\b/i, label: 'bank or lender', type: 'ORGANISATION' },
  { pattern: /\bemployer|employee|workman|worker\b/i, label: 'employment relationship', type: 'LEGAL_RELATIONSHIP' },
  { pattern: /\blandlord|tenant|lessee|lessor\b/i, label: 'landlord-tenant relationship', type: 'LEGAL_RELATIONSHIP' },
  { pattern: /\bspouse|husband|wife|child|parent\b/i, label: 'family relationship', type: 'LEGAL_RELATIONSHIP' },
];

const REMEDY_PATTERNS: Array<[RegExp, string]> = [
  [/\bdissolution\b/i, 'dissolution'],
  [/\baccounts?|rendition of accounts\b/i, 'rendition of accounts'],
  [/\binjunction|interim relief\b/i, 'injunction or interim relief'],
  [/\bdamages|compensation\b/i, 'damages or compensation'],
  [/\bspecific performance\b/i, 'specific performance'],
  [/\bquash(?:ing)?\b/i, 'quashing'],
  [/\bbail\b/i, 'bail'],
  [/\bset aside|challenge (?:an? )?award\b/i, 'setting aside an award'],
  [/\bappoint(?:ment)? of (?:an? )?arbitrator\b/i, 'appointment of an arbitrator'],
  [/\bdeclaration|declaratory relief\b/i, 'declaration'],
  [/\brecovery\b/i, 'recovery'],
];

const DOCTRINE_PATTERNS: Array<[RegExp, string]> = [
  [/\bgroup of companies\b/i, 'group of companies doctrine'],
  [/\bseparab(?:ility|le)\b/i, 'separability'],
  [/\bkompetenz[- ]kompetenz\b/i, 'kompetenz-kompetenz'],
  [/\barbitrability\b/i, 'arbitrability'],
  [/\bpublic policy\b/i, 'public policy'],
  [/\bres judicata\b/i, 'res judicata'],
  [/\bpromissory estoppel\b/i, 'promissory estoppel'],
  [/\bnatural justice\b/i, 'principles of natural justice'],
];

function authorityTypesForIntent(
  intent: LegalResearchIntent,
): RequestedAuthorityType[] {
  switch (intent) {
    case 'CASE_COMPARISON':
      return ['CASE_LAW', 'BINDING_PRECEDENT'];
    case 'ADVERSE_AUTHORITY':
      return ['CASE_LAW', 'BINDING_PRECEDENT', 'ADVERSE_AUTHORITY'];
    case 'STATUTORY_INTERPRETATION':
      return ['STATUTE', 'CASE_LAW', 'BINDING_PRECEDENT'];
    case 'PROCEDURE':
      return ['STATUTE', 'RULE', 'CASE_LAW'];
    case 'CURRENT_LAW':
      return ['STATUTE', 'BINDING_PRECEDENT', 'ADVERSE_AUTHORITY'];
    case 'CITATION_LOOKUP':
      return ['CITATION', 'CASE_LAW'];
    default:
      return ['STATUTE', 'CASE_LAW'];
  }
}

function authorityTypesForTask(
  taskKind: ResearchTaskKind,
): RequestedAuthorityType[] {
  switch (taskKind) {
    case 'CASE_SURVEY':
    case 'CASE_COMPARISON':
    case 'CASE_ANALYSIS':
      return ['CASE_LAW', 'BINDING_PRECEDENT'];
    case 'ADVERSE_AUTHORITY':
      return ['CASE_LAW', 'BINDING_PRECEDENT', 'ADVERSE_AUTHORITY'];
    case 'STATUTORY_INTERPRETATION':
      return ['STATUTE', 'CASE_LAW', 'BINDING_PRECEDENT'];
    case 'PROCEDURE':
      return ['STATUTE', 'RULE', 'CASE_LAW'];
    case 'CURRENT_LAW':
      return ['STATUTE', 'BINDING_PRECEDENT', 'ADVERSE_AUTHORITY'];
    case 'CITATION_VERIFICATION':
    case 'CASE_LOOKUP':
      return ['CITATION', 'CASE_LAW'];
    case 'SECTION_LOOKUP':
      return ['STATUTE'];
    default:
      return ['STATUTE', 'CASE_LAW'];
  }
}

export function decomposeLegalResearchQuery(input: {
  query: string;
  classification: LegalResearchClassification;
  taskKind?: ResearchTaskKind;
  legalIssues?: string[];
  matterEntities?: LegalQueryEntity[];
  matterRemedies?: string[];
}): StructuredLegalQueryContext {
  const entities = [
    ...(input.matterEntities ?? []),
    ...ENTITY_PATTERNS
      .filter(({ pattern }) => pattern.test(input.query))
      .map(({ label, type }) => ({ text: label, type })),
  ];
  const remedies = [
    ...(input.matterRemedies ?? []),
    ...REMEDY_PATTERNS
      .filter(([pattern]) => pattern.test(input.query))
      .map(([, remedy]) => remedy),
  ];
  const doctrines = DOCTRINE_PATTERNS
    .filter(([pattern]) => pattern.test(input.query))
    .map(([, doctrine]) => doctrine);
  const legalIssues =
    input.legalIssues?.filter(Boolean).length
      ? input.legalIssues.filter(Boolean)
      : [input.query];

  return {
    legalIssues: [...new Set(legalIssues)],
    doctrines: [...new Set(doctrines)],
    entities: [...new Map(entities.map((entity) => [`${entity.type}:${entity.text}`, entity])).values()],
    remedies: [...new Set(remedies)],
    requestedAuthorityTypes: input.taskKind
      ? authorityTypesForTask(input.taskKind)
      : authorityTypesForIntent(input.classification.researchIntent.primary),
    issueDecomposition: legalIssues.map((issue) => ({
      issue,
      subIssues: [
        ...remedies.map((remedy) => `availability of ${remedy}`),
        ...(input.classification.proceduralPosture
          ? [`procedure at ${input.classification.proceduralPosture} stage`]
          : []),
      ],
    })),
  };
}
