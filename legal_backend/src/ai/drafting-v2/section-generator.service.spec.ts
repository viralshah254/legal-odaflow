import { CAUSE_TITLE_INSTRUCTION } from './section-generator.service';
import { INDIA_COURT_PLEADING_PROTOCOL } from '@/ai/drafting/legal-accuracy-protocol';

describe('filing-grade cause title instructions', () => {
  it('requires a filled court caption and forbids invented citations in grounds protocol', () => {
    expect(CAUSE_TITLE_INSTRUCTION).toMatch(/IN THE HIGH COURT/i);
    expect(CAUSE_TITLE_INSTRUCTION).toMatch(/never leave it empty/i);
    expect(CAUSE_TITLE_INSTRUCTION).toMatch(/MOST RESPECTFULLY SHOWETH/i);
    expect(INDIA_COURT_PLEADING_PROTOCOL).toMatch(/never an empty heading/i);
    expect(INDIA_COURT_PLEADING_PROTOCOL).toMatch(/forum and competence only/i);
  });
});

describe('section generation integrity', () => {
  const section = { id: 'facts', type: 'facts', title: 'Facts', modelTier: 'mid', maxTokens: 2000,
    dependsOn: [], requiredIngredients: [], requiredEvidence: [], requiredAuthorities: [], issueIds: [] } as any;
  const outline = { documentKind: 'india_regular_bail_bnss_480', documentTitle: 'Regular bail', jurisdiction: 'IN', countryCode: 'IN', sections: [section],
    globalContext: { caseDetails: 'Supplied fictional facts', verifiedAuthorities: [], statuteGrounding: '',
      proceduralResult: { governingSections: [], proceduralWarnings: [] },
      attachmentContext: 'First authorized document. '.repeat(300) + 'SECOND_AUTHORIZED_DOCUMENT_OUTCOME' } } as any;

  it('preserves later authorized documents in the section prompt', async () => {
    const complete = jest.fn().mockResolvedValue({ content: 'Numbered factual narrative.', modelName: 'test', inputTokens: 1, outputTokens: 1, finishReason: 'stop' });
    const { SectionGeneratorService } = await import('./section-generator.service');
    const generator = new SectionGeneratorService({ complete } as never, null, null);
    await generator.generateSection(section, outline, new Map());
    const user = complete.mock.calls[0][0].messages.find((message: any) => message.role === 'user').content;
    expect(user).toContain('SECOND_AUTHORIZED_DOCUMENT_OUTCOME');
  });

  it.each([
    { content: '', finishReason: 'stop' },
    { content: 'Unable to generate a response at this time.', finishReason: 'stop' },
    { content: 'Incomplete grounds that end mid-sentence', finishReason: 'max_tokens' },
  ])('rejects failed or truncated generation instead of verifying it: $finishReason', async (result) => {
    const { SectionGeneratorService } = await import('./section-generator.service');
    const generator = new SectionGeneratorService({ complete: jest.fn().mockResolvedValue(result) } as never, null, null);
    await expect(generator.generateSection(section, outline, new Map())).rejects.toThrow();
  });
});
