import {
  categorizeSource,
  categorizeTaskType,
  decodeActivityId,
  encodeActivityId,
  previewText,
} from './admin-user-activity.util';

describe('admin-user-activity.util', () => {
  describe('categorizeTaskType', () => {
    it('maps research tasks', () => {
      expect(categorizeTaskType('LEGAL_RESEARCH')).toBe('research');
      expect(categorizeTaskType('STRATEGY_MEMO')).toBe('research');
      expect(categorizeTaskType('RESEARCH_CASE_LAW_ENRICH')).toBe('research');
    });

    it('maps drafting tasks', () => {
      expect(categorizeTaskType('TEMPLATE_DRAFT')).toBe('drafting');
      expect(categorizeTaskType('DOCUMENT_DRAFT')).toBe('drafting');
      expect(categorizeTaskType('INDIA_COURT_DRAFT')).toBe('drafting');
      expect(categorizeTaskType('DRAFT_FILL_BLANKS')).toBe('drafting');
    });

    it('maps search tasks', () => {
      expect(categorizeTaskType('DRAFT_INTENT_SEARCH')).toBe('search');
      expect(categorizeTaskType('INDIA_SECTION_LOOKUP')).toBe('search');
    });

    it('maps copilot via mode', () => {
      expect(categorizeTaskType('LAWYER_MATTER_QA', 'LAWYER_COPILOT')).toBe(
        'copilot',
      );
    });

    it('falls back to other', () => {
      expect(categorizeTaskType('MEETING_NOTES')).toBe('other');
      expect(categorizeTaskType(null)).toBe('other');
    });
  });

  describe('categorizeSource', () => {
    it('maps fixed sources', () => {
      expect(categorizeSource('copilot')).toBe('copilot');
      expect(categorizeSource('issue_checker')).toBe('search');
      expect(categorizeSource('court_draft')).toBe('drafting');
    });
  });

  describe('activity id encoding', () => {
    it('round-trips', () => {
      const id = encodeActivityId('ai_output', 'cm123');
      expect(id).toBe('ai_output:cm123');
      expect(decodeActivityId(id)).toEqual({
        source: 'ai_output',
        rawId: 'cm123',
      });
    });

    it('rejects invalid ids', () => {
      expect(decodeActivityId('bad')).toBeNull();
      expect(decodeActivityId('unknown:x')).toBeNull();
    });
  });

  describe('previewText', () => {
    it('truncates long text', () => {
      const long = 'a'.repeat(250);
      expect(previewText(long, 200).endsWith('…')).toBe(true);
      expect(previewText(long, 200).length).toBe(201);
    });
  });
});
