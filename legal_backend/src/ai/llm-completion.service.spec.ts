import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from './llm-completion.service';

describe('LlmCompletionService OpenAI request compatibility', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('omits temperature for GPT-5.x chat models', async () => {
    let requestBody: Record<string, unknown> | undefined;
    global.fetch = jest.fn(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const service = new LlmCompletionService(
      new ConfigService({
        OPENAI_API_KEY: 'test-key',
        ALLOWED_AI_PROVIDERS: 'openai',
      }),
    );

    await service.complete({
      modelName: 'gpt-5.6-luna',
      messages: [{ role: 'user', content: 'test' }],
      temperature: 0.1,
      maxTokens: 100,
      responseFormat: { type: 'json_object' },
    });

    expect(requestBody).toEqual(
      expect.objectContaining({
        model: 'gpt-5.6-luna',
        max_completion_tokens: 100,
        reasoning_effort: 'medium',
        response_format: { type: 'json_object' },
      }),
    );
    expect(requestBody).not.toHaveProperty('temperature');
  });
});

describe('LlmCompletionService model floor', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function serviceWithFailingProvider(): {
    service: LlmCompletionService;
    modelsTried: string[];
  } {
    const modelsTried: string[] = [];
    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { model?: string };
      if (body.model) modelsTried.push(body.model);
      return new Response('upstream exploded', { status: 500 });
    }) as typeof fetch;

    const service = new LlmCompletionService(
      new ConfigService({
        OPENAI_API_KEY: 'test-key',
        DEEPSEEK_API_KEY: 'test-key',
        ALLOWED_AI_PROVIDERS: 'openai,deepseek',
        AI_LLM_MAX_RETRIES: '1',
      }),
    );
    return { service, modelsTried };
  }

  it('never falls back to a cheap model when a mid-tier floor is set', async () => {
    const { service, modelsTried } = serviceWithFailingProvider();

    await expect(
      service.complete({
        modelName: 'gpt-5.6-sol',
        messages: [{ role: 'user', content: 'verified research' }],
        minTier: 'mid',
      }),
    ).rejects.toThrow(/required analysis capability is temporarily unavailable/);

    expect(modelsTried).not.toContain('deepseek-chat');
    expect(modelsTried).not.toContain('gpt-4o-mini');
  });

  it('still uses the full fallback chain when no floor is set', async () => {
    const { service, modelsTried } = serviceWithFailingProvider();

    await expect(
      service.complete({
        modelName: 'gpt-5.6-sol',
        messages: [{ role: 'user', content: 'casual question' }],
      }),
    ).rejects.toThrow();

    expect(modelsTried.length).toBeGreaterThan(1);
  });

  it('reports the model that actually answered after a fallback', async () => {
    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { model?: string };
      if (body.model === 'gpt-5.6-sol') {
        return new Response('upstream exploded', { status: 500 });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const service = new LlmCompletionService(
      new ConfigService({
        OPENAI_API_KEY: 'test-key',
        ALLOWED_AI_PROVIDERS: 'openai',
        AI_LLM_MAX_RETRIES: '1',
      }),
    );

    const result = await service.complete({
      modelName: 'gpt-5.6-sol',
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.modelName).not.toBe('gpt-5.6-sol');
  });
});

describe('LlmCompletionService timeout', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('aborts a hung completion when timeoutMs elapses', async () => {
    global.fetch = jest.fn((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        const fail = () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        };
        if (signal?.aborted) {
          fail();
          return;
        }
        signal?.addEventListener('abort', fail, { once: true });
      });
    }) as typeof fetch;

    const service = new LlmCompletionService(
      new ConfigService({
        OPENAI_API_KEY: 'test-key',
        ALLOWED_AI_PROVIDERS: 'openai',
        AI_LLM_MAX_RETRIES: '1',
      }),
    );

    await expect(
      service.complete({
        modelName: 'gpt-5.6-luna',
        messages: [{ role: 'user', content: 'test' }],
        timeoutMs: 20,
      }),
    ).rejects.toThrow(/deadline|aborted|timed out/i);
  });
});

describe('Responses output integrity', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it.each([
    { type: 'json_object' as const },
    { type: 'json_schema' as const, json_schema: { name: 'case_plan', strict: true, schema: { type: 'object', properties: {}, additionalProperties: false } } },
  ])('preserves structured output constraints on the Responses route: $type', async (responseFormat) => {
    let body: any;
    global.fetch = jest.fn(async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] }), { status: 200 });
    }) as typeof fetch;
    const service = new LlmCompletionService(new ConfigService({ OPENAI_API_KEY: 'test-key', ALLOWED_AI_PROVIDERS: 'openai' }));
    const result = await service.complete({ modelName: 'gpt-5.6-sol', messages: [{ role: 'system', content: 'Return JSON matching the schema.' }, { role: 'user', content: 'Answer the legal question.' }], responseFormat });
    expect(result.content).toBe('{}');
    expect(body.text.format).toEqual(responseFormat.type === 'json_schema'
      ? { type: 'json_schema', ...responseFormat.json_schema } : { type: 'json_object' });
    expect(body).not.toHaveProperty('response_format');
    if (responseFormat.type === 'json_object') expect(body.input.some((message: any) => /json/i.test(message.content))).toBe(true);
  });

  it('never converts reasoning-only output into successful draft text', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ type: 'reasoning' }], usage: { input_tokens: 20, output_tokens: 3500 } }), { status: 200 })) as typeof fetch;
    const service = new LlmCompletionService(new ConfigService({ OPENAI_API_KEY: 'test-key', ALLOWED_AI_PROVIDERS: 'openai', AI_LLM_MAX_RETRIES: '1' }));
    await expect(service.complete({ modelName: 'gpt-5.6-sol', messages: [{ role: 'user', content: 'Draft grounds' }], minTier: 'mid' })).rejects.toThrow();
  });
});
