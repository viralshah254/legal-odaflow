import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  EvidenceRef,
  MatterGraph,
  MatterProfile,
  MatterTaskGraph,
} from './matter-intelligence.types';

export type MatterMemoryEntity = 'matter' | 'consumerCase' | 'draftingSession';

export interface MatterMemorySnapshot {
  profile?: MatterProfile;
  graph?: MatterGraph;
  taskGraph?: MatterTaskGraph;
  factsHash?: string;
}

type MatterMemoryDbFields = {
  matterProfile: Prisma.JsonValue | null;
  matterGraph: Prisma.JsonValue | null;
  matterTaskGraph: Prisma.JsonValue | null;
};

type MatterMemoryLoadRow = MatterMemoryDbFields & {
  factsSummary?: string | null;
  facts?: string | null;
  sourceQuery?: string | null;
};

type MatterMemorySelectFields = Record<
  'matterProfile' | 'matterGraph' | 'matterTaskGraph' | 'factsSummary' | 'facts' | 'sourceQuery',
  true
>;

type MatterMemoryPersistenceData = {
  matterProfile?: Prisma.InputJsonValue | null;
  matterGraph?: Prisma.InputJsonValue | null;
  matterTaskGraph?: Prisma.InputJsonValue | null;
};

const MATTER_MI_SELECT = {
  matterProfile: true,
  matterGraph: true,
  matterTaskGraph: true,
  factsSummary: true,
} as const;

const CONSUMER_CASE_MI_SELECT = {
  matterProfile: true,
  matterGraph: true,
  matterTaskGraph: true,
  facts: true,
} as const;

const DRAFTING_SESSION_MI_SELECT = {
  matterProfile: true,
  matterGraph: true,
  matterTaskGraph: true,
  sourceQuery: true,
} as const;

@Injectable()
export class MatterMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  hashFacts(facts: string): string {
    return createHash('sha256').update(facts.trim().toLowerCase()).digest('hex').slice(0, 16);
  }

  shouldReclassify(facts: string, existing?: MatterProfile): boolean {
    if (!existing) return true;
    const hash = this.hashFacts(facts);
    const storedHash = (existing as MatterProfile & { factsHash?: string }).factsHash;
    if (storedHash && storedHash === hash) return false;
    return existing.confidence < 0.85;
  }

  async load(entity: MatterMemoryEntity, id: string): Promise<MatterMemorySnapshot | null> {
    if (entity === 'matter') {
      const row = (await this.prisma.matter.findUnique({
        where: { id },
        select: MATTER_MI_SELECT as unknown as MatterMemorySelectFields,
      })) as MatterMemoryLoadRow | null;
      if (!row) return null;
      return {
        profile: row.matterProfile as unknown as MatterProfile | undefined,
        graph: row.matterGraph as unknown as MatterGraph | undefined,
        taskGraph: row.matterTaskGraph as unknown as MatterTaskGraph | undefined,
        factsHash: row.factsSummary ? this.hashFacts(row.factsSummary) : undefined,
      };
    }
    if (entity === 'consumerCase') {
      const row = (await this.prisma.consumerCase.findUnique({
        where: { id },
        select: CONSUMER_CASE_MI_SELECT as unknown as MatterMemorySelectFields,
      })) as MatterMemoryLoadRow | null;
      if (!row) return null;
      return {
        profile: row.matterProfile as unknown as MatterProfile | undefined,
        graph: row.matterGraph as unknown as MatterGraph | undefined,
        taskGraph: row.matterTaskGraph as unknown as MatterTaskGraph | undefined,
        factsHash: row.facts ? this.hashFacts(row.facts) : undefined,
      };
    }
    const row = (await this.prisma.draftingSession.findUnique({
      where: { id },
      select: DRAFTING_SESSION_MI_SELECT as unknown as MatterMemorySelectFields,
    })) as MatterMemoryLoadRow | null;
    if (!row) return null;
    return {
      profile: row.matterProfile as unknown as MatterProfile | undefined,
      graph: row.matterGraph as unknown as MatterGraph | undefined,
      taskGraph: row.matterTaskGraph as unknown as MatterTaskGraph | undefined,
      factsHash: row.sourceQuery ? this.hashFacts(row.sourceQuery) : undefined,
    };
  }

  async mergeEvidenceItems(
    entity: MatterMemoryEntity,
    id: string,
    items: EvidenceRef[],
  ): Promise<void> {
    if (items.length === 0) return;

    const snapshot = await this.load(entity, id);
    if (!snapshot) return;

    const graph = snapshot.graph ?? {
      parties: [],
      claims: [],
      defences: [],
      statutes: [],
      precedents: [],
      evidence: [],
      documents: [],
      timeline: [],
    };

    const existing = graph.evidence ?? [];
    const seen = new Set(existing.map((e) => `${e.sourceDocumentId ?? ''}:${e.description}`));
    const merged = [...existing];

    for (const item of items) {
      const key = `${item.sourceDocumentId ?? ''}:${item.description}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    await this.persist(entity, id, {
      ...snapshot,
      graph: { ...graph, evidence: merged },
    });
  }

  async mergeGeneratedDocument(
    entity: MatterMemoryEntity,
    id: string,
    document: { title: string; documentType?: string },
  ): Promise<void> {
    const snapshot = await this.load(entity, id);
    if (!snapshot) return;

    const graph = snapshot.graph ?? {
      parties: [],
      claims: [],
      defences: [],
      statutes: [],
      precedents: [],
      evidence: [],
      documents: [],
      timeline: [],
    };

    const documents = [...(graph.documents ?? [])];
    if (!documents.some((d) => d.title === document.title)) {
      documents.push({ title: document.title, documentType: document.documentType });
    }

    const taskGraph = snapshot.taskGraph;
    const missingDocuments = (taskGraph?.missingDocuments ?? []).filter(
      (doc) => doc.toLowerCase() !== document.title.toLowerCase(),
    );

    await this.persist(entity, id, {
      ...snapshot,
      graph: { ...graph, documents },
      taskGraph: taskGraph ? { ...taskGraph, missingDocuments } : undefined,
    });
  }

  async persist(
    entity: MatterMemoryEntity,
    id: string,
    snapshot: MatterMemorySnapshot,
    facts?: string,
  ): Promise<void> {
    const profile = snapshot.profile
      ? ({ ...snapshot.profile, factsHash: facts ? this.hashFacts(facts) : undefined } as unknown as Prisma.InputJsonValue)
      : undefined;

    const memoryData: MatterMemoryPersistenceData = {
      matterProfile: profile ?? null,
      matterGraph: (snapshot.graph as unknown as Prisma.InputJsonValue | null) ?? null,
      matterTaskGraph: (snapshot.taskGraph as unknown as Prisma.InputJsonValue | null) ?? null,
    };

    if (entity === 'matter') {
      await this.prisma.matter.update({
        where: { id },
        data: memoryData as unknown as Prisma.MatterUpdateInput,
      });
    } else if (entity === 'consumerCase') {
      await this.prisma.consumerCase.update({
        where: { id },
        data: memoryData as unknown as Prisma.ConsumerCaseUpdateInput,
      });
    } else {
      await this.prisma.draftingSession.update({
        where: { id },
        data: memoryData as never,
      });
    }
  }
}
