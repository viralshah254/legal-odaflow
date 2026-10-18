import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DocumentIngestService } from '@/drafting-session/document-ingest.service';
import { PRESET_DRAFT_STYLES } from '@/ai/drafting/draft-style-presets';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';

const MAX_SAMPLES = 4;
const MAX_TEXT_PER_SAMPLE = 3000;
const STYLE_ANALYSIS_CREDITS = 500;

interface SampleDocument {
  filename: string;
  extractedText: string;
}

@Injectable()
export class UserDraftStyleService {
  private readonly logger = new Logger(UserDraftStyleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: AICreditLedgerService,
    private readonly llm: LlmCompletionService,
    private readonly ingest: DocumentIngestService,
  ) {}

  /** Upload one sample document. Free — no credit charge. Max 4 samples total. */
  async uploadSample(
    userId: string,
    buffer: Buffer,
    mime: string,
    filename: string,
  ): Promise<{ documentCount: number; message: string }> {
    const existing = await this.getOrCreate(userId);
    const samples: SampleDocument[] = Array.isArray(existing.sampleDocuments)
      ? (existing.sampleDocuments as SampleDocument[])
      : [];

    if (samples.length >= MAX_SAMPLES) {
      throw new BadRequestException(
        `You can upload a maximum of ${MAX_SAMPLES} sample documents. Remove one first to add another.`,
      );
    }

    const result = await this.ingest.ingestBuffer(buffer, mime, filename);
    const extractedText = result.plainText.slice(0, MAX_TEXT_PER_SAMPLE);

    if (extractedText.trim().length < 100) {
      throw new BadRequestException(
        'Could not extract enough text from this file. Please upload a readable PDF, DOCX, or TXT.',
      );
    }

    samples.push({ filename, extractedText });

    const updated = await (this.prisma as any).userDraftStyle.update({
      where: { userId },
      data: {
        sampleDocuments: samples as any,
        documentCount: samples.length,
        // Reset to pending if they add new samples after a ready analysis
        status: existing.status === 'ready' ? 'pending' : existing.status,
      },
    });

    return {
      documentCount: updated.documentCount,
      message: `Sample uploaded. You now have ${updated.documentCount}/${MAX_SAMPLES} samples.`,
    };
  }

  /**
   * Remove a sample by filename index. Free.
   * Resets status to pending so the user must re-analyze.
   */
  async removeSample(userId: string, index: number): Promise<{ documentCount: number }> {
    const existing = await this.getOrCreate(userId);
    const samples: SampleDocument[] = Array.isArray(existing.sampleDocuments)
      ? (existing.sampleDocuments as SampleDocument[])
      : [];

    if (index < 0 || index >= samples.length) {
      throw new BadRequestException('Invalid sample index.');
    }

    samples.splice(index, 1);

    const updated = await (this.prisma as any).userDraftStyle.update({
      where: { userId },
      data: {
        sampleDocuments: samples as any,
        documentCount: samples.length,
        status: 'pending',
        styleProfile: null,
        styleKeywords: [],
        avoidPatterns: [],
      },
    });

    return { documentCount: updated.documentCount };
  }

  /**
   * Trigger style analysis. Charges 500 credits.
   * Runs LLM extraction synchronously then stores results.
   */
  async analyzeStyle(userId: string): Promise<{ status: string; creditsCharged: number }> {
    const existing = await this.getOrCreate(userId);
    const samples: SampleDocument[] = Array.isArray(existing.sampleDocuments)
      ? (existing.sampleDocuments as SampleDocument[])
      : [];

    if (samples.length === 0) {
      throw new BadRequestException(
        'Upload at least 1 sample document before analyzing your style.',
      );
    }

    // Check credit balance
    const balance = await this.ledger.getBalance({ userId });
    if (balance < STYLE_ANALYSIS_CREDITS) {
      throw new ForbiddenException(
        `Insufficient credits. Style analysis costs ${STYLE_ANALYSIS_CREDITS} credits. You have ${balance} credits.`,
      );
    }

    // Deduct credits first
    await this.ledger.debit({
      userId,
      taskType: AI_TASK_TYPES.STYLE_ANALYSIS,
      credits: STYLE_ANALYSIS_CREDITS,
      metadata: { sampleCount: samples.length },
    });

    // Set processing state
    await (this.prisma as any).userDraftStyle.update({
      where: { userId },
      data: { status: 'processing' },
    });

    // Run LLM analysis
    try {
      const profile = await this.runStyleExtraction(userId, samples);

      await (this.prisma as any).userDraftStyle.update({
        where: { userId },
        data: {
          status: 'ready',
          styleProfile: profile.styleProfile,
          styleKeywords: profile.styleKeywords,
          avoidPatterns: profile.avoidPatterns,
          styleVersion: { increment: 1 },
        },
      });
    } catch (err) {
      this.logger.error(`Style analysis failed for user ${userId}`, err);
      await (this.prisma as any).userDraftStyle.update({
        where: { userId },
        data: { status: 'pending' },
      });
      throw err;
    }

    return { status: 'ready', creditsCharged: STYLE_ANALYSIS_CREDITS };
  }

