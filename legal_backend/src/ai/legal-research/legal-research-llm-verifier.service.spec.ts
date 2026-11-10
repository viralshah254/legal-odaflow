import { LegalResearchLlmVerifierService } from './legal-research-llm-verifier.service';

describe('Independent research audit response integrity', () => {
  const input = { query: 'Public legal question', outputMarkdown: 'Source-based analysis', authorities: [], verifierModel: 'premium', countryCode: 'KE' };
  it('reports an unavailable audit instead of showing a blank finding', async () => {
    const service = new LegalResearchLlmVerifierService({ isModelConfigured: () => true, complete: jest.fn().mockResolvedValue({ content: '{"issues":[{"explanation":""}]}' }) } as never);
    expect((await service.verify(input)).findings).toEqual([expect.objectContaining({ state: 'INDETERMINATE', dimension: 'system', explanation: expect.stringContaining('did not complete') })]);
  });
  it('accepts a completed audit with no unsupported claims', async () => {
    const service = new LegalResearchLlmVerifierService({ isModelConfigured: () => true, complete: jest.fn().mockResolvedValue({ content: '{"uncertainty":false,"issues":[]}' }) } as never);
    expect((await service.verify(input)).findings).toEqual([]);
  });
});
