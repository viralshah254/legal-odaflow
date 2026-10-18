import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  KENYA_JURISDICTION,
  KENYA_SOURCE_POLICIES,
  type KenyaSourcePolicyDefinition,
} from './kenya-corpus.types';

const KENYA_LAW_POLICY = 'KENYA_LAW';

export class KenyaSourceDisabledError extends Error {
  constructor(
    readonly sourceKey: string,
    readonly reason:
      | 'NOT_CONFIGURED'
      | 'DISABLED'
      | 'NOT_PRODUCTION_APPROVED'
      | 'EMERGENCY_DISABLED',
  ) {
    super(`Kenya source ${sourceKey} is unavailable: ${reason}`);
    this.name = KenyaSourceDisabledError.name;
  }
}

@Injectable()
export class KenyaSourcePolicyService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  async seedDefaults(): Promise<void> {
    for (const definition of KENYA_SOURCE_POLICIES) {
      await this.upsertDefault(definition);
    }
  }

  async assertFetchAllowed(
    sourceKey: string,
    options: { production?: boolean } = {},
  ) {
    const policy = await this.prisma.legalCorpusSourcePolicy.findUnique({
      where: { sourceKey },
    });
    if (!policy) {
      throw new KenyaSourceDisabledError(sourceKey, 'NOT_CONFIGURED');
    }
    if (policy.emergencyDisabledAt) {
      throw new KenyaSourceDisabledError(sourceKey, 'EMERGENCY_DISABLED');
    }
    if (!policy.enabled) {
      throw new KenyaSourceDisabledError(sourceKey, 'DISABLED');
    }
    if (options.production && !policy.productionApproved) {
      throw new KenyaSourceDisabledError(sourceKey, 'NOT_PRODUCTION_APPROVED');
    }
    return policy;
  }

  async emergencyDisable(sourceKey: string): Promise<void> {
    await this.prisma.legalCorpusSourcePolicy.update({
      where: { sourceKey },
      data: { enabled: false, emergencyDisabledAt: new Date() },
    });
  }

  async listPolicies() {
    await this.seedDefaults();
    return this.prisma.legalCorpusSourcePolicy.findMany({
      where: { jurisdiction: KENYA_JURISDICTION },
      orderBy: { sourceKey: 'asc' },
    });
  }

  async setEnabled(
    sourceKey: string,
    enabled: boolean,
    opts: { clearEmergency?: boolean; productionApproved?: boolean } = {},
  ): Promise<void> {
    await this.seedDefaults();
    const data: Prisma.LegalCorpusSourcePolicyUpdateInput = {
      enabled,
      lastReviewedAt: new Date(),
    };
    if (opts.clearEmergency) {
      data.emergencyDisabledAt = null;
    }
    if (opts.productionApproved !== undefined) {
      data.productionApproved = opts.productionApproved;
    }
    await this.prisma.legalCorpusSourcePolicy.update({
      where: { sourceKey },
      data,
    });
  }

  async getManifestIngestCursor(): Promise<number> {
    const policy = await this.prisma.legalCorpusSourcePolicy.findUnique({
      where: { sourceKey: KENYA_LAW_POLICY },
      select: { metadata: true },
    });
    return readCursorFromMetadata(policy?.metadata);
  }

  async setManifestIngestCursor(cursor: number): Promise<void> {
    await this.seedDefaults();
    const policy = await this.prisma.legalCorpusSourcePolicy.findUnique({
      where: { sourceKey: KENYA_LAW_POLICY },
      select: { metadata: true },
    });
    const metadata = mergeMetadata(policy?.metadata, {
      manifestIngestCursor: Math.max(0, cursor),
      manifestIngestUpdatedAt: new Date().toISOString(),
    });
    await this.prisma.legalCorpusSourcePolicy.update({
      where: { sourceKey: KENYA_LAW_POLICY },
      data: { metadata },
    });
  }

  async recordFetch(input: {
    sourcePolicyId: string;
    url: string;
    startedAt: Date;
    completedAt?: Date;
    responseStatus?: number;
    responseHash?: string;
    bytesReceived?: number;
    attempt?: number;
    outcome: 'SUCCESS' | 'RETRY' | 'REJECTED' | 'FAILED';
    errorCode?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.legalCorpusFetchAudit.create({
      data: {
        sourcePolicyId: input.sourcePolicyId,
        url: input.url,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        responseStatus: input.responseStatus,
        responseHash: input.responseHash,
        bytesReceived: input.bytesReceived,
        attempt: input.attempt ?? 1,
        outcome: input.outcome,
        errorCode: input.errorCode,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async upsertDefault(definition: KenyaSourcePolicyDefinition): Promise<void> {
    await this.prisma.legalCorpusSourcePolicy.upsert({
      where: { sourceKey: definition.sourceKey },
      create: {
        sourceKey: definition.sourceKey,
        displayName: definition.displayName,
        baseUrl: definition.baseUrl,
        jurisdiction: KENYA_JURISDICTION,
        accessMethod: definition.accessMethod,
        enabled: definition.enabledByDefault,
        productionApproved: definition.productionApprovedByDefault,
        maxConcurrency: definition.maxConcurrency,
        requestsPerMinute: definition.requestsPerMinute,
        retryBudget: definition.retryBudget,
        attributionText: definition.attributionText,
        metadata: { authorityLevel: definition.authorityLevel },
      },
      update: {
        displayName: definition.displayName,
        baseUrl: definition.baseUrl,
        accessMethod: definition.accessMethod,
        maxConcurrency: definition.maxConcurrency,
        requestsPerMinute: definition.requestsPerMinute,
        retryBudget: definition.retryBudget,
        attributionText: definition.attributionText,
        metadata: { authorityLevel: definition.authorityLevel },
      },
    });
  }
}

function readCursorFromMetadata(metadata: Prisma.JsonValue | null | undefined): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 0;
  }
  const value = (metadata as Record<string, unknown>).manifestIngestCursor;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function mergeMetadata(
  existing: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}
