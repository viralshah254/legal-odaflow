export type ActivityCategory =
  | 'research'
  | 'drafting'
  | 'copilot'
  | 'search'
  | 'other';

export type ActivitySource =
  | 'ai_output'
  | 'copilot'
  | 'issue_checker'
  | 'court_draft';

const RESEARCH_TASKS = new Set([
  'LEGAL_RESEARCH',
  'STRATEGY_MEMO',
  'RESEARCH_CASE_LAW_ENRICH',
  'RESEARCH_SECTION_ENRICH',
  'RESEARCH_ENRICH_BOTH',
]);

const SEARCH_TASKS = new Set([
  'DRAFT_INTENT_SEARCH',
  'INDIA_SECTION_LOOKUP',
]);

const DRAFTING_PREFIXES = ['DRAFT_', 'TEMPLATE_DRAFT', 'DOCUMENT_DRAFT', 'INDIA_COURT_DRAFT'];

export function categorizeTaskType(
  taskType: string | null | undefined,
  mode?: string | null,
): ActivityCategory {
  if (!taskType && !mode) return 'other';
  const tt = (taskType ?? '').toUpperCase();
  const m = (mode ?? '').toUpperCase();

  if (m.includes('COPILOT')) return 'copilot';
  if (RESEARCH_TASKS.has(tt) || tt.startsWith('RESEARCH_')) return 'research';
  if (SEARCH_TASKS.has(tt)) return 'search';
  if (
    DRAFTING_PREFIXES.some((p) => tt === p || tt.startsWith(p)) ||
    tt.startsWith('DRAFT_')
  ) {
    return 'drafting';
  }
  return 'other';
}

export function categorizeSource(source: ActivitySource): ActivityCategory {
  switch (source) {
    case 'copilot':
      return 'copilot';
    case 'issue_checker':
      return 'search';
    case 'court_draft':
      return 'drafting';
    default:
      return 'other';
  }
}

export function previewText(text: string | null | undefined, max = 200): string {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function encodeActivityId(source: ActivitySource, rawId: string): string {
  return `${source}:${rawId}`;
}

export function decodeActivityId(
  activityId: string,
): { source: ActivitySource; rawId: string } | null {
  const colon = activityId.indexOf(':');
  if (colon <= 0) return null;
  const source = activityId.slice(0, colon) as ActivitySource;
  const rawId = activityId.slice(colon + 1);
  if (
    !rawId ||
    !['ai_output', 'copilot', 'issue_checker', 'court_draft'].includes(source)
  ) {
    return null;
  }
  return { source, rawId };
}

/** Task types that belong to a given category (for Prisma `in` filters). */
export function taskTypesForCategory(category: ActivityCategory): string[] | null {
  switch (category) {
    case 'research':
      return [
        'LEGAL_RESEARCH',
        'STRATEGY_MEMO',
        'RESEARCH_CASE_LAW_ENRICH',
        'RESEARCH_SECTION_ENRICH',
        'RESEARCH_ENRICH_BOTH',
      ];
    case 'search':
      return ['DRAFT_INTENT_SEARCH', 'INDIA_SECTION_LOOKUP'];
    case 'drafting':
      return [
        'TEMPLATE_DRAFT',
        'DOCUMENT_DRAFT',
        'INDIA_COURT_DRAFT',
        'DRAFT_CONTINUATION',
        'DRAFT_FILL_BLANKS',
        'DRAFT_SELECTION_EDIT',
        'DRAFT_VERIFICATION_FIX',
        'DRAFT_BULK_EDIT',
        'DRAFT_EXTRACT_FIELDS',
        'DRAFT_CASE_LAW_ENRICH',
      ];
    case 'copilot':
    case 'other':
      return null; // handled specially
    default:
      return null;
  }
}
