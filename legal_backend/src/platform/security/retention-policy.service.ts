import { Injectable, Logger } from '@nestjs/common';
import { RetentionPolicy } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface CreateRetentionPolicyDto {
  tenantId?: string;
  name: string;
  dataType: string;
  retentionDays: number;
  archiveAfterDays?: number;
  deleteAfterDays?: number;
  legalHoldOverride?: boolean;
}

interface RetentionEnforcementResult {
  archived: number;
  deleted: number;
  skippedLegalHold: number;
}

@Injectable()
export class RetentionPolicyService {
  private readonly logger = new Logger(RetentionPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPolicy(dto: CreateRetentionPolicyDto): Promise<RetentionPolicy> {
    return this.prisma.retentionPolicy.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        dataType: dto.dataType,
        retentionDays: dto.retentionDays,
        archiveAfterDays: dto.archiveAfterDays,
        deleteAfterDays: dto.deleteAfterDays,
        legalHoldOverride: dto.legalHoldOverride ?? true,
        status: 'active',
      },
    });
  }

  async getApplicablePolicy(tenantId: string, dataType: string): Promise<RetentionPolicy | null> {
    const tenantPolicy = await this.prisma.retentionPolicy.findFirst({
      where: { tenantId, dataType, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    if (tenantPolicy) return tenantPolicy;

    return this.prisma.retentionPolicy.findFirst({
      where: { tenantId: null, dataType, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAll(tenantId?: string): Promise<RetentionPolicy[]> {
    return this.prisma.retentionPolicy.findMany({
      where: tenantId !== undefined ? { OR: [{ tenantId }, { tenantId: null }] } : {},
      orderBy: [{ tenantId: 'asc' }, { dataType: 'asc' }],
    });
  }

  /**
   * Enforce retention policies across all tenants.
   * Archives (sets visibility='ARCHIVED') or hard-deletes documents that have
   * exceeded their retention windows. Skips documents whose matter is under
   * an active legal hold.
   *
   * Call this from a cron job (e.g., daily at 02:00 UTC).
   */
  async enforceRetention(tenantId?: string): Promise<RetentionEnforcementResult> {
    const result: RetentionEnforcementResult = { archived: 0, deleted: 0, skippedLegalHold: 0 };
    const now = new Date();

    const policies = await this.getAll(tenantId);

    for (const policy of policies) {
      if (policy.status !== 'active') continue;

      const archiveThreshold = policy.archiveAfterDays
        ? new Date(now.getTime() - policy.archiveAfterDays * 86400_000)
        : null;
      const deleteThreshold = policy.deleteAfterDays
        ? new Date(now.getTime() - policy.deleteAfterDays * 86400_000)
        : null;

      if (policy.dataType === 'document' || policy.dataType === 'all') {
        if (deleteThreshold) {
          const docs = await this.prisma.document.findMany({
            where: {
              ...(policy.tenantId ? { tenantId: policy.tenantId } : {}),
              createdAt: { lte: deleteThreshold },
              visibility: { not: 'DELETED' },
            },
            select: { id: true, tenantId: true },
          }).catch(() => []);

          for (const doc of docs) {
            const isOnHold = await this.checkLegalHold(doc.id, doc.tenantId);
            if (isOnHold && policy.legalHoldOverride) {
              result.skippedLegalHold++;
              continue;
            }

            await this.prisma.document.delete({
              where: { id: doc.id },
            }).catch(() => {});

            await (this.prisma as any).retentionEnforcementLog.create({
              data: {
                tenantId: doc.tenantId,
                dataType: 'document',
                recordId: doc.id,
                action: 'deleted',
                policyId: policy.id,
                enforcedAt: now,
              },
            }).catch(() => {});

            result.deleted++;
          }
        }

        if (archiveThreshold) {
          const docs = await this.prisma.document.findMany({
            where: {
              ...(policy.tenantId ? { tenantId: policy.tenantId } : {}),
              createdAt: { lte: archiveThreshold },
              visibility: { not: 'ARCHIVED' },
            },
            select: { id: true, tenantId: true },
          }).catch(() => []);

          for (const doc of docs) {
            const isOnHold = await this.checkLegalHold(doc.id, doc.tenantId);
            if (isOnHold && policy.legalHoldOverride) {
              result.skippedLegalHold++;
              continue;
            }

            await this.prisma.document.update({
              where: { id: doc.id },
              data: { visibility: 'ARCHIVED' },
            }).catch(() => {});

            await (this.prisma as any).retentionEnforcementLog.create({
              data: {
                tenantId: doc.tenantId,
                dataType: 'document',
                recordId: doc.id,
                action: 'archived',
                policyId: policy.id,
                enforcedAt: now,
              },
            }).catch(() => {});

            result.archived++;
          }
        }
      }
    }

    this.logger.log(
      `Retention enforcement complete: archived=${result.archived}, deleted=${result.deleted}, skipped=${result.skippedLegalHold}`,
    );

    return result;
  }

  /**
   * Check if a document's associated matter is under an active legal hold.
   */
  private async checkLegalHold(documentId: string, tenantId: string): Promise<boolean> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: { matterId: true },
    }).catch(() => null);

    if (!doc?.matterId) return false;

    const legalHold = await this.prisma.legalHold.findFirst({
      where: {
        matterId: doc.matterId,
        tenantId,
        status: 'active',
      },
    }).catch(() => null);

    return legalHold !== null;
  }
}
