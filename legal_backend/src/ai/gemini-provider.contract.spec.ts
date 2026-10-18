/**
 * C08 – Gemini provider contract spec (B06 fix)
 *
 * Verifies:
 * 1. stream() yields progressive deltas, not a single full-completion chunk.
 * 2. complete() returns normalized LlmCompletionResult (provider='google').
 * 3. completeWithImage() builds a multimodal contents array.
 * 4. isConfigured() detects API key and Vertex ADC configs correctly.
 * 5. Provider failures propagate as errors, not as empty successful results.
 *
 * These tests mock @google/genai so no real API calls are made.
 */

import { ConfigService } from '@nestjs/config';
import { GeminiCompletionAdapter } from './gemini-completion.adapter';

// ---------------------------------------------------------------------------
// Mock @google/genai
// ---------------------------------------------------------------------------

// Use a shared mutable object so tests can replace the implementations
// without losing the reference captured by the jest.mock() factory.
const googleGenAIMock = {
  generateContent: jest.fn(),
  generateContentStream: jest.fn(),
};

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: any[]) => googleGenAIMock.generateContent(...args),
      generateContentStream: (...args: any[]) => googleGenAIMock.generateContentStream(...args),
    },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(env: Record<string, string> = {}): GeminiCompletionAdapter {
  const configService = {
    get: jest.fn((key: string, def?: string) => env[key] ?? def ?? undefined),
  } as unknown as ConfigService;
  return new GeminiCompletionAdapter(configService);
}

function apiKeyAdapter(): GeminiCompletionAdapter {
  return makeAdapter({ GOOGLE_AI_API_KEY: 'test-api-key' });
}

const baseMessages = [
  { role: 'system' as const, content: 'You are a legal AI assistant.' },
  { role: 'user' as const, content: 'Summarize the case.' },
];

beforeEach(() => {
  googleGenAIMock.generateContent.mockReset();
  googleGenAIMock.generateContentStream.mockReset();
});

// ---------------------------------------------------------------------------
// isConfigured()
// ---------------------------------------------------------------------------

