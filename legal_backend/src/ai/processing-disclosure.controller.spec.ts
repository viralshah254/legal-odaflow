import { ConfigService } from '@nestjs/config';
import { ProcessingDisclosureController } from './processing-disclosure.controller';

describe('AI processing disclosure', () => {
  const disclosure = (values: Record<string, string>) => new ProcessingDisclosureController({ get: (key: string) => values[key] } as unknown as ConfigService).getDisclosure();
  it('identifies remaining auxiliary recipients even when text routing is Google-only', () => {
    expect(disclosure({ AI_PROVIDER: 'google', GOOGLE_AI_API_KEY: 'secret', OPENAI_API_KEY: 'secret', DEEPSEEK_API_KEY: 'secret' }).providers).toEqual(['Google', 'OpenAI']);
  });
  it('requires a new consent version if recipients change and does not disclose credentials', () => {
    const first = disclosure({ GOOGLE_AI_API_KEY: 'secret-value' });
    const second = disclosure({ GOOGLE_AI_API_KEY: 'secret-value', DEEPGRAM_API_KEY: 'secret-value' });
    expect(first.version).not.toBe(second.version);
    expect(JSON.stringify(second)).not.toContain('secret-value');
    expect(second.trainingPermissionSeparate).toBe(true);
  });
});
