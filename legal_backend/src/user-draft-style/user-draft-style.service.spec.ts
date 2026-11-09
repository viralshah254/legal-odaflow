import { UserDraftStyleService } from './user-draft-style.service';

describe('Personal drafting style', () => {
  function setup(count = 5, content = JSON.stringify({
    styleProfile: 'Uses measured, concise submissions with numbered factual paragraphs, short headings and clearly separated relief. Prefers direct language and avoids rhetorical repetition.',
    styleKeywords: ['respectfully submits'], avoidPatterns: ['repetition'],
  })) {
    const record = { status: 'pending', sampleDocuments: Array.from({ length: count }, (_, i) => ({
      filename: `${i}.txt`, extractedText: `Distinct sample ${i}: ` + 'legal drafting text '.repeat(20),
    })) };
    const prisma = { userDraftStyle: { upsert: jest.fn().mockResolvedValue(record), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const ledger = { getBalance: jest.fn().mockResolvedValue(100) };
    const llm = { complete: jest.fn().mockResolvedValue({ content, provider: 'google', modelName: 'gemini-2.5-flash', inputTokens: 1000, outputTokens: 100 }) };
    const usage = { recordTokenUsage: jest.fn().mockResolvedValue({ chargedCredits: 1 }) };
    const service = new UserDraftStyleService(prisma as any, ledger as any, llm as any, {} as any, usage as any);
    return { service, prisma, llm, usage, record };
  }

  it('requires at least five samples before model usage', async () => {
    const { service, llm } = setup(4);
    await expect(service.analyzeStyle('u')).rejects.toThrow('at least 5');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('does not count repeated sample text as five different drafts', async () => {
    const { service, record, llm } = setup();
    record.sampleDocuments.fill(record.sampleDocuments[0]);
    await expect(service.analyzeStyle('u')).rejects.toThrow('distinct');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('does not start a second paid analysis when another request owns the claim', async () => {
    const { service, prisma, llm } = setup();
    prisma.userDraftStyle.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.analyzeStyle('u')).rejects.toThrow('already running');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('settles recorded usage rather than a fixed 500-credit fee', async () => {
    const { service, usage, prisma } = setup();
    await expect(service.analyzeStyle('u')).resolves.toEqual({ status: 'ready', creditsCharged: 1 });
    expect(usage.recordTokenUsage).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 1000, outputTokens: 100, modelProvider: 'google' }));
    expect(prisma.userDraftStyle.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ready' }) }));
  });

  it('does not activate raw or malformed model output as a style profile', async () => {
    const { service, prisma } = setup(5, 'not valid JSON');
    await expect(service.analyzeStyle('u')).rejects.toThrow('no profile was activated');
    expect(prisma.userDraftStyle.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ready' }) }));
  });
});