describe('C08 – GeminiCompletionAdapter.isConfigured()', () => {
  it('returns true when GOOGLE_AI_API_KEY is set', () => {
    const adapter = makeAdapter({ GOOGLE_AI_API_KEY: 'key-123' });
    expect(adapter.isConfigured()).toBe(true);
  });

  it('returns true when GOOGLE_CLOUD_PROJECT + VERTEX_LOCATION are set', () => {
    const adapter = makeAdapter({
      GOOGLE_CLOUD_PROJECT: 'my-project',
      VERTEX_LOCATION: 'us-central1',
    });
    expect(adapter.isConfigured()).toBe(true);
  });

  it('returns false when neither API key nor Vertex config is present', () => {
    const adapter = makeAdapter({});
    expect(adapter.isConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// complete()
// ---------------------------------------------------------------------------

describe('C08 – GeminiCompletionAdapter.complete()', () => {
  beforeEach(() => {
    googleGenAIMock.generateContent = jest.fn().mockResolvedValue({ text: 'The case concerns liability.' });
    // Re-import so the mock inside the adapter picks up the new function
    jest.isolateModules(() => {});
  });

  it('returns provider="google" and modelName', async () => {
    googleGenAIMock.generateContent.mockResolvedValue({ text: 'Generated legal text.' });

    const adapter = apiKeyAdapter();
    const result = await adapter.complete({
      modelName: 'gemini-2.5-flash',
      messages: baseMessages,
    });

    expect(result.provider).toBe('google');
    expect(result.modelName).toBe('gemini-2.5-flash');
    expect(result.content).toBe('Generated legal text.');
    expect(result.finishReason).toBe('stop');
  });

  it('uses defaultModelName when non-gemini model is passed', async () => {
    googleGenAIMock.generateContent.mockResolvedValue({ text: 'ok' });

    const adapter = makeAdapter({ GOOGLE_AI_API_KEY: 'key', GEMINI_MODEL: 'gemini-2.5-pro' });
    const result = await adapter.complete({
      modelName: 'gpt-4o', // not a gemini model — should fall back to default
      messages: baseMessages,
    });

    expect(result.modelName).toBe('gemini-2.5-pro');
  });

  it('returns estimated token counts', async () => {
    googleGenAIMock.generateContent.mockResolvedValue({ text: 'Short answer.' });

    const adapter = apiKeyAdapter();
    const result = await adapter.complete({
      modelName: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Hello world' }],
    });

    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
  });

  it('propagates provider error — does not return empty success', async () => {
    googleGenAIMock.generateContent.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

    const adapter = apiKeyAdapter();
    await expect(
      adapter.complete({ modelName: 'gemini-2.5-flash', messages: baseMessages }),
    ).rejects.toThrow('QUOTA_EXCEEDED');
  });
});

// ---------------------------------------------------------------------------
// stream() — B06 fix
// ---------------------------------------------------------------------------

describe('C08 – GeminiCompletionAdapter.stream() (B06 fix)', () => {
  it('yields progressive deltas from generateContentStream', async () => {
    // Simulate the async iterable from @google/genai
    async function* fakeStream() {
      yield { text: 'First ' };
      yield { text: 'chunk ' };
      yield { text: 'arrives.' };
    }
    googleGenAIMock.generateContentStream.mockResolvedValue(fakeStream());

    const adapter = apiKeyAdapter();
    const deltas: string[] = [];

    for await (const chunk of adapter.stream({
      modelName: 'gemini-2.5-flash',
      messages: baseMessages,
    })) {
      if (!chunk.done) deltas.push(chunk.delta);
    }

    expect(deltas).toEqual(['First ', 'chunk ', 'arrives.']);
  });

  it('yields multiple chunks before the final done=true chunk', async () => {
    async function* fakeStream() {
      yield { text: 'A' };
      yield { text: 'B' };
      yield { text: 'C' };
    }
    googleGenAIMock.generateContentStream.mockResolvedValue(fakeStream());

    const adapter = apiKeyAdapter();
    const chunks: Array<{ delta: string; done?: boolean }> = [];

    for await (const chunk of adapter.stream({
      modelName: 'gemini-2.5-flash',
      messages: baseMessages,
    })) {
      chunks.push(chunk);
    }

    // Should have content chunks plus final done chunk
    const contentChunks = chunks.filter((c) => !c.done);
    const doneChunks = chunks.filter((c) => c.done === true);

    expect(contentChunks.length).toBeGreaterThanOrEqual(3);
    expect(doneChunks).toHaveLength(1);
  });

  it('propagates streaming error — never yields partial success', async () => {
    async function* fakeStream() {
      yield { text: 'start ' };
      throw new Error('STREAM_INTERRUPTED');
    }
    googleGenAIMock.generateContentStream.mockResolvedValue(fakeStream());

    const adapter = apiKeyAdapter();
    const collected: string[] = [];

    await expect(async () => {
      for await (const chunk of adapter.stream({
        modelName: 'gemini-2.5-flash',
        messages: baseMessages,
      })) {
        if (!chunk.done) collected.push(chunk.delta);
      }
    }).rejects.toThrow('STREAM_INTERRUPTED');
  });

  it('uses generateContentStream, NOT generateContent (real streaming call)', async () => {
    async function* empty() {}
    googleGenAIMock.generateContentStream.mockResolvedValue(empty());
    googleGenAIMock.generateContent.mockResolvedValue({ text: 'should not be called' });

    const adapter = apiKeyAdapter();
    for await (const _ of adapter.stream({
      modelName: 'gemini-2.5-flash',
      messages: baseMessages,
    })) { /* drain */ }

    expect(googleGenAIMock.generateContentStream).toHaveBeenCalledTimes(1);
    expect(googleGenAIMock.generateContent).not.toHaveBeenCalled(); // B06 fix confirmed
  });
});

// ---------------------------------------------------------------------------
// completeWithImage()
// ---------------------------------------------------------------------------

describe('C08 – GeminiCompletionAdapter.completeWithImage()', () => {
  it('builds contents with image inlineData parts', async () => {
    googleGenAIMock.generateContent.mockResolvedValue({ text: 'I see the document.' });

    const adapter = apiKeyAdapter();
    const result = await adapter.completeWithImage({
      modelName: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: 'You are a legal document reader.' },
        { role: 'user', content: 'What does this document say?' },
      ],
      imageParts: [{ mimeType: 'image/jpeg', data: 'base64-encoded-data' }],
    });

    expect(result.content).toBe('I see the document.');
    expect(result.provider).toBe('google');

    // Verify generateContent was called with inlineData parts
    const call = googleGenAIMock.generateContent.mock.calls[0][0];
    const userContent = call.contents.find((c: any) => c.role === 'user');
    const hasInlineData = userContent.parts.some((p: any) => p.inlineData?.mimeType === 'image/jpeg');
    expect(hasInlineData).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// System instruction pass-through
// ---------------------------------------------------------------------------

describe('C08 – System instruction is passed to all calls', () => {
  it('complete() extracts system messages into systemInstruction', async () => {
    googleGenAIMock.generateContent.mockResolvedValue({ text: 'ok' });

    const adapter = apiKeyAdapter();
    await adapter.complete({
      modelName: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'SYSTEM: be concise' },
        { role: 'user', content: 'Hello' },
      ],
    });

    const call = googleGenAIMock.generateContent.mock.calls[0][0];
    expect(call.config.systemInstruction).toBe('SYSTEM: be concise');
    // System message should NOT appear in contents
    const hasSystemInContents = call.contents.some((c: any) =>
      c.parts.some((p: any) => p.text?.includes('SYSTEM:')),
    );
    expect(hasSystemInContents).toBe(false);
  });
});
