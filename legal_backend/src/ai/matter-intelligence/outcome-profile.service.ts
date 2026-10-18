import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { MatterNature, MatterProfile } from './matter-intelligence.types';

/** Aggregated outcome signals for a matter-type bucket (P12 scaffold). */
export interface OutcomeProfile {
  practiceArea: string;
  subPracticeArea?: string;
  nature: MatterNature;
  commonDocuments: string[];
  commonActions: string[];
  sampleSize: number;
  confidence: number;
}

@Injectable()
export class OutcomeProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Build a placeholder outcome profile from MatterProfile until selection events accumulate. */
  buildStub(profile: MatterProfile): OutcomeProfile {
    return {
      practiceArea: profile.practiceArea,
      subPracticeArea: profile.subPracticeArea,
      nature: profile.nature,
      commonDocuments: profile.documentTypes.slice(0, 5),
      commonActions: profile.remedies.slice(0, 5),
      sampleSize: 0,
      confidence: profile.confidence,
    };
  }

  /** Aggregate from MatterIntelligenceEvent; falls back to stub when sample size is low. */
  async getForProfile(
    profile: MatterProfile,
    options?: { playbookId?: string },
  ): Promise<OutcomeProfile> {
    // Deterministic playbooks already override MI maintenance mislabels upstream;
    // keep outcome bucketing on the corrected criminal profile, never family_matrimonial.
    const practiceArea =
      options?.playbookId === 'self_defense_homicide'
        ? 'litigation_disputes'
        : profile.practiceArea;
    const subPracticeArea =
      options?.playbookId === 'self_defense_homicide'
        ? 'criminal_fir_bail'
        : profile.subPracticeArea;

    const events = await this.prisma.matterIntelligenceEvent.findMany({
      where: {
        practiceArea,
        ...(subPracticeArea ? { subPracticeArea } : {}),
        nature: profile.nature,
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    if (events.length < 5) {
      return {
        ...this.buildStub(profile),
        practiceArea,
        subPracticeArea,
      };
    }

    const docCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();
    for (const event of events) {
      if (event.documentKind) {
        docCounts.set(event.documentKind, (docCounts.get(event.documentKind) ?? 0) + 1);
      }
      if (event.eventType === 'action_completed' && event.documentId) {
        actionCounts.set(event.documentId, (actionCounts.get(event.documentId) ?? 0) + 1);
      }
    }

    const commonDocuments = [...docCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kind]) => kind);

    const commonActions = [...actionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action]) => action);

    return {
      practiceArea,
      subPracticeArea,
      nature: profile.nature,
      commonDocuments: commonDocuments.length ? commonDocuments : profile.documentTypes.slice(0, 5),
      commonActions: commonActions.length ? commonActions : profile.remedies.slice(0, 5),
      sampleSize: events.length,
      confidence: Math.min(0.95, 0.5 + events.length * 0.01),
    };
  }
}
