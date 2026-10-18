import {
  splitDocumentForReview,
  mergePartialResults,
  SINGLE_PASS_LIMIT,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  MAX_CHUNKS,
} from './document-review-chunking';
import type { PartialReviewResult, AnalysisCoverage } from './document-review-chunking';

// ─── splitDocumentForReview ───────────────────────────────────────────────────

describe('splitDocumentForReview', () => {
  it('returns a single chunk for documents shorter than CHUNK_SIZE', () => {
    // splitDocumentForReview splits by CHUNK_SIZE, not SINGLE_PASS_LIMIT.
    // The gateway decides whether to call it based on SINGLE_PASS_LIMIT.
    const text = 'a'.repeat(CHUNK_SIZE - 1);
    const { chunks } = splitDocumentForReview(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text.length).toBe(text.length);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].total).toBe(1);
  });

  it('splits a long document into multiple chunks', () => {
    const text = 'x'.repeat(CHUNK_SIZE * 2 + 5000);
    const { chunks } = splitDocumentForReview(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('each chunk reports correct index and total', () => {
    const text = 'y'.repeat(CHUNK_SIZE * 3);
    const { chunks } = splitDocumentForReview(text);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.total).toBe(chunks.length);
    });
  });

  it('respects MAX_CHUNKS cap', () => {
    const text = 'z'.repeat(CHUNK_SIZE * (MAX_CHUNKS + 5));
    const { chunks, coverage } = splitDocumentForReview(text);
    expect(chunks.length).toBe(MAX_CHUNKS);
    expect(coverage.fullCoverage).toBe(false);
    expect(coverage.analyzedChars).toBeLessThan(coverage.totalChars);
  });

  it('snaps chunk boundary to preceding paragraph break', () => {
    // Build a text where a \n\n occurs just before CHUNK_SIZE
    const before = 'a'.repeat(CHUNK_SIZE - 300);
    const after = 'b'.repeat(1000);
    const text = before + '\n\n' + after + 'c'.repeat(CHUNK_SIZE);
    const { chunks } = splitDocumentForReview(text);
    // First chunk should end at the \n\n boundary, not at exactly CHUNK_SIZE
    const firstChunk = chunks[0];
    expect(firstChunk.text).not.toContain('b');
  });

  it('includes overlap between adjacent chunks', () => {
    const repeated = 'CLAUSE_MARKER '.repeat(5000); // ~70k chars
    const text = repeated + 'END_MARKER '.repeat(5000);
    const { chunks } = splitDocumentForReview(text);
    if (chunks.length >= 2) {
      const firstEnd = chunks[0].endOffset;
      const secondStart = chunks[1].startOffset;
      expect(secondStart).toBeLessThan(firstEnd);
    }
  });

  it('reports fullCoverage=true when all text fits in chunks', () => {
    const text = 'a'.repeat(CHUNK_SIZE * 2);
    const { coverage } = splitDocumentForReview(text);
    expect(coverage.fullCoverage).toBe(true);
  });

  it('reports correct analyzedChars when coverage is full', () => {
    const text = 'a'.repeat(CHUNK_SIZE + 1000);
    const { chunks, coverage } = splitDocumentForReview(text);
    const lastChunk = chunks[chunks.length - 1];
    expect(coverage.analyzedChars).toBe(lastChunk.endOffset);
  });
});

// ─── mergePartialResults ──────────────────────────────────────────────────────

function makePartial(overrides: Partial<PartialReviewResult> = {}): PartialReviewResult {
  return {
    sectionSummary: 'Section summary',
    parties: [],
    keyDates: [],
    pros: [],
    cons: [],
    risks: [],
    keyClauses: [],
    amendments: [],
    ...overrides,
  };
}

const mockCoverage: AnalysisCoverage = {
  totalChars: 100_000,
  analyzedChars: 100_000,
  chunkCount: 2,
  fullCoverage: true,
};

