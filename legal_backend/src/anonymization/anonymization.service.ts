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

  async findAll(status?: string) {
    return this.prisma.anonymizationJob.findMany({
      where: { status: status || undefined },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const job = await this.prisma.anonymizationJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException('Anonymization job not found');
    }
    return job;
  }

  async create(dto: CreateAnonymizationJobDto) {
    return this.prisma.anonymizationJob.create({
      data: {
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        status: 'QUEUED',
      },
    });
  }

  async createAndEnqueue(dto: CreateAnonymizationJobDto) {
    const job = await this.create(dto);
    await this.jobsService.enqueueAnonymizationJob({
      anonymizationJobId: job.id,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
    });
    return job;
  }

  async update(id: string, dto: UpdateAnonymizationJobDto) {
    await this.findOne(id);
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

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.anonymizationJob.delete({ where: { id } });
    return { deleted: true };
  }
}
