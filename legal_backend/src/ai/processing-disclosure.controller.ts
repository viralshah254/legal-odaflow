import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Public } from '@/common/decorators/public.decorator';

@Controller('ai/processing-disclosure')
export class ProcessingDisclosureController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  getDisclosure() {
    const names = new Set<string>();
    const has = (key: string) => Boolean(this.config.get<string>(key)?.trim());
    const googleOnly = this.config.get<string>('AI_PROVIDER') === 'google';
    if (has('GOOGLE_AI_API_KEY') || has('GOOGLE_CLOUD_PROJECT')) names.add('Google');
    // Existing embeddings and batch audio still use OpenAI even when central
    // text routing is Google-only. Disclose that actual remaining dependency.
    if (has('OPENAI_API_KEY') || has('AZURE_OPENAI_API_KEY')) names.add('OpenAI');
    if (!googleOnly && has('DEEPSEEK_API_KEY')) names.add('DeepSeek');
    if (has('DEEPGRAM_API_KEY')) names.add('Deepgram');
    const providers = [...names].sort();
    const dataCategories = ['Questions and instructions', 'Authorized matter facts and selected document excerpts', 'Research and draft text', 'Audio when using transcription'];
    const version = 'inference-v2-' + createHash('sha256').update(JSON.stringify({ providers, dataCategories })).digest('hex').slice(0, 16);
    return {
      version, providers, dataCategories,
      purpose: 'Process the legal research, drafting, analysis or transcription you request.',
      trainingPermissionSeparate: true,
      privacyPolicyPath: '/privacy', consentPolicyPath: '/data-consent',
      // A recipient list cannot certify contractual data handling or paid-tier
      // status. Those are separate operational release checks.
    };
  }
}
