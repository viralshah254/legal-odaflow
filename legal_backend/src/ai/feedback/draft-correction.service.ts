import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createHash } from 'crypto';
import { AuthorityTrustService } from './authority-trust.service';

export interface ApprovedDraftCorrection {
  documentKind: string;
  wrongCitation: string;
  correctCitation: string;
  wrongSection?: string | null;
  correctSection?: string | null;
  confidence: number;
  jurisdiction?: string | null;
}

export interface StoreDraftCorrectionInput {
  tenantId?: string;
  documentKind: string;
  jurisdiction?: string;
  countryCode?: string;
  wrongCitation: string;
  correctCitation: string;
  wrongSection?: string;
  correctSection?: string;
  authorityIdWrong?: string;
  authorityIdCorrect?: string;
  courtDraftRecordId?: string;
  confidence?: number;
}

/**
 * Drafting correction signals — mirrors ResearchCorrectionService for research.
 * Approved corrections are injected into generation prompts via PromptInjectionService.
 */
@Injectable()
export class DraftCorrectionService {
  private readonly logger = new Logger(DraftCorrectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorityTrust: AuthorityTrustService,
  ) {}

  async storePending(input: StoreDraftCorrectionInput): Promise<void> {
    const wrong = input.wrongCitation.trim();
    const correct = input.correctCitation.trim();
    if (!wrong || !correct || wrong.toLowerCase() === correct.toLowerCase()) return;

    const countryCode = (input.countryCode ?? 'IN').toUpperCase();

    try {
      const existing = await (this.prisma as any).draftCorrectionSignal.findFirst({
        where: {
          documentKind: input.documentKind,
          wrongCitation: wrong,
          correctCitation: correct,
          status: { in: ['pending', 'approved'] },
        },
      });
      if (existing) return;

      await (this.prisma as any).draftCorrectionSignal.create({
        data: {
          tenantId: input.tenantId ?? null,
          documentKind: input.documentKind,
          jurisdiction: input.jurisdiction ?? null,
          countryCode,
          wrongCitation: wrong,
          correctCitation: correct,
          wrongSection: input.wrongSection ?? null,
          correctSection: input.correctSection ?? null,
          authorityIdWrong: input.authorityIdWrong ?? null,
          authorityIdCorrect: input.authorityIdCorrect ?? null,
          courtDraftRecordId: input.courtDraftRecordId ?? null,
          confidence: input.confidence ?? 0.5,
          status: 'pending',
        },
      });

      if (input.authorityIdWrong) {
        await this.authorityTrust.recordUserRemoved(input.authorityIdWrong, countryCode);
      }
      if (input.authorityIdCorrect) {
        await this.authorityTrust.recordUserReadded(input.authorityIdCorrect, countryCode);
      }

      this.logger.log(
        `Stored pending draft correction: "${wrong}" → "${correct}" (${input.documentKind})`,
      );
    } catch (err) {
      this.logger.warn(`Failed to store draft correction: ${String(err)}`);
    }
  }

  /**
   * Infer a correction when verification strips a citation and the user later
   * re-adds a different authority in the same draft.
   */
  async storeFromStripAndReplace(input: {
    tenantId?: string;
    documentKind: string;
    jurisdiction?: string;
    countryCode?: string;
    strippedCitation: string;
    replacementCitation: string;
    courtDraftRecordId?: string;
  }): Promise<void> {
    await this.storePending({
      ...input,
      wrongCitation: input.strippedCitation,
      correctCitation: input.replacementCitation,
      confidence: 0.6,
    });
  }

  async loadApprovedCorrections(opts: {
    documentKind?: string;
    countryCode?: string;
    limit?: number;
  } = {}): Promise<ApprovedDraftCorrection[]> {
    try {
      const rows = await (this.prisma as any).draftCorrectionSignal.findMany({
        where: {
          status: 'approved',
          ...(opts.documentKind ? { documentKind: opts.documentKind } : {}),
          ...(opts.countryCode ? { countryCode: opts.countryCode.toUpperCase() } : {}),
        },
        orderBy: { confidence: 'desc' },
        take: opts.limit ?? 40,
      });
      return rows.map((r: ApprovedDraftCorrection & { wrongSection?: string; correctSection?: string; jurisdiction?: string }) => ({
        documentKind: r.documentKind,
        wrongCitation: r.wrongCitation,
        correctCitation: r.correctCitation,
        wrongSection: r.wrongSection,
        correctSection: r.correctSection,
        confidence: r.confidence,
        jurisdiction: r.jurisdiction,
      }));
    } catch {
      return [];
    }
  }

  buildApprovedCorrectionsPromptBlock(corrections: ApprovedDraftCorrection[]): string {
    if (corrections.length === 0) return '';
    const lines = corrections.map(
      (c) =>
        `- Do NOT cite "${c.wrongCitation}". Prefer "${c.correctCitation}"` +
        (c.correctSection ? ` (section ${c.correctSection})` : '') +
        ` (confidence ${(c.confidence * 100).toFixed(0)}%).`,
    );
    return [
      '## Known Draft Citation Corrections (approved by platform review)',
      'The following citation corrections have been approved. Do NOT repeat the wrong citation.',
      ...lines,
    ].join('\n');
  }

  async listPendingSignals(opts: {
    documentKind?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where = {
      ...(opts.documentKind ? { documentKind: opts.documentKind } : {}),
      status: opts.status ?? 'pending',
    };
    const [total, items] = await Promise.all([
      (this.prisma as any).draftCorrectionSignal.count({ where }),
      (this.prisma as any).draftCorrectionSignal.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
    ]);
    return { total, items };
  }

  async approveSignal(id: string, reviewedByUserId: string, reviewNotes?: string) {
    return (this.prisma as any).draftCorrectionSignal.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedByUserId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });
  }

  async rejectSignal(id: string, reviewedByUserId: string, reviewNotes?: string) {
    return (this.prisma as any).draftCorrectionSignal.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedByUserId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });
  }

  /** Stable fingerprint for deduping similar correction pairs. */
  correctionFingerprint(wrong: string, correct: string): string {
    return createHash('sha256')
      .update(`${wrong.trim().toLowerCase()}||${correct.trim().toLowerCase()}`)
      .digest('hex')
      .slice(0, 16);
  }
}
