import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createHash } from 'crypto';
import type { SectionChecksAudit } from './similar-cases.types';
import type { SimilarCase } from './similar-cases.types';

export interface ApprovedCorrection {
  countryCode: string;
  wrongSection: string;
  correctSection: string;
  confidence: number;
}

@Injectable()
export class ResearchCorrectionService {
  private readonly logger = new Logger(ResearchCorrectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** SHA-256 fingerprint of a query (first 16 hex chars). */
  queryFingerprint(query: string): string {
    return createHash('sha256').update(query.trim().toLowerCase()).digest('hex').slice(0, 16);
  }

  /**
   * Persist a pending correction signal when the section-mismatch audit
   * detected a confirmed correction. Only stored when confidence is meaningful.
   */
  async storePendingSignals(input: {
    query: string;
    countryCode: string;
    aiOutputId: string;
    sectionAudit: SectionChecksAudit;
    similarCases: SimilarCase[];
    primarySourceAuthorityId?: string;
  }): Promise<void> {
    const { query, countryCode, aiOutputId, sectionAudit, similarCases, primarySourceAuthorityId } =
      input;

    const correctedEntries = sectionAudit.entries.filter(
      (e) => e.corrected && e.confirmedSections.length > 0,
    );

    if (correctedEntries.length === 0) return;

    const qf = this.queryFingerprint(query);

    for (const entry of correctedEntries) {
      for (const correctSection of entry.confirmedSections) {
        const supportingCaseIds = similarCases
          .filter((c) =>
            c.relevantSections.some((s) => s === correctSection),
          )
          .map((c) => c.authorityId);

        // confidence = ratio of similar cases that cited the correct section
        const confidence =
          similarCases.length > 0 ? supportingCaseIds.length / similarCases.length : 0;

        if (confidence < 0.2) continue;

        try {
          // Upsert: don't create a duplicate pending signal for the same query + wrong + correct
          const existing = await this.prisma.sectionCorrectionSignal.findFirst({
            where: {
              queryFingerprint: qf,
              wrongSection: entry.originalSection,
              correctSection,
              status: { in: ['pending', 'approved'] },
            },
          });

          if (existing) continue;

          await this.prisma.sectionCorrectionSignal.create({
            data: {
              countryCode,
              queryFingerprint: qf,
              wrongSection: entry.originalSection,
              correctSection,
              primarySourceAuthorityId: primarySourceAuthorityId ?? null,
              supportingCaseIds,
              aiOutputId,
              confidence,
              status: 'pending',
            },
          });
          this.logger.log(
            `Stored pending correction signal: ${entry.originalSection} → ${correctSection} (confidence ${confidence.toFixed(2)})`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to store correction signal: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  /**
   * Load all approved correction signals for a given country.
   * Used to boost retrieval and add prompt warnings before LLM generation.
   */
  async loadApprovedCorrections(countryCode: string): Promise<ApprovedCorrection[]> {
    try {
      const rows = await this.prisma.sectionCorrectionSignal.findMany({
        where: { countryCode, status: 'approved' },
        orderBy: { confidence: 'desc' },
        take: 50,
      });
      return rows.map((r: { countryCode: string; wrongSection: string; correctSection: string; confidence: number }) => ({
        countryCode: r.countryCode,
        wrongSection: r.wrongSection,
        correctSection: r.correctSection,
        confidence: r.confidence,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Builds a compact prompt warning block from approved corrections.
   * Injected before LLM synthesis to prevent recurrence of known wrong sections.
   */
  buildApprovedCorrectionsPromptBlock(corrections: ApprovedCorrection[]): string {
    if (corrections.length === 0) return '';
    const lines = corrections.map(
      (c) =>
        `- Previously verified: "${c.wrongSection}" is incorrect for this issue type. ` +
        `Prefer "${c.correctSection}" (confirmed against primary law, confidence ${(c.confidence * 100).toFixed(0)}%).`,
    );
    return [
      '## Known Section Corrections (approved by platform review)',
      'The following section corrections have been approved by the platform. Do NOT cite the wrong section.',
      ...lines,
    ].join('\n');
  }

  // ── Admin review methods ─────────────────────────────────────────────────

  async listPendingSignals(opts: {
    countryCode?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where = {
      ...(opts.countryCode ? { countryCode: opts.countryCode } : {}),
      status: opts.status ?? 'pending',
    };
    const [total, items] = await Promise.all([
      this.prisma.sectionCorrectionSignal.count({ where }),
      this.prisma.sectionCorrectionSignal.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
    ]);
    return { total, items };
  }

  async getSignal(id: string) {
    return this.prisma.sectionCorrectionSignal.findUniqueOrThrow({ where: { id } });
  }

  async approveSignal(id: string, reviewedByUserId: string, reviewNotes?: string) {
    return this.prisma.sectionCorrectionSignal.update({
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
    return this.prisma.sectionCorrectionSignal.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedByUserId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });
  }
}
