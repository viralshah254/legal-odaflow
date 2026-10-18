import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { MatterIntelligenceEvent, MatterProfile } from './matter-intelligence.types';

@Injectable()
export class SelectionTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  profileHash(profile: Pick<MatterProfile, 'practiceArea' | 'subPracticeArea' | 'nature'>): string {
    const key = `${profile.practiceArea}|${profile.subPracticeArea ?? ''}|${profile.nature}`;
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  async record(event: MatterIntelligenceEvent): Promise<void> {
    await this.prisma.matterIntelligenceEvent.create({
      data: {
        eventType: event.eventType,
        matterProfileHash: event.matterProfileHash,
        practiceArea: event.practiceArea,
        subPracticeArea: event.subPracticeArea,
        nature: event.nature,
        documentId: event.documentId,
        documentKind: event.documentKind,
        tenantId: event.tenantId,
        userId: event.userId,
      },
    });
  }

  async popularityBoost(
    practiceArea: string,
    subPracticeArea: string | undefined,
    documentKind?: string,
  ): Promise<number> {
    const hashPrefix = createHash('sha256')
      .update(`${practiceArea}|${subPracticeArea ?? ''}`)
      .digest('hex')
      .slice(0, 16);

    const count = await this.prisma.matterIntelligenceEvent.count({
      where: {
        matterProfileHash: { startsWith: hashPrefix.slice(0, 8) },
        ...(documentKind ? { documentKind } : {}),
        eventType: { in: ['document_selected', 'document_generated', 'document_filed'] },
      },
    });

    return Math.min(0.1, count * 0.002);
  }
}
