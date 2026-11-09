/** Explicit live-provider canary using synthetic material only. Run with
 * node --env-file=.env -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/smoke-google-legal.ts
 * Never prints configuration, credentials, request URLs or private matter data. */
import { ConfigService } from '@nestjs/config';
import { GeminiCompletionAdapter } from '../src/ai/gemini-completion.adapter';

async function main() {
  const adapter = new GeminiCompletionAdapter(new ConfigService());
  if (!adapter.isConfigured()) throw new Error('Google provider configuration is missing');
  const modelName = adapter.defaultModelName();
  const source = 'SYNTHETIC BENCHMARK, NOT REAL LAW. Fictional Practice Rule 7: an extension may be granted for good cause if requested before the deadline; the opposing party must receive notice. No automatic extension exists. Paragraph 3 of the fictional order sets the deadline at 20 November 2026.';
  const cases = [
    { task: 'research', prompt: 'Our client is the respondent. A proposed extension request is dated 18 November 2026. Explain the available argument and missing facts. Cite only Rule 7 and order paragraph 3. Do not invent cases or assert that relief is guaranteed.' },
    { task: 'draft', prompt: 'Draft a short respondent application seeking an extension, dated 18 November 2026. The reason for delay and proposed new date are unknown: use explicit placeholders and do not invent facts. Address notice and the need for court approval. Cite only the supplied fictional materials.' },
  ];
  for (const sample of cases) {
    const started = Date.now();
    try {
      const result = await adapter.complete({
        modelName,
        messages: [{ role: 'system', content: source }, { role: 'user', content: sample.prompt }],
        maxTokens: 1600, temperature: 0.1, signal: AbortSignal.timeout(45_000),
      });
      process.stdout.write(JSON.stringify({
        task: sample.task, elapsedMs: Date.now() - started,
        modelName: result.modelName, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        finishReason: result.finishReason, output: result.content,
      }) + '\n');
    } catch (error) {
      const safe = error as { name?: string; status?: number; cause?: { code?: string } };
      process.stdout.write(JSON.stringify({ task: sample.task, elapsedMs: Date.now() - started, errorType: safe.name ?? 'Error', status: safe.status ?? null, causeCode: safe.cause?.code ?? null }) + '\n');
      process.exitCode = 1;
      break;
    }
  }
}
void main().catch((error) => {
  process.stderr.write(JSON.stringify({ errorType: error?.name ?? 'Error' }) + '\n');
  process.exitCode = 1;
});
