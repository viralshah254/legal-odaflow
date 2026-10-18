import {
  buildSkipResult,
  isAlreadyClearPrompt,
  isPromptRefinementEnabled,
  PromptRefinementService,
  PROMPT_REFINE_MIN_LENGTH,
} from '@/ai/prompt-refinement/prompt-refinement.service';
import type { LlmCompletionService } from '@/ai/llm-completion.service';
import type { ConfigService } from '@nestjs/config';

describe('prompt-refinement heuristics', () => {
  it('isPromptRefinementEnabled requires explicit true', () => {
    expect(isPromptRefinementEnabled(undefined)).toBe(false);
    expect(isPromptRefinementEnabled('false')).toBe(false);
    expect(isPromptRefinementEnabled('true')).toBe(true);
  });

  it('isAlreadyClearPrompt detects labeled sections with bullets', () => {
    const prompt = `Legal question: Can a landlord terminate monthly tenancy without notice?

Key facts:
- Tenant in Mumbai since Jan 2024
- No written agreement
- Landlord wants possession next week`;

    expect(isAlreadyClearPrompt(prompt)).toBe(true);
  });

  it('isAlreadyClearPrompt rejects messy single-line prompts', () => {
    expect(
      isAlreadyClearPrompt('landlord tenant notice monthly rent mumbai terminate'),
    ).toBe(false);
  });

  it('isAlreadyClearPrompt detects long bullet fact patterns', () => {
    const bullets = Array.from(
      { length: 5 },
      (_, i) => `- Fact ${i + 1}: detailed employment dispute point with supporting context and dates`,
    ).join('\n');
    const prompt = `${'Wrongful termination and workplace harassment matter in Pune. '.repeat(8)}\n\n${bullets}`;
    expect(isAlreadyClearPrompt(prompt)).toBe(true);
  });

  it('buildSkipResult preserves original prompt', () => {
    const result = buildSkipResult('hello world', 'too_short');
    expect(result.skipped).toBe(true);
    expect(result.refinedPrompt).toBe('hello world');
    expect(result.skipReason).toBe('too_short');
  });
});

describe('PromptRefinementService', () => {
  const makeService = (opts: {
    enabled?: boolean;
    llmContent?: string;
    llmThrows?: boolean;
  }) => {
    const llm = {
      complete: jest.fn(async () => {
        if (opts.llmThrows) throw new Error('LLM down');
        return {
          content: opts.llmContent ?? JSON.stringify({
            refinedPrompt: 'Structured legal question?\n\n- Fact one\n- Fact two',
            hints: { jurisdiction: 'MH', parties: ['A', 'B'], statutes: [], documentKind: null },
          }),
          inputTokens: 10,
          outputTokens: 20,
          provider: 'openai',
          modelName: 'gpt-5.4-nano',
          finishReason: 'stop',
        };
      }),
    } as unknown as LlmCompletionService;

    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'ENABLE_PROMPT_REFINEMENT') return opts.enabled ? 'true' : undefined;
        return fallback;
      }),
    } as unknown as ConfigService;

    return {
      service: new PromptRefinementService(llm, configService),
      llm,
    };
  };

  it('skips when feature flag is off', async () => {
    const { service } = makeService({ enabled: false });
    const result = await service.refine({
      prompt: 'What notice must a landlord give before terminating monthly tenancy in India?',
      purpose: 'research',
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('disabled');
  });

  it('skips when prompt is too short', async () => {
    const { service } = makeService({ enabled: true });
    const short = 'a'.repeat(PROMPT_REFINE_MIN_LENGTH - 1);
    const result = await service.refine({ prompt: short, purpose: 'research' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('too_short');
  });

  it('skips when prompt is already clear', async () => {
    const { service, llm } = makeService({ enabled: true });
    const prompt = `Research question: What is the limitation period?

Key facts:
- Contract breach in 2022
- Forum: Delhi High Court`;

    const result = await service.refine({ prompt, purpose: 'research' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('already_clear');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('returns refined prompt from LLM', async () => {
    const { service } = makeService({ enabled: true });
    const result = await service.refine({
      prompt: 'need bail my client arrested yesterday self defense fight in pune',
      purpose: 'drafting',
    });
    expect(result.skipped).toBe(false);
    expect(result.refinedPrompt).toContain('Structured legal question');
    expect(result.hints?.jurisdiction).toBe('MH');
  });

  it('skips when prompt exceeds LLM input cap and is not already clear', async () => {
    const { service, llm } = makeService({ enabled: true });
    const prompt = 'x'.repeat(7000);
    const result = await service.refine({ prompt, purpose: 'research' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('too_long');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('accepts prompts longer than legacy 4000 char API cap when already clear', async () => {
    const { service, llm } = makeService({ enabled: true });
    const prompt = `Research question: What remedies exist for wrongful termination?

Key facts:
- Employee terminated after reporting harassment
- No notice period paid
- Pune IT company, 5 years service
${Array.from({ length: 8 }, (_, i) => `- Additional fact line ${i + 1} with supporting detail`).join('\n')}
${' padding '.repeat(400)}`;

    const result = await service.refine({ prompt, purpose: 'research' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('already_clear');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('falls back to original on LLM failure', async () => {
    const { service } = makeService({ enabled: true, llmThrows: true });
    const prompt = 'messy drafting request about maintenance appeal karnataka ravi priya';
    const result = await service.refine({ prompt, purpose: 'drafting' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('llm_failed');
    expect(result.refinedPrompt).toBe(prompt);
  });

  it('skips when LLM returns identical text', async () => {
    const prompt = 'messy but long enough prompt about arbitration non signatory binding';
    const { service } = makeService({
      enabled: true,
      llmContent: JSON.stringify({ refinedPrompt: prompt, hints: {} }),
    });
    const result = await service.refine({ prompt, purpose: 'research' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('already_clear');
  });
});
