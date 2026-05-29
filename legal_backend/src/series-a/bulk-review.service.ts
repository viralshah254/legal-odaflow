import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BulkReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  list(tenantId: string, matterId: string) {
    return this.prisma.bulkDocumentReviewJob.findMany({
      where: { tenantId, matterId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async create(
    tenantId: string,
    matterId: string,
    documentIds: string[],
    userId: string,
  ) {
    const matter = await this.prisma.matter.findFirst({ where: { id: matterId, tenantId } });
    if (!matter) throw new NotFoundException('Matter not found');

    const job = await this.prisma.bulkDocumentReviewJob.create({
      data: {
        tenantId,
        matterId,
        documentIds: documentIds as unknown as Prisma.InputJsonValue,
        status: 'QUEUED',
        createdBy: userId,
      },
    });

    this.runJob(tenantId, userId, job.id).catch(() => undefined);
    return job;
  }

  private async runJob(tenantId: string, userId: string, jobId: string) {
    const job = await this.prisma.bulkDocumentReviewJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) return;

    const docIds = (job.documentIds as string[]) ?? [];
    const matrix: Array<{ documentId: string; summary: string; risks: string[] }> = [];

    for (const documentId of docIds) {
      const doc = await this.prisma.document.findFirst({
        where: { id: documentId, tenantId },
      });
      if (!doc) continue;

      try {
        const result = await this.aiGateway.runMatterSummary({
          tenantId,
          userId,
          matterId: job.matterId,
          matterTitle: `Diligence: ${doc.fileName}`,
        });
        matrix.push({
          documentId,
          summary: result.outputMarkdown?.slice(0, 2000) ?? 'Summary unavailable',
          risks: [],
        });
      } catch {
        matrix.push({
          documentId,
          summary: 'Analysis failed',
          risks: ['processing_error'],
        });
      }
    }

    await this.prisma.bulkDocumentReviewJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        summaryMatrix: matrix as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }
}
