import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';
import { EvidenceAnalysisService } from './evidence-analysis.service';
import type { EvidenceRef, MatterProfile } from './matter-intelligence.types';

export interface EvidenceExtractionInput {
  fileName: string;
  mimeType?: string;
  textContent?: string;
  matterId?: string;
  consumerCaseId?: string;
  sourceDocumentId?: string;
  matterProfile?: MatterProfile;
}

export interface EvidenceExtractionResult {
  items: EvidenceRef[];
  status: 'completed' | 'empty';
  contradictions?: Array<{ itemA: string; itemB: string; reason: string }>;
}

interface LlmEvidenceItem {
  description: string;
  date?: string | null;
  party?: string | null;
  docType?: string | null;
}

/** P13 — OCR text → structured evidence items for MatterGraph. */
@Injectable()
export class EvidenceExtractorService {
  private readonly logger = new Logger(EvidenceExtractorService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly analysis: EvidenceAnalysisService,
  ) {}

  async extract(input: EvidenceExtractionInput): Promise<EvidenceExtractionResult> {
    const text = input.textContent?.trim();
    if (!text) {
      return { items: [], status: 'empty' };
    }

    let items: EvidenceRef[] = [];
    if (this.llm.isProviderConfigured('openai') && text.length > 80) {
      try {
        items = await this.extractWithLlm(text, input);
      } catch (err) {
        this.logger.warn(
          `LLM evidence extraction failed for ${input.fileName}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }

    if (items.length === 0) {
      items = [this.fallbackItem(text, input)];
    }

    const analyzed = this.analysis.analyze(items);
    return {
      items: analyzed.items,
      status: 'completed',
      contradictions: analyzed.contradictions,
    };
  }

  private fallbackItem(text: string, input: EvidenceExtractionInput): EvidenceRef {
    return {
      id: randomUUID(),
      description: text.slice(0, 500),
      sourceType: input.mimeType ?? 'document',
      sourceDocumentId: input.sourceDocumentId,
      docType: this.inferDocType(input.fileName, text),
    };
  }

  private async extractWithLlm(
    text: string,
    input: EvidenceExtractionInput,
  ): Promise<EvidenceRef[]> {
    const practiceHint = input.matterProfile?.practiceArea
      ? `Practice area: ${input.matterProfile.practiceArea}.`
      : '';

    const prompt = `${practiceHint}
Extract discrete evidence items from this document. Return JSON:
{"items":[{"description":"","date":null,"party":null,"docType":null}]}
Rules: 1-8 items; description is one factual sentence; date ISO or null; party name or null; docType e.g. email, letter, payslip.
Document (${input.fileName}):
${text.slice(0, 6000)}`;

    const response = await this.llm.complete({
      modelName: DEFAULT_AUTO_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You extract structured legal evidence from documents. Return valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: 800,
      temperature: 0,
    });

    const raw = response.content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(raw) as { items?: LlmEvidenceItem[] };
    const rows = Array.isArray(parsed.items) ? parsed.items : [];

    return rows
      .filter((row) => row.description?.trim())
      .map((row) => ({
        id: randomUUID(),
        description: row.description.trim(),
        date: row.date ?? undefined,
        party: row.party ?? undefined,
        docType: row.docType ?? this.inferDocType(input.fileName, text),
        sourceType: input.mimeType ?? 'document',
        sourceDocumentId: input.sourceDocumentId,
      }));
  }

  private inferDocType(fileName: string, text: string): string {
    const name = fileName.toLowerCase();
    if (/\.pdf$/.test(name) && /\bnotice\b/i.test(text)) return 'legal_notice';
    if (/payslip|salary/i.test(text)) return 'payslip';
    if (/email|@/.test(text)) return 'email';
    if (/whatsapp|telegram/i.test(text)) return 'chat';
    if (/contract|agreement/i.test(text)) return 'contract';
    return 'document';
  }
}
