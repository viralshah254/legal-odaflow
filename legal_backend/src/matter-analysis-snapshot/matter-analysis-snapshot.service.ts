import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAutonomyService } from '@/matter-autonomy/matter-autonomy.service';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      const record = asRecord(item);
      return String(
        record.title
        ?? record.description
        ?? record.name
        ?? record.action
        ?? record.item
        ?? '',
      ).trim();
    })
    .filter(Boolean);
}

@Injectable()
export class MatterAnalysisSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly autonomy: MatterAutonomyService,
  ) {}

  async run(
    tenantId: string,
    matterId: string,
    userId: string,
    scope: 'full' | 'incremental' = 'full',
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      include: {
        documents: {
          where: { status: 'ACTIVE' },
          select: {
            fileName: true,
            documentCode: true,
            extractedText: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        matterIssues: {
          select: { title: true, status: true, description: true },
          take: 20,
        },
        tasks: {
          where: { status: { notIn: ['DONE', 'COMPLETED'] } },
          select: { title: true, priority: true, dueDate: true },
          orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
          take: 10,
        },
        bulkDocReviewJobs: {
          where: { status: 'COMPLETED' },
          select: { summaryMatrix: true },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    const profile = asRecord(matter.matterProfile);
    const taskGraph = asRecord(matter.matterTaskGraph);
    const bulkOutput = asRecord(matter.bulkDocReviewJobs[0]?.summaryMatrix);
    const synthesis = asRecord(bulkOutput.synthesis);
    const bulkDocuments = Array.isArray(bulkOutput.documents)
      ? bulkOutput.documents.map(asRecord)
      : [];
    const bulkRisks = bulkDocuments.flatMap((document) => asStringList(document.risks));
    const profileIssues = asStringList(profile.issues);
    const risks = [
      ...bulkRisks,
      ...profileIssues,
      ...matter.matterIssues
        .filter((issue) => issue.status !== 'RESOLVED')
        .map((issue) => issue.title),
    ].filter((item, index, all) => all.indexOf(item) === index).slice(0, 8);
    const recommendedActions = asStringList(taskGraph.recommendedActions);
    const nextBestAction = typeof taskGraph.nextBestAction === 'string'
      ? taskGraph.nextBestAction
      : '';
    const nextActions = [
      ...asStringList(synthesis.recommendedActions),
      nextBestAction,
      ...recommendedActions,
      ...matter.tasks.map((task) => task.title),
    ].filter((item, index, all) => item && all.indexOf(item) === index).slice(0, 8);
    const evidenceGaps = [
      ...asStringList(synthesis.missingItems),
      ...asStringList(taskGraph.missingDocuments),
    ].filter((item, index, all) => all.indexOf(item) === index).slice(0, 10);
    const contradictions = asStringList(synthesis.contradictions).slice(0, 10);
    const textDocuments = matter.documents.filter((document) => document.extractedText?.trim());
    const bulkSummary = typeof synthesis.executiveSummary === 'string'
      ? synthesis.executiveSummary.trim()
      : '';
    const summary = bulkSummary || (matter.factsSummary?.trim()
      ? `${matter.factsSummary.trim()} ${matter.documents.length} document(s) are linked; ${textDocuments.length} have searchable text.`
      : `${matter.title} is a ${matter.matterType.toLowerCase()} matter in ${matter.practiceArea}. ${matter.documents.length} document(s) are linked. Add a facts summary to improve analysis quality.`);

    const snapshot = await this.prisma.matterAnalysisSnapshot.create({
      data: {
        tenantId,
        matterId,
        scope,
        summary,
        risks: risks as Prisma.InputJsonValue,
        nextActions: nextActions as Prisma.InputJsonValue,
        evidenceGaps: evidenceGaps as Prisma.InputJsonValue,
        contradictions: contradictions as Prisma.InputJsonValue,
        sourceDocumentCount: matter.documents.length,
      },
    });

    if (scope === 'full') {
      this.autonomy.triggerOnCreate(matterId, tenantId, userId);
    } else {
      this.autonomy.triggerOnDocumentUpload(matterId, tenantId, userId);
    }

    return snapshot;
  }

  async latest(tenantId: string, matterId: string) {
    const snapshot = await this.prisma.matterAnalysisSnapshot.findFirst({
      where: { tenantId, matterId },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot) return null;

    return {
      ...snapshot,
      risks: asStringList(snapshot.risks),
      nextActions: asStringList(snapshot.nextActions),
      evidenceGaps: asStringList(snapshot.evidenceGaps),
      contradictions: asStringList(snapshot.contradictions),
    };
  }
}
