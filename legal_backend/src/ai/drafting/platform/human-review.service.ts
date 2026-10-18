import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { HumanReviewRecord, ReleaseGateResult } from '../contracts/release-gate';

interface ApprovalIdentity {
  tenantId: string;
  draftId: string;
  caseRecordId: string;
  caseRecordVersion: number;
  playbookVersion: string;
  draftHash: string;
  evidenceRevision: string;
  courtProfileId: string;
  contentRevision: number;
  releaseDigest: string;
}

/**
 * Durable human-review enforcement for filing-grade kinds.
 * Approval is tenant-scoped and invalidated by any case-record, playbook, or draft change.
 */
@Injectable()
export class HumanReviewService {
  constructor(private readonly prisma: PrismaService) {}

  static draftHash(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  async recordApproval(
    input: ApprovalIdentity & { userId: string; notes?: string },
  ): Promise<HumanReviewRecord> {
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.draftHumanReview.updateMany({
        where: {
          tenantId: input.tenantId,
          draftId: input.draftId,
          approved: true,
          invalidated: false,
        },
        data: {
          approved: false,
          invalidated: true,
          invalidatedReason: 'Superseded by a newer advocate review',
          invalidatedAt: new Date(),
        },
      });
      return tx.draftHumanReview.create({
        data: {
          tenantId: input.tenantId,
          draftId: input.draftId,
          caseRecordId: input.caseRecordId,
          caseRecordVersion: input.caseRecordVersion,
          playbookVersion: input.playbookVersion,
          draftHash: input.draftHash,
          evidenceRevision: input.evidenceRevision,
          courtProfileId: input.courtProfileId,
          contentRevision: input.contentRevision,
          releaseDigest: input.releaseDigest,
          approved: true,
          reviewedByUserId: input.userId,
          notes: input.notes,
        },
      });
    });
    return this.toRecord(record);
  }

  async get(tenantId: string, draftId: string): Promise<HumanReviewRecord | undefined> {
    const record = await this.prisma.draftHumanReview.findFirst({
      where: { tenantId, draftId },
      orderBy: { reviewedAt: 'desc' },
    });
    return record ? this.toRecord(record) : undefined;
  }

  async isApprovalValid(
    input: ApprovalIdentity,
  ): Promise<{ valid: boolean; reason?: string; record?: HumanReviewRecord }> {
    const record = await this.get(input.tenantId, input.draftId);
    if (!record || !record.approved || record.invalidated) {
      return { valid: false, reason: 'No active advocate approval', record };
    }

    const mismatch =
      record.caseRecordId !== input.caseRecordId
        ? 'Case Record id changed'
        : record.caseRecordVersion !== input.caseRecordVersion
          ? 'Case Record version changed'
          : record.playbookVersion !== input.playbookVersion
            ? 'Playbook version changed'
            : record.draftHash !== input.draftHash
              ? 'Draft content changed'
              : (record as { contentRevision?: number }).contentRevision !== undefined &&
                  (record as { contentRevision?: number }).contentRevision !== input.contentRevision
                ? 'Draft revision changed'
                : (record as { evidenceRevision?: string }).evidenceRevision &&
                    (record as { evidenceRevision?: string }).evidenceRevision !== input.evidenceRevision
                  ? 'Evidence pack changed'
                  : (record as { courtProfileId?: string }).courtProfileId &&
                      (record as { courtProfileId?: string }).courtProfileId !== input.courtProfileId
                    ? 'Court profile changed'
                    : (record as { releaseDigest?: string }).releaseDigest &&
                        (record as { releaseDigest?: string }).releaseDigest !== input.releaseDigest
                      ? 'Release identity changed'
                      : undefined;

    if (mismatch) {
      await this.invalidate(input.tenantId, input.draftId, mismatch);
      return { valid: false, reason: mismatch, record: { ...record, approved: false, invalidated: true } };
    }
    return { valid: true, record };
  }

  async invalidate(tenantId: string, draftId: string, reason: string): Promise<void> {
    await this.prisma.draftHumanReview.updateMany({
      where: { tenantId, draftId, approved: true, invalidated: false },
      data: {
        approved: false,
        invalidated: true,
        invalidatedReason: reason,
        invalidatedAt: new Date(),
      },
    });
  }

  canExportWithHumanReview(
    release: ReleaseGateResult,
    filingGrade: boolean,
    approval: { valid: boolean },
  ): boolean {
    if (!release.canExport) return false;
    if (!filingGrade && !release.requiresHumanReview) return true;
    return approval.valid;
  }

  private toRecord(record: {
    id: string;
    draftId: string;
    caseRecordId: string;
    caseRecordVersion: number;
    playbookVersion: string;
    draftHash: string;
    approved: boolean;
    reviewedByUserId: string;
    reviewedAt: Date;
    notes: string | null;
    invalidated: boolean;
    invalidatedReason: string | null;
    // Extended dependency-identity fields (C07 fix: include so isApprovalValid
    // can compare them; previously they were silently dropped by toRecord()).
    contentRevision?: number | null;
    evidenceRevision?: string | null;
    courtProfileId?: string | null;
    releaseDigest?: string | null;
  }): HumanReviewRecord {
    return {
      id: record.id,
      draftId: record.draftId,
      caseRecordId: record.caseRecordId,
      caseRecordVersion: record.caseRecordVersion,
      playbookVersion: record.playbookVersion,
      draftHash: record.draftHash,
      approved: record.approved,
      reviewedByUserId: record.reviewedByUserId,
      reviewedAt: record.reviewedAt.toISOString(),
      notes: record.notes ?? undefined,
      invalidated: record.invalidated,
      invalidatedReason: record.invalidatedReason ?? undefined,
      // Pass through dependency identity so isApprovalValid() can compare them
      contentRevision: record.contentRevision ?? undefined,
      evidenceRevision: record.evidenceRevision ?? undefined,
      courtProfileId: record.courtProfileId ?? undefined,
      releaseDigest: record.releaseDigest ?? undefined,
    } as HumanReviewRecord;
  }
}
