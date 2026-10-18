import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';
import { HumanReviewService } from './human-review.service';
import { computeReleaseDigest, isCompleteReleaseSnapshot } from './release-snapshot.util';
import type { DraftVerificationAudit } from '../draft-verification.types';

export interface ReleaseSnapshot {
  draftHash: string;
  contentRevision: number;
  caseRecordId: string;
  caseRecordVersion: number;
  playbookVersion: string;
  evidenceRevision: string;
  courtProfileId: string;
  releaseDigest: string;
}

const REVIEWER_ROLES = new Set(['PARTNER', 'PARTNER_ADMIN', 'FIRM_ADMIN', 'ADVOCATE', 'SENIOR_ADVOCATE']);

@Injectable()
export class DraftFilingReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly humanReview: HumanReviewService,
    private readonly access: ArtifactAccessResolver,
  ) {}

  assertReviewerRole(tenantRole?: string): void {
    if (!tenantRole || !REVIEWER_ROLES.has(tenantRole)) {
      throw new ForbiddenException('Advocate review privileges required');
    }
  }

  async loadDraftForActor(
    tenantId: string,
    actorId: string,
    draftId: string,
    tenantRole?: string,
  ) {
    const record = await this.prisma.courtDraftRecord.findFirst({
      where: { id: draftId, tenantId, status: 'active' },
    });
    if (!record) {
      throw new NotFoundException('Draft not found');
    }
    if (record.matterId) {
      await this.access.assertMatterReadable({ tenantId, userId: actorId, tenantRole }, record.matterId);
    } else if (record.userId !== actorId) {
      throw new ForbiddenException('Draft access denied');
    }
    return record;
  }

  async resolveAuthoritativeSnapshot(
    tenantId: string,
    actorId: string,
    draftId: string,
    tenantRole?: string,
  ): Promise<{ draftText: string; snapshot: ReleaseSnapshot; audit: DraftVerificationAudit | null }> {
    const record = await this.loadDraftForActor(tenantId, actorId, draftId, tenantRole);
    const audit = record.verificationAudit as DraftVerificationAudit | null;
    const draftHash = HumanReviewService.draftHash(record.draftText);

    const job = await this.prisma.draftJob.findFirst({
      where: { courtDraftRecordId: draftId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: { executionPlanJson: true, verificationReportJson: true },
    });

    const plan = job?.executionPlanJson as {
      confirmedCaseRecord?: {
        metadata?: { caseRecordId?: string; version?: number; playbookVersion?: string };
      };
    } | null;

    const caseRecordId =
      plan?.confirmedCaseRecord?.metadata?.caseRecordId ??
      (audit as { caseRecordId?: string } | null)?.caseRecordId ??
      '';
    const caseRecordVersion =
      plan?.confirmedCaseRecord?.metadata?.version ??
      (audit as { caseRecordVersion?: number } | null)?.caseRecordVersion ??
      0;
    const playbookVersion =
      plan?.confirmedCaseRecord?.metadata?.playbookVersion ??
      (audit as { playbookVersion?: string } | null)?.playbookVersion ??
      '';

    const filingReadiness = record.filingReadinessJson as { courtProfileId?: string } | null;
    const courtProfileId =
      filingReadiness?.courtProfileId ??
      `${record.countryCode}:${record.jurisdiction ?? 'default'}:${record.kind}`;

    const evidenceRevision =
      audit?.evidencePackId ??
      audit?.outputHash ??
      (job?.verificationReportJson
        ? createHash('sha256').update(JSON.stringify(job.verificationReportJson)).digest('hex').slice(0, 16)
        : '');

    const base: Omit<ReleaseSnapshot, 'releaseDigest'> = {
      draftHash,
      contentRevision: record.contentRevision,
      caseRecordId: caseRecordId || 'pending',
      caseRecordVersion,
      playbookVersion: playbookVersion || 'pending',
      evidenceRevision: evidenceRevision || 'pending',
      courtProfileId: courtProfileId || 'pending',
    };

    const releaseDigest = computeReleaseDigest({ ...base, releaseDigest: '' });
    const snapshot: ReleaseSnapshot = { ...base, releaseDigest };

    return { draftText: record.draftText, snapshot, audit };
  }

  async assertFilingExportAllowed(
    tenantId: string,
    actorId: string,
    draftId: string,
    tenantRole?: string,
  ): Promise<{ draftText: string; citationAppendix: unknown[] }> {
    this.assertReviewerRole(tenantRole);
    const { draftText, snapshot, audit } = await this.resolveAuthoritativeSnapshot(
      tenantId,
      actorId,
      draftId,
      tenantRole,
    );

    if (!isCompleteReleaseSnapshot(snapshot)) {
      throw new BadRequestException('Release identity incomplete; re-run verification before filing export');
    }

    const readiness = audit?.filingReadiness;
    if (!readiness?.canExportForFiling) {
      throw new BadRequestException('Draft is not ready for filing export');
    }

    const approval = await this.humanReview.isApprovalValid({
      tenantId,
      draftId,
      caseRecordId: snapshot.caseRecordId,
      caseRecordVersion: snapshot.caseRecordVersion,
      playbookVersion: snapshot.playbookVersion,
      draftHash: snapshot.draftHash,
      evidenceRevision: snapshot.evidenceRevision,
      courtProfileId: snapshot.courtProfileId,
      contentRevision: snapshot.contentRevision,
      releaseDigest: snapshot.releaseDigest,
    });
    if (!approval.valid) {
      throw new BadRequestException(approval.reason ?? 'Advocate approval is stale or missing');
    }

    const record = await this.prisma.courtDraftRecord.findFirst({
      where: { id: draftId, tenantId },
      select: { citationAppendixJson: true },
    });

    return {
      draftText,
      citationAppendix: (record?.citationAppendixJson as unknown[]) ?? [],
    };
  }

  async recordApprovalFromServer(input: {
    tenantId: string;
    userId: string;
    draftId: string;
    tenantRole?: string;
    notes?: string;
    expectedContentRevision?: number;
  }): Promise<ReleaseSnapshot> {
    this.assertReviewerRole(input.tenantRole);
    const { snapshot } = await this.resolveAuthoritativeSnapshot(
      input.tenantId,
      input.userId,
      input.draftId,
      input.tenantRole,
    );

    if (!isCompleteReleaseSnapshot(snapshot)) {
      throw new BadRequestException('Cannot approve: release identity is incomplete');
    }

    if (
      input.expectedContentRevision !== undefined &&
      input.expectedContentRevision !== snapshot.contentRevision
    ) {
      throw new BadRequestException('Draft revision conflict; refresh and re-run readiness');
    }

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.courtDraftRecord.findFirst({
        where: { id: input.draftId, tenantId: input.tenantId },
        select: { contentRevision: true },
      });
      if (!current) throw new NotFoundException('Draft not found');
      if (
        input.expectedContentRevision !== undefined &&
        current.contentRevision !== input.expectedContentRevision
      ) {
        throw new BadRequestException('Draft revision conflict');
      }
      await tx.courtDraftRecord.update({
        where: { id: input.draftId },
        data: { releaseSnapshotJson: snapshot as object },
      });
    });

    await this.humanReview.recordApproval({
      tenantId: input.tenantId,
      draftId: input.draftId,
      userId: input.userId,
      notes: input.notes,
      caseRecordId: snapshot.caseRecordId,
      caseRecordVersion: snapshot.caseRecordVersion,
      playbookVersion: snapshot.playbookVersion,
      draftHash: snapshot.draftHash,
      evidenceRevision: snapshot.evidenceRevision,
      courtProfileId: snapshot.courtProfileId,
      contentRevision: snapshot.contentRevision,
      releaseDigest: snapshot.releaseDigest,
    });

    return snapshot;
  }
}