describe('mergePartialResults', () => {
  it('deduplicates risks with identical titles', () => {
    const risk = { severity: 'HIGH' as const, title: 'Liability Risk', detail: 'No cap', sourceText: 'unlimited liability' };
    const partials = [makePartial({ risks: [risk] }), makePartial({ risks: [risk] })];
    const merged = mergePartialResults(partials, mockCoverage);
    expect(merged.risks.length).toBe(1);
  });

  it('preserves distinct risks from different chunks', () => {
    const risk1 = { severity: 'HIGH' as const, title: 'Liability Risk', detail: 'No cap', sourceText: '' };
    const risk2 = { severity: 'MEDIUM' as const, title: 'Termination Risk', detail: 'Unilateral', sourceText: '' };
    const partials = [makePartial({ risks: [risk1] }), makePartial({ risks: [risk2] })];
    const merged = mergePartialResults(partials, mockCoverage);
    expect(merged.risks.length).toBe(2);
  });

  it('sorts risks HIGH before MEDIUM before LOW', () => {
    const risks = [
      { severity: 'LOW' as const, title: 'Minor Risk', detail: '', sourceText: '' },
      { severity: 'HIGH' as const, title: 'Critical Risk', detail: '', sourceText: '' },
      { severity: 'MEDIUM' as const, title: 'Notable Risk', detail: '', sourceText: '' },
    ];
    const merged = mergePartialResults([makePartial({ risks })], mockCoverage);
    expect(merged.risks[0].severity).toBe('HIGH');
    expect(merged.risks[1].severity).toBe('MEDIUM');
    expect(merged.risks[2].severity).toBe('LOW');
  });

  it('deduplicates parties by name', () => {
    const party = { name: 'Acme Corp', role: 'Vendor' };
    const partials = [makePartial({ parties: [party] }), makePartial({ parties: [party] })];
    const merged = mergePartialResults(partials, mockCoverage);
    expect(merged.parties.length).toBe(1);
  });

  it('computes a non-zero risk score when HIGH risks exist', () => {
    // 4 × HIGH = 4 × 18 = 72 → 'High' (51-75)
    const risks = Array.from({ length: 4 }, (_, i) => ({
      severity: 'HIGH' as const,
      title: `Risk ${i}`,
      detail: '',
      sourceText: '',
    }));
    const merged = mergePartialResults([makePartial({ risks })], mockCoverage);
    expect(merged.overallRiskScore).toBeGreaterThan(0);
    expect(['High', 'Critical']).toContain(merged.riskLabel);
  });

  it('attaches analysisCoverage to the merged result', () => {
    const merged = mergePartialResults([makePartial()], mockCoverage);
    expect(merged.analysisCoverage).toEqual(mockCoverage);
  });

  it('does not include summary, recommendations, or suggestedFollowUpQuestions', () => {
    const merged = mergePartialResults([makePartial()], mockCoverage) as unknown as Record<string, unknown>;
    expect(merged['summary']).toBeUndefined();
    expect(merged['recommendations']).toBeUndefined();
    expect(merged['suggestedFollowUpQuestions']).toBeUndefined();
  });

  it('limits keyClauses to 12 and amendments to 10', () => {
    const clauses = Array.from({ length: 20 }, (_, i) => ({
      title: `Clause ${i}`,
      originalText: `text ${i}`,
      analysis: 'analysis',
      flagged: false,
    }));
    const amendments = Array.from({ length: 15 }, (_, i) => ({
      clauseRef: `Clause ${i}`,
      issue: 'issue',
      originalText: `text ${i}`,
      suggestedText: 'fix',
      reason: 'reason',
    }));
    const merged = mergePartialResults([makePartial({ keyClauses: clauses, amendments })], mockCoverage);
    expect(merged.keyClauses.length).toBeLessThanOrEqual(12);
    expect(merged.amendments.length).toBeLessThanOrEqual(10);
  });
});
