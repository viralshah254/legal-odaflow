import { EvidenceAnalysisService } from '@/ai/matter-intelligence/evidence-analysis.service';
import { EvidenceExtractorService } from '@/ai/matter-intelligence/evidence-extractor.service';
import type { EvidenceRef } from '@/ai/matter-intelligence/matter-intelligence.types';

describe('EvidenceExtractorService', () => {
  const analysis = new EvidenceAnalysisService();
  const llm = {
    isProviderConfigured: () => false,
    complete: jest.fn(),
  };
  const extractor = new EvidenceExtractorService(llm as never, analysis);

  it('returns fallback item from OCR text when LLM unavailable', async () => {
    const result = await extractor.extract({
      fileName: 'termination-letter.pdf',
      mimeType: 'application/pdf',
      textContent: 'Your employment is terminated effective 1 March 2025 without inquiry.',
      sourceDocumentId: 'doc-1',
    });

    expect(result.status).toBe('completed');
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0].description).toContain('terminated');
    expect(result.items[0].sourceDocumentId).toBe('doc-1');
  });

  it('detects payment proof and threat flags via analysis', async () => {
    const result = await extractor.extract({
      fileName: 'evidence.txt',
      textContent:
        'Salary paid via NEFT on 15 Jan. Manager threatened termination if complaint filed.',
    });

    const flags = result.items[0]?.flags;
    expect(flags?.paymentProof).toBe(true);
    expect(flags?.threat).toBe(true);
  });
});

describe('EvidenceAnalysisService', () => {
  const analysis = new EvidenceAnalysisService();

  it('flags contradictory termination statements', () => {
    const result = analysis.analyze([
      { description: 'Employee was not terminated and continued on payroll.' },
      { description: 'Employment was terminated on 1 March without notice.' },
    ]);

    expect(result.contradictions.length).toBeGreaterThan(0);
    expect(result.items.some((i: EvidenceRef) => i.flags?.contradiction)).toBe(true);
  });
});
