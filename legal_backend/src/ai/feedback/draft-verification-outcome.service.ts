import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';
import { AuthorityTrustService } from './authority-trust.service';
import { normalizeCountry } from './draft-training-pipeline.service';

export interface RecordVerificationOutcomeInput {
  tenantId: string;
  userId?: string;
  documentKind: string;
  jurisdiction?: string;
  courtDraftRecordId?: string;
  draftJobId?: string;
  audit: DraftVerificationAudit;
  repairAttempted?: boolean;
  repairSucceeded?: boolean;
  regenAttempts?: number;
  modelUsed?: string;
  countryCode?: string;
}

/**
 * Persists verify/repair outcomes as training signals even when the lawyer
 * never clicks thumbs. Also updates AuthorityTrustScore for stripped citations.
 */
@Injectable()
export class DraftVerificationOutcomeService {
  private readonly logger = new Logger(DraftVerificationOutcomeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly authorityTrust: AuthorityTrustService | null,
  ) {}

  async record(input: RecordVerificationOutcomeInput): Promise<void> {
    const findings = (input.audit.findings ?? []).map((f) => ({
      dimension: f.dimension,
      severity: f.severity,
      message: f.explanation?.slice(0, 500),
      citationId: f.authorityId,
      checkId: f.checkId,
    }));

    const strippedCitations = (input.audit.strippedCitations ?? []).map((s) => ({
      original: s.original,
      reason: s.reason,
    }));

    const claimFailures = (input.audit.propositions ?? [])
      .filter((p) =>
        p.supportState === 'UNSUPPORTED' ||
        p.supportState === 'CONTRADICTED' ||
        p.supportState === 'PARTIAL',
      )
      .map((p) => ({
        claim: (p.text ?? '').slice(0, 300),
        status: p.supportState,
        type: p.type,
      }));

    try {
      await (this.prisma as any).draftVerificationOutcome.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          documentKind: input.documentKind,
          jurisdiction: input.jurisdiction ?? null,
          courtDraftRecordId: input.courtDraftRecordId ?? null,
          draftJobId: input.draftJobId ?? null,
          verificationStatus: input.audit.verificationStatus,
          findings,
          strippedCitations,
          claimFailures,
          repairAttempted: input.repairAttempted ?? false,
          repairSucceeded: input.repairSucceeded ?? false,
          regenAttempts: input.regenAttempts ?? 0,
          modelUsed: input.modelUsed ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to persist verification outcome: ${String(err)}`);
      return;
    }

    const countryCode = normalizeCountry(input.countryCode ?? input.jurisdiction) || 'IN';

    // Update authority trust for stripped citations (negative signal)
    if (this.authorityTrust && strippedCitations.length > 0) {
      for (const stripped of strippedCitations) {
        await this.authorityTrust
          .recordStrip(stripped.original, countryCode)
          .catch(() => {});
      }
    }

    // Positive signal for verified similar-case authorities
    if (this.authorityTrust && input.audit.verificationStatus === 'verified') {
      for (const sc of input.audit.similarCases ?? []) {
        if (sc.authorityId) {
          await this.authorityTrust
            .recordVerified(sc.authorityId, countryCode)
            .catch(() => {});
        }
      }
    }
  }

  /**
   * Load planning constraints from recent claim-level failures for this document kind.
   * Injected into DraftPropositionPlanService so recurring gaps are addressed early.
   */
  async loadPlanningConstraints(
    tenantId: string,
    documentKind: string,
    limit = 5,
    countryCode?: string,
  ): Promise<string[]> {
    const country = normalizeCountry(countryCode);
    const rows = await (this.prisma as any).draftVerificationOutcome.findMany({
      where: {
        tenantId,
        documentKind,
        ...(country ? { jurisdiction: { startsWith: country } } : {}),
      },
      select: { claimFailures: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }).catch(() => []);

    const typeCounts = new Map<string, number>();
    for (const row of rows) {
      const failures = Array.isArray(row.claimFailures) ? row.claimFailures : [];
      for (const f of failures) {
        const type = typeof f === 'object' && f?.type ? String(f.type) : null;
        if (!type) continue;
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      }
    }

    return [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(
        ([type, count]) =>
          `Prior drafts of this kind frequently failed ${type} claim support (${count}x) — ensure every ${type} proposition cites locked evidence passages.`,
      );
  }
}
