import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class DocumentTrainingPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAllowedForTraining(params: {
    documentId: string;
    userId: string;
    tenantId?: string;
  }): Promise<void> {
    const permission = await this.prisma.documentTrainingPermission.findFirst({
      where: {
        documentId: params.documentId,
        OR: [
          { userId: params.userId },
          params.tenantId ? { tenantId: params.tenantId } : {},
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!permission?.allowedForTraining) {
      throw new ForbiddenException(
        'Document training permission required before training pipeline use',
      );
    }
  }

  async ensureForDocumentUpload(params: {
    documentId: string;
    userId: string;
    tenantId?: string;
  }) {
    const consent = await this.prisma.trainingConsent.findFirst({
      where: {
        consentStatus: 'GRANTED',
        OR: [
          { userId: params.userId, tenantId: params.tenantId ?? null },
          params.tenantId
            ? { tenantId: params.tenantId, userId: null }
            : { userId: params.userId, tenantId: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const allowedForTraining = consent?.consentStatus === 'GRANTED';
    const existing = await this.prisma.documentTrainingPermission.findFirst({
      where: { documentId: params.documentId },
    });

    const data = {
      userId: params.userId,
      tenantId: params.tenantId,
      consentId: consent?.id,
      allowedForTraining,
      allowedForEvaluation: consent?.canUseForEvaluation ?? false,
      allowedForAnonymizedAnalytics: allowedForTraining,
      anonymizationStatus: allowedForTraining ? 'QUEUED' : 'NOT_STARTED',
    };

    if (existing) {
      return this.prisma.documentTrainingPermission.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.documentTrainingPermission.create({
      data: {
        documentId: params.documentId,
        ...data,
      },
    });
  }
}
