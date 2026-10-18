import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TrainingConsentGateService } from './training-consent-gate.service';

interface FineTuneMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface FineTuneRow {
  messages: FineTuneMessage[];
}

/**
 * The training prompt must match the jurisdiction of the exemplar. Training a
 * model on US pleadings under an "Indian legal drafter" instruction teaches it
 * that the persona is noise.
 */
function sectionSystemPrompt(jurisdiction?: string | null): string {
  const country = (jurisdiction ?? '').trim().split(/[-_]/)[0].toUpperCase();
  const persona = DRAFTER_PERSONA[country] ?? 'an expert legal drafter';
  return `You are ${persona}. Draft the specified section of a legal document with precision, proper citation, and formal legal language appropriate to the stated jurisdiction.`;
}

const DRAFTER_PERSONA: Record<string, string> = {
  IN: 'an expert Indian legal drafter',
  KE: 'an expert Kenyan legal drafter',
  US: 'an expert United States litigation drafter',
  GB: 'an expert England and Wales legal drafter',
};

/**
 * Exports accepted DraftSectionFeedback rows as an OpenAI-format JSONL
 * fine-tuning dataset.
 *
 * Text is already redacted (PII stripped at storage time), so no extra
 * sanitisation is required here.
 *
 * Usage: pipe the result to a file, then upload via OpenAI fine-tuning API.
 * Minimum ~10 rows recommended per section type for useful fine-tuning.
 */
@Injectable()
export class DraftFinetuneExportService {
  private readonly logger = new Logger(DraftFinetuneExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consentGate: TrainingConsentGateService,
  ) {}

  /**
   * Build a JSONL string ready for OpenAI fine-tuning.
   *
   * Filters:
   *   - rating IN (accepted, minor_edit)
   *   - editRatio >= minEditRatio (default 0.7 — user kept ≥70% of AI text)
   *   - Optional tenantId filter
   *   - Optional documentKind filter
   *   - Optional date range
   */
  async exportJsonl(options: {
    tenantId?: string;
    documentKind?: string;
    sectionType?: string;
    minEditRatio?: number;
    since?: Date;
    limit?: number;
  } = {}): Promise<{ jsonl: string; rowCount: number }> {
    const { tenantId, documentKind, sectionType, minEditRatio = 0.7, since, limit = 5000 } = options;

    // Fine-tuning writes customer text into model weights, so it is the
    // strictest gate: an explicit, un-withdrawn fine-tuning consent per tenant.
    const consented = await this.consentGate.consentedTenantIds('fineTuning');
    if (consented.length === 0) {
      this.logger.warn('Fine-tune export skipped — no tenant has granted fine-tuning consent');
      return { jsonl: '', rowCount: 0 };
    }
    if (tenantId && !consented.includes(tenantId)) {
      this.logger.warn(`Fine-tune export skipped — tenant ${tenantId} has not consented`);
      return { jsonl: '', rowCount: 0 };
    }

    const rows = await (this.prisma as any).draftSectionFeedback.findMany({
      where: {
        rating: { in: ['accepted', 'minor_edit'] },
        editRatio: { gte: minEditRatio },
        tenantId: tenantId ? tenantId : { in: consented },
        ...(documentKind ? { documentKind } : {}),
        ...(sectionType ? { sectionType } : {}),
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: {
        documentKind: true,
        sectionType: true,
        jurisdiction: true,
        rating: true,
        aiGeneratedText: true,
        userEditedText: true,
        editRatio: true,
      },
      orderBy: { createdAt: 'asc' as const },
      take: limit,
    });

    const lines: string[] = [];
    for (const row of rows) {
      const target = row.userEditedText && row.editRatio < 0.99
        ? row.userEditedText
        : row.aiGeneratedText;

      if (!target || target.trim().length < 50) continue;

      const ftRow: FineTuneRow = {
        messages: [
          { role: 'system', content: sectionSystemPrompt(row.jurisdiction) },
          {
            role: 'user',
            content: [
              `DOCUMENT KIND: ${row.documentKind}`,
              `SECTION TYPE: ${row.sectionType}`,
              row.jurisdiction ? `JURISDICTION: ${row.jurisdiction}` : '',
              '',
              'Draft this section.',
            ].filter(Boolean).join('\n'),
          },
          { role: 'assistant', content: target },
        ],
      };

      lines.push(JSON.stringify(ftRow));
    }

    this.logger.log(`Fine-tune export: ${lines.length} rows (of ${rows.length} candidates)`);
    return { jsonl: lines.join('\n'), rowCount: lines.length };
  }

  /** Summary statistics for the admin UI. */
  async getSummary(tenantId?: string): Promise<{
    totalFeedback: number;
    eligibleForTraining: number;
    byRating: Record<string, number>;
    byDocumentKind: Array<{ documentKind: string; count: number; acceptanceRate: number }>;
  }> {
    const all = await (this.prisma as any).draftSectionFeedback.findMany({
      where: tenantId ? { tenantId } : {},
      select: { rating: true, documentKind: true, editRatio: true },
    });

    const byRating: Record<string, number> = {};
    const kindMap = new Map<string, { total: number; accepted: number }>();

    for (const row of all) {
      byRating[row.rating] = (byRating[row.rating] ?? 0) + 1;

      const entry = kindMap.get(row.documentKind) ?? { total: 0, accepted: 0 };
      entry.total++;
      if (row.rating === 'accepted' || row.rating === 'minor_edit') entry.accepted++;
      kindMap.set(row.documentKind, entry);
    }

    const eligible = all.filter(
      (r: { rating: string; editRatio: number }) =>
        ['accepted', 'minor_edit'].includes(r.rating) && r.editRatio >= 0.7,
    ).length;

    const byDocumentKind = Array.from(kindMap.entries())
      .map(([documentKind, { total, accepted }]) => ({
        documentKind,
        count: total,
        acceptanceRate: accepted / Math.max(total, 1),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalFeedback: all.length,
      eligibleForTraining: eligible,
      byRating,
      byDocumentKind,
    };
  }
}
