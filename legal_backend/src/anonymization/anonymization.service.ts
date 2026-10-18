import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';
import {
  CreateAnonymizationJobDto,
  UpdateAnonymizationJobDto,
} from './dto/anonymization.dto';

@Injectable()
export class AnonymizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  async findAll(tenantId: string, status?: string) {
    const jobs = await this.prisma.anonymizationJob.findMany({
      where: { status: status || undefined },
      orderBy: { createdAt: 'desc' },
    });

    const documentIds = jobs
      .filter((job) => job.sourceType === 'DOCUMENT')
      .map((job) => job.sourceId);

    if (documentIds.length === 0) {
      return [];
    }

    const tenantDocuments = await this.prisma.document.findMany({
      where: { id: { in: documentIds }, tenantId },
      select: { id: true },
    });
    const allowedSourceIds = new Set(tenantDocuments.map((doc) => doc.id));

    return jobs.filter(
      (job) => job.sourceType === 'DOCUMENT' && allowedSourceIds.has(job.sourceId),
    );
  }

  async findOne(id: string, tenantId: string) {
    const job = await this.prisma.anonymizationJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException('Anonymization job not found');
    }
    await this.assertJobTenantAccess(job, tenantId);
    return job;
  }

  async create(tenantId: string, dto: CreateAnonymizationJobDto) {
    await this.assertSourceBelongsToTenant(dto.sourceType, dto.sourceId, tenantId);
    return this.prisma.anonymizationJob.create({
      data: {
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        status: 'QUEUED',
      },
    });
  }

  async createAndEnqueue(dto: CreateAnonymizationJobDto) {
    const job = await this.prisma.anonymizationJob.create({
      data: {
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        status: 'QUEUED',
      },
    });
    await this.jobsService.enqueueAnonymizationJob({
      anonymizationJobId: job.id,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
    });
    return job;
  }

  async update(id: string, tenantId: string, dto: UpdateAnonymizationJobDto) {
    await this.findOne(id, tenantId);
    return this.prisma.anonymizationJob.update({
      where: { id },
      data: {
        status: dto.status,
        outputText: dto.outputText,
        error: dto.error,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.anonymizationJob.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertSourceBelongsToTenant(
    sourceType: string,
    sourceId: string,
    tenantId: string,
  ): Promise<void> {
    await this.assertJobTenantAccess({ sourceType, sourceId }, tenantId);
  }

  private async assertJobTenantAccess(
    job: { sourceType: string; sourceId: string },
    tenantId: string,
  ): Promise<void> {
    if (job.sourceType === 'DOCUMENT') {
      const document = await this.prisma.document.findFirst({
        where: { id: job.sourceId, tenantId },
        select: { id: true },
      });
      if (!document) {
        throw new NotFoundException('Anonymization job not found');
      }
      return;
    }

    throw new NotFoundException('Anonymization job not found');
  }
}
