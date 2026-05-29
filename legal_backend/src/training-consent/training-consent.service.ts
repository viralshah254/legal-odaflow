import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DEFAULT_TRAINING_CONSENT_STATUS } from './training-consent.constants';
import {
  CreateTrainingConsentDto,
  UpdateTrainingConsentDto,
} from './dto/training-consent.dto';

@Injectable()
export class TrainingConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: {
    userId?: string;
    tenantId?: string;
    consentStatus?: string;
  }) {
    return this.prisma.trainingConsent.findMany({
      where: {
        userId: filters?.userId,
        tenantId: filters?.tenantId,
        consentStatus: filters?.consentStatus,
      },
      include: { auditLogs: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const consent = await this.prisma.trainingConsent.findUnique({
      where: { id },
      include: { auditLogs: { orderBy: { createdAt: 'desc' } } },
    });

    if (!consent) {
      throw new NotFoundException('Training consent record not found');
    }

    return consent;
  }

  async create(dto: CreateTrainingConsentDto, actorUserId?: string) {
    const consentStatus = dto.consentStatus ?? 'DENIED';
    const isGranted = consentStatus === 'GRANTED';

    const consent = await this.prisma.trainingConsent.create({
      data: {
        userId: dto.userId,
        tenantId: dto.tenantId,
        scope: dto.scope,
        consentStatus,
        consentTextVersion: dto.consentTextVersion ?? '1.0',
        jurisdictionCountryCode: dto.jurisdictionCountryCode.toUpperCase(),
        canUseForPromptImprove: isGranted ? (dto.canUseForPromptImprove ?? false) : false,
        canUseForEvaluation: isGranted ? (dto.canUseForEvaluation ?? false) : false,
        canUseForFineTuning: isGranted ? (dto.canUseForFineTuning ?? false) : false,
        requiresAnonymization: dto.requiresAnonymization ?? true,
        grantedAt: isGranted ? new Date() : null,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
      include: { auditLogs: true },
    });

    if (isGranted) {
      await this.appendAuditLog(consent.id, 'GRANTED', actorUserId ?? dto.userId, {
        scope: dto.scope,
      });
    }

    return this.findOne(consent.id);
  }

  async update(id: string, dto: UpdateTrainingConsentDto, actorUserId?: string) {
    const existing = await this.findOne(id);
    const nextStatus = dto.consentStatus ?? existing.consentStatus;
    const wasGranted = existing.consentStatus === 'GRANTED';
    const willGrant = nextStatus === 'GRANTED' && !wasGranted;

    const consent = await this.prisma.trainingConsent.update({
      where: { id },
      data: {
        consentStatus: nextStatus,
        canUseForPromptImprove: dto.canUseForPromptImprove,
        canUseForEvaluation: dto.canUseForEvaluation,
        canUseForFineTuning: dto.canUseForFineTuning,
        requiresAnonymization: dto.requiresAnonymization,
        grantedAt: willGrant ? new Date() : existing.grantedAt,
      },
    });

    if (willGrant) {
      await this.appendAuditLog(id, 'GRANTED', actorUserId ?? existing.userId ?? undefined, {
        previousStatus: existing.consentStatus,
      });
    }

    return this.findOne(consent.id);
  }

  async withdraw(id: string, actorUserId?: string) {
    const existing = await this.findOne(id);

    if (existing.consentStatus === 'WITHDRAWN') {
      throw new BadRequestException('Consent has already been withdrawn');
    }

    await this.prisma.trainingConsent.update({
      where: { id },
      data: {
        consentStatus: 'WITHDRAWN',
        withdrawnAt: new Date(),
        canUseForPromptImprove: false,
        canUseForEvaluation: false,
        canUseForFineTuning: false,
      },
    });

    await this.appendAuditLog(id, 'WITHDRAWN', actorUserId ?? existing.userId ?? undefined, {
      previousStatus: existing.consentStatus,
    });

    await this.prisma.trainingDatasetItem.updateMany({
      where: { consentId: id, revoked: false },
      data: { revoked: true },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.trainingConsent.delete({ where: { id } });
    return { deleted: true };
  }

  async getOrCreateForUser(userId: string, tenantId?: string | null) {
    const scope = tenantId ? 'TENANT_DOCUMENTS' : 'USER_DOCUMENTS';
    const existing = await this.prisma.trainingConsent.findFirst({
      where: {
        userId,
        tenantId: tenantId ?? null,
        scope,
        consentStatus: { not: 'WITHDRAWN' },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      return this.findOne(existing.id);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.create(
      {
        userId,
        tenantId: tenantId ?? undefined,
        scope,
        consentStatus: DEFAULT_TRAINING_CONSENT_STATUS,
        jurisdictionCountryCode: user?.countryCode ?? 'IN',
      },
      userId,
    );
  }

  async getOrCreateConsent(params: {
    userId?: string;
    tenantId?: string;
    scope: string;
    jurisdictionCountryCode: string;
  }) {
    const existing = await this.prisma.trainingConsent.findFirst({
      where: {
        userId: params.userId,
        tenantId: params.tenantId,
        scope: params.scope,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.trainingConsent.create({
      data: {
        userId: params.userId,
        tenantId: params.tenantId,
        scope: params.scope,
        consentStatus: DEFAULT_TRAINING_CONSENT_STATUS,
        jurisdictionCountryCode: params.jurisdictionCountryCode.toUpperCase(),
      },
    });
  }

  async updateConsentStatus(
    consentId: string,
    consentStatus: 'GRANTED' | 'DENIED' | 'WITHDRAWN',
    actorUserId?: string,
  ) {
    const consent = await this.prisma.trainingConsent.update({
      where: { id: consentId },
      data: {
        consentStatus,
        grantedAt: consentStatus === 'GRANTED' ? new Date() : undefined,
        withdrawnAt: consentStatus === 'WITHDRAWN' ? new Date() : undefined,
      },
    });

    await this.appendAuditLog(consentId, `STATUS_${consentStatus}`, actorUserId);

    return consent;
  }

  async updateCurrentForUser(
    userId: string,
    tenantId: string | null | undefined,
    dto: UpdateTrainingConsentDto,
  ) {
    const current = await this.getOrCreateForUser(userId, tenantId);
    return this.update(current.id, dto, userId);
  }

  private async appendAuditLog(
    consentId: string,
    action: string,
    actorUserId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.trainingConsentAuditLog.create({
      data: {
        consentId,
        action,
        actorUserId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
