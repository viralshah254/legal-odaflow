import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ManualCitationReviewDecision,
  ManualCitationReviewStatus,
  Prisma,
} from '@prisma/client';
import { MatterAccessService } from '@/access/matter-access.service';
import {
  FeatureFlagsService,
  RESEARCH_FEATURE_FLAGS,
} from '@/platform/feature-flags/feature-flags.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ManualCitationReviewDecisionDto,
} from '../dto/manual-citation-review.dto';

const REVIEWER_ROLES = new Set([
  'FIRM_ADMIN',
  'PARTNER',
  'PARTNER_ADMIN',
  'ASSOCIATE',
]);

type AuditObject = Record<string, unknown>;

type ScopedOutput = {
  id: string;
  tenantId: string | null;
  matterId: string | null;
  citationAudit: Prisma.JsonValue | null;
};

@Injectable()
export class ManualCitationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async listAndMaterialize(params: {
    outputId: string;
    tenantId: string;
    userId: string;
    userType: string;
    tenantRole?: string;
  }) {
    this.featureFlags.assertEnabled(
      RESEARCH_FEATURE_FLAGS.MANUAL_CITATION_REVIEW,
      { tenantId: params.tenantId, userId: params.userId },
    );
    this.ensureLawyerRole(params.userType, params.tenantRole);
    const output = await this.getScopedOutput(
      params.outputId,
      params.tenantId,
      params.userId,
      params.tenantRole,
    );

    const unresolved = this.unresolvedEntries(output.citationAudit);
    if (unresolved.length > 0) {
      await this.prisma.manualCitationReviewTask.createMany({
        data: unresolved.map((entry) => ({
          tenantId: params.tenantId,
          aiOutputId: output.id,
          matterId: output.matterId,
          citationKey: entry.citationKey,
          citation: entry.citation,
          claim: entry.claim,
          auditEntry: entry.auditEntry as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
    }

    return this.getReviewState(params.tenantId, output.id);
  }

  async decide(params: {
    outputId: string;
    taskId: string;
    tenantId: string;
    userId: string;
    userType: string;
    tenantRole?: string;
    dto: ManualCitationReviewDecisionDto;
  }) {
    this.featureFlags.assertEnabled(
      RESEARCH_FEATURE_FLAGS.MANUAL_CITATION_REVIEW,
      { tenantId: params.tenantId, userId: params.userId },
    );
    this.ensureLawyerRole(params.userType, params.tenantRole);
    const output = await this.getScopedOutput(
      params.outputId,
      params.tenantId,
      params.userId,
      params.tenantRole,
    );
    const evidence = this.validateDecisionEvidence(params.dto);
    const status = this.statusFor(params.dto.decision);

    await this.prisma.$transaction(async (tx) => {
      const task = await tx.manualCitationReviewTask.findFirst({
        where: {
          id: params.taskId,
          tenantId: params.tenantId,
          aiOutputId: output.id,
        },
      });
      if (!task) {
        throw new NotFoundException({
          code: 'CITATION_REVIEW_TASK_NOT_FOUND',
          message: 'Citation review task not found',
        });
      }
      if (
        evidence &&
        this.isIdentityOnlyPassage(
          evidence.exactPassage,
          task.citation,
          task.auditEntry,
        )
      ) {
        throw new BadRequestException(
          'Identity-only source data cannot support approval or replacement',
        );
      }

      const claimed = await tx.manualCitationReviewTask.updateMany({
        where: {
          id: task.id,
          tenantId: params.tenantId,
          aiOutputId: output.id,
          version: params.dto.expectedVersion,
          status: {
            in: [
              ManualCitationReviewStatus.PENDING,
              ManualCitationReviewStatus.IN_REVIEW,
            ],
          },
        },
        data: {
          status,
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          code: 'CITATION_REVIEW_VERSION_CONFLICT',
          message: 'Citation review task changed; reload and retry',
        });
      }

      const review = await tx.manualCitationReview.create({
        data: {
          taskId: task.id,
          tenantId: params.tenantId,
          aiOutputId: output.id,
          reviewerId: params.userId,
          decision: params.dto.decision as ManualCitationReviewDecision,
          reviewerNote: params.dto.reviewerNote.trim(),
          sourceUrl: evidence?.sourceUrl,
          sourceDocumentReference: evidence?.sourceDocumentReference,
          sourceHash: evidence?.sourceHash,
          exactPassage: evidence?.exactPassage,
          pinpoint: evidence?.pinpoint,
          evidenceKind: evidence?.evidenceKind,
          replacementCitation:
            params.dto.decision === 'REPLACE'
              ? params.dto.replacementCitation!.trim()
              : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          action: `manual_citation_review.${params.dto.decision.toLowerCase()}`,
          entityType: 'ManualCitationReviewTask',
          entityId: task.id,
          metadata: {
            aiOutputId: output.id,
            matterId: output.matterId,
            reviewId: review.id,
            decision: params.dto.decision,
            expectedVersion: params.dto.expectedVersion,
            resultingVersion: params.dto.expectedVersion + 1,
            sourceHash: evidence?.sourceHash,
            sourceUrl: evidence?.sourceUrl,
            sourceDocumentReference: evidence?.sourceDocumentReference,
            pinpoint: evidence?.pinpoint,
            replacementCitation: params.dto.replacementCitation,
          },
        },
      });
    });

    return this.getReviewState(params.tenantId, output.id);
  }

  private async getScopedOutput(
    outputId: string,
    tenantId: string,
    userId: string,
    tenantRole?: string,
  ): Promise<ScopedOutput> {
    const output = await this.prisma.aIOutput.findFirst({
      where: { id: outputId, tenantId },
      select: {
        id: true,
        tenantId: true,
        matterId: true,
        citationAudit: true,
      },
    });
    if (!output) {
      throw new NotFoundException({
        code: 'RESEARCH_OUTPUT_NOT_FOUND',
        message: 'Research output not found',
      });
    }
    if (output.matterId) {
      try {
        await this.matterAccess.ensureMatterAccess(
          tenantId,
          userId,
          output.matterId,
          tenantRole,
        );
      } catch {
        throw new ForbiddenException({
          code: 'CITATION_REVIEW_MATTER_ACCESS_DENIED',
          message: 'Matter access denied',
        });
      }
    }
    return output;
  }

  private async getReviewState(tenantId: string, outputId: string) {
    const [tasks, reviews] = await Promise.all([
      this.prisma.manualCitationReviewTask.findMany({
        where: { tenantId, aiOutputId: outputId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.manualCitationReview.findMany({
        where: { tenantId, aiOutputId: outputId },
        orderBy: { reviewedAt: 'asc' },
      }),
    ]);

    const counts = {
      pending: 0,
      inReview: 0,
      approved: 0,
      rejected: 0,
      replaced: 0,
    };
    for (const task of tasks) {
      if (task.status === ManualCitationReviewStatus.PENDING) counts.pending++;
      if (task.status === ManualCitationReviewStatus.IN_REVIEW) counts.inReview++;
      if (task.status === ManualCitationReviewStatus.APPROVED) counts.approved++;
      if (task.status === ManualCitationReviewStatus.REJECTED) counts.rejected++;
      if (task.status === ManualCitationReviewStatus.REPLACED) counts.replaced++;
    }

    return {
      tasks: tasks.map((task) => ({
        ...task,
        status: this.apiStatus(task.status),
      })),
      reviews,
      summary: {
        total: tasks.length,
        ...counts,
        decided: counts.approved + counts.rejected + counts.replaced,
        complete:
          tasks.length > 0 &&
          counts.pending === 0 &&
          counts.inReview === 0,
        automatedCitationAuditUnchanged: true,
        safeForRelianceUnchanged: true,
      },
    };
  }

  private unresolvedEntries(citationAudit: Prisma.JsonValue | null) {
    if (!this.isObject(citationAudit)) return [];
    const candidates: Array<{ citation: string; claim?: string; auditEntry: AuditObject }> = [];
    const rejected = this.objectArray(citationAudit.rejectedCitations);
    const audited = this.objectArray(citationAudit.citations).filter(
      (entry) => entry.verified !== true,
    );
    for (const entry of [...rejected, ...audited]) {
      const citation = this.string(entry.citation);
      if (citation) candidates.push({ citation, auditEntry: entry });
    }

    for (const gap of this.objectArray(citationAudit.verificationGaps)) {
      const citation = this.string(gap.citation);
      if (citation) candidates.push({ citation, auditEntry: gap });
    }

    if (Array.isArray(citationAudit.unverifiedCitations)) {
      for (const value of citationAudit.unverifiedCitations) {
        const citation = this.string(value);
        if (citation) {
          candidates.push({
            citation,
            auditEntry: { citation, source: 'unverifiedCitations' },
          });
        }
      }
    }

    for (const claim of this.objectArray(citationAudit.unsupportedClaims)) {
      const citations = Array.isArray(claim.citations) ? claim.citations : [];
      for (const value of citations) {
        const citation = this.string(value);
        if (citation) {
          candidates.push({
            citation,
            claim: this.string(claim.claim),
            auditEntry: claim,
          });
        }
      }
    }

    const unique = new Map<
      string,
      { citationKey: string; citation: string; claim?: string; auditEntry: AuditObject }
    >();
    for (const candidate of candidates) {
      const authorityId = this.string(candidate.auditEntry.authorityId) ?? '';
      const identity = `${candidate.citation.toLowerCase().replace(/\s+/g, ' ').trim()}|${authorityId}`;
      const citationKey = createHash('sha256').update(identity).digest('hex');
      if (!unique.has(citationKey)) {
        unique.set(citationKey, { citationKey, ...candidate });
      }
    }
    return [...unique.values()];
  }

  private validateDecisionEvidence(dto: ManualCitationReviewDecisionDto) {
    const note = dto.reviewerNote?.trim();
    if (!note) {
      throw new BadRequestException('A reviewer note is required');
    }
    if (dto.decision === 'REJECT') return undefined;

    const sourceUrl = dto.sourceUrl?.trim();
    const sourceDocumentReference = dto.sourceDocumentReference?.trim();
    if (!sourceUrl && !sourceDocumentReference) {
      throw new BadRequestException(
        'Approval or replacement requires a source URL or document reference',
      );
    }
    if (dto.evidenceKind !== 'PASSAGE') {
      throw new BadRequestException(
        'Identity-only source data cannot support approval or replacement',
      );
    }
    const exactPassage = dto.exactPassage?.trim();
    const pinpoint = dto.pinpoint?.trim();
    const sourceHash = dto.sourceHash?.trim();
    if (!exactPassage || !pinpoint || !sourceHash) {
      throw new BadRequestException(
        'Approval or replacement requires an immutable source hash, exact passage, and pinpoint',
      );
    }
    if (!/^[a-f0-9]{64}$/i.test(sourceHash)) {
      throw new BadRequestException('sourceHash must be a SHA-256 digest');
    }
    if (
      dto.decision === 'REPLACE' &&
      !dto.replacementCitation?.trim()
    ) {
      throw new BadRequestException('Replacement requires a replacement citation');
    }

    return {
      sourceUrl,
      sourceDocumentReference,
      sourceHash: sourceHash.toLowerCase(),
      exactPassage,
      pinpoint,
      evidenceKind: dto.evidenceKind,
    } as const;
  }

  private ensureLawyerRole(userType: string, tenantRole?: string): void {
    if (userType !== 'LAWYER' || !tenantRole || !REVIEWER_ROLES.has(tenantRole)) {
      throw new ForbiddenException({
        code: 'CITATION_REVIEW_ROLE_REQUIRED',
        message: 'A lawyer role is required for manual citation review',
      });
    }
  }

  private isIdentityOnlyPassage(
    passage: string,
    citation: string,
    auditEntry: Prisma.JsonValue,
  ): boolean {
    const passageTokens = this.tokens(passage);
    if (passageTokens.length === 0) return true;

    const identityParts = [citation];
    if (this.isObject(auditEntry)) {
      for (const field of [
        'citation',
        'authorityId',
        'title',
        'caseName',
        'neutralCitation',
        'sourceName',
        'sourceUrl',
      ]) {
        const value = this.string(auditEntry[field]);
        if (value) identityParts.push(value);
      }
    }
    const identityTokens = new Set(this.tokens(identityParts.join(' ')));
    return passageTokens.every((token) => identityTokens.has(token));
  }

  private tokens(value: string): string[] {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  private statusFor(
    decision: ManualCitationReviewDecisionDto['decision'],
  ): ManualCitationReviewStatus {
    if (decision === 'APPROVE') return ManualCitationReviewStatus.APPROVED;
    if (decision === 'REPLACE') return ManualCitationReviewStatus.REPLACED;
    return ManualCitationReviewStatus.REJECTED;
  }

  private apiStatus(status: ManualCitationReviewStatus): string {
    if (status === ManualCitationReviewStatus.IN_REVIEW) return 'in-review';
    return status.toLowerCase();
  }

  private isObject(value: unknown): value is AuditObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private objectArray(value: unknown): AuditObject[] {
    return Array.isArray(value) ? value.filter((item) => this.isObject(item)) : [];
  }

  private string(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
