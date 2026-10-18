import type { LegalDomain } from './legal-research-classifier.service';
import type {
  ResearchKnowledgeSource,
  ResearchSourcePlan,
  ResearchTaskKind,
} from './research-planning.types';

const IMPLEMENTED_SOURCES = new Set<ResearchKnowledgeSource>([
  'statutes',
  'case_law',
  'regulations',
  'firm_vault',
  'web',
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function resolveResearchSourcePlan(input: {
  taskKind: ResearchTaskKind;
  legalDomain: LegalDomain;
  query: string;
  requestedSources?: string[];
  hasFirmContext?: boolean;
}): ResearchSourcePlan {
  if (input.requestedSources !== undefined) {
    const requested = unique(
      input.requestedSources.filter(
        (source): source is ResearchKnowledgeSource =>
          IMPLEMENTED_SOURCES.has(source as ResearchKnowledgeSource),
      ),
    );
    if (requested.length > 0) {
      return {
        mode: 'CUSTOM',
        effectiveSources: requested,
        discoverySources: requested.includes('web') ? ['web'] : [],
        reasons: ['Using the user-selected implemented knowledge sources.'],
      };
    }
  }

  const caseCentric = [
    'CASE_LOOKUP',
    'CASE_SURVEY',
    'CASE_ANALYSIS',
    'CASE_COMPARISON',
    'CITATION_VERIFICATION',
    'ADVERSE_AUTHORITY',
    'CURRENT_LAW',
  ].includes(input.taskKind);
  const sources: ResearchKnowledgeSource[] =
    input.taskKind === 'SECTION_LOOKUP'
      ? ['statutes']
      : caseCentric
        ? ['case_law', 'statutes', 'web']
        : ['statutes', 'case_law', 'web'];
  if (
    input.legalDomain === 'DATA_PRIVACY' ||
    input.legalDomain === 'TAX' ||
    /\b(?:regulation|regulations|rules|regulator|regulatory|notification|circular)\b/i.test(
      input.query,
    )
  ) {
    sources.push('regulations');
  }
  if (input.hasFirmContext) sources.push('firm_vault');

  return {
    mode: 'AUTO',
    effectiveSources: unique(sources),
    discoverySources: sources.includes('web') ? ['web'] : [],
    reasons: [
      caseCentric
        ? 'Case-law sources are primary; statutes provide the governing framework.'
        : 'Primary legislation and relevant case law are searched together.',
      ...(sources.includes('web')
        ? ['Live web is used for discovery and must be hydrated before supporting a holding.']
        : []),
    ],
  };
}