  /** Get current style record for this user, or null if never created. */
  async getStyle(userId: string): Promise<{
    status: string;
    documentCount: number;
    styleProfile: string | null;
    styleKeywords: string[];
    avoidPatterns: string[];
    styleVersion: number;
    creditBalance: number;
  } | null> {
    const record = await (this.prisma as any).userDraftStyle
      .findUnique({ where: { userId } })
      .catch(() => null);

    const balance = await this.ledger.getBalance({ userId });

    if (!record) {
      return {
        status: 'none',
        documentCount: 0,
        styleProfile: null,
        styleKeywords: [],
        avoidPatterns: [],
        styleVersion: 0,
        creditBalance: balance,
      };
    }

    return {
      status: record.status,
      documentCount: record.documentCount,
      styleProfile: record.styleProfile,
      styleKeywords: record.styleKeywords ?? [],
      avoidPatterns: record.avoidPatterns ?? [],
      styleVersion: record.styleVersion,
      creditBalance: balance,
    };
  }

  /** Reset all style data. Free. Does not refund credits. */
  async resetStyle(userId: string): Promise<void> {
    await (this.prisma as any).userDraftStyle.upsert({
      where: { userId },
      create: { userId },
      update: {
        status: 'pending',
        sampleDocuments: [],
        styleProfile: null,
        styleKeywords: [],
        avoidPatterns: [],
        documentCount: 0,
      },
    });
  }

  /** Returns the list of preset styles (static — no DB). */
  getPresets() {
    return PRESET_DRAFT_STYLES.map(({ id, label, description }) => ({ id, label, description }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getOrCreate(userId: string) {
    return (this.prisma as any).userDraftStyle.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async runStyleExtraction(
    userId: string,
    samples: SampleDocument[],
  ): Promise<{ styleProfile: string; styleKeywords: string[]; avoidPatterns: string[] }> {
    const samplesText = samples
      .map((s, i) => `--- SAMPLE ${i + 1}: ${s.filename} ---\n${s.extractedText}`)
      .join('\n\n');

    const systemPrompt = `You are a legal writing analyst. Your task is to extract the distinctive drafting style of a lawyer from their sample documents.

Analyse the provided samples and produce a structured JSON response with:
1. "styleProfile" — a 200-300 word prose description of the lawyer's drafting style: tone, register, sentence structure, paragraph length, use of headings, preferred phrasing patterns, and any distinctive habits.
2. "styleKeywords" — an array of 5-10 specific words, phrases, or constructions that appear repeatedly and characterise this lawyer's voice (e.g. "it is respectfully submitted", "impugned order", "without prejudice to the foregoing").
3. "avoidPatterns" — an array of 3-6 things this style does NOT do (e.g. "avoids passive voice", "never uses sub-clauses within sub-clauses", "does not include lengthy background recitals").

Respond with ONLY valid JSON. No markdown fences. Example format:
{"styleProfile":"...","styleKeywords":["..."],"avoidPatterns":["..."]}`;

    const userMessage = `Analyse these ${samples.length} sample legal documents written by the same lawyer:\n\n${samplesText}`;

    const result = await this.llm.complete({
      modelName: DEFAULT_AUTO_MODEL,
      systemBlocks: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
      maxTokens: 800,
    });

    try {
      const parsed = JSON.parse(result.content);
      return {
        styleProfile: String(parsed.styleProfile ?? ''),
        styleKeywords: Array.isArray(parsed.styleKeywords)
          ? parsed.styleKeywords.filter((k: unknown) => typeof k === 'string')
          : [],
        avoidPatterns: Array.isArray(parsed.avoidPatterns)
          ? parsed.avoidPatterns.filter((p: unknown) => typeof p === 'string')
          : [],
      };
    } catch {
      this.logger.error(`Failed to parse style extraction JSON for user ${userId}`);
      // Fallback: store raw content as style profile
      return {
        styleProfile: result.content.slice(0, 1500),
        styleKeywords: [],
        avoidPatterns: [],
      };
    }
  }
}
