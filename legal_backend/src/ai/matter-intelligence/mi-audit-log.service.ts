import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterMemoryService } from './matter-memory.service';
import type { MatterProfile } from './matter-intelligence.types';

export interface MiAuditEntry {
  consumer: string;
  profile: MatterProfile;
  confidence: number;
  inputsHash: string;
  tenantId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
}

/** SOC2 CC7 evidence — MI decision audit log (P15-04 scaffold). */
@Injectable()
export class MiAuditLogService {
  private readonly logger = new Logger(MiAuditLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matterMemory: MatterMemoryService,
  ) {}

  async record(entry: MiAuditEntry): Promise<void> {
    const metadata = {
      consumer: entry.consumer,
      confidence: entry.confidence,
      inputsHash: entry.inputsHash,
      practiceArea: entry.profile.practiceArea,
      subPracticeArea: entry.profile.subPracticeArea,
      nature: entry.profile.nature,
      profile: entry.profile as unknown as Prisma.InputJsonValue,
    } satisfies Prisma.InputJsonObject;

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: 'matter_intelligence.classify',
          entityType: entry.entityType ?? 'matter_intelligence',
          entityId: entry.entityId,
          metadata,
        },
      });
    } catch (error) {
      this.logger.warn(
        `MI audit log write failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async recordFromFacts(
    consumer: string,
    facts: string,
    profile: MatterProfile,
    context?: { tenantId?: string; userId?: string; entityType?: string; entityId?: string },
  ): Promise<void> {
    await this.record({
      consumer,
      profile,
      confidence: profile.confidence,
      inputsHash: this.matterMemory.hashFacts(facts),
      ...context,
    });
  }
}
