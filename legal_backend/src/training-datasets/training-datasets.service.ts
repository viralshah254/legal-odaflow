import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateTrainingDatasetDto,
  CreateTrainingDatasetItemDto,
  UpdateTrainingDatasetDto,
  UpdateTrainingDatasetItemDto,
} from './dto/training-dataset.dto';

@Injectable()
export class TrainingDatasetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllDatasets(countryCode?: string) {
    return this.prisma.trainingDataset.findMany({
      where: { countryCode: countryCode?.toUpperCase() },
      include: { items: { take: 5, orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findDataset(id: string) {
    const dataset = await this.prisma.trainingDataset.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: 'desc' } } },
    });

    if (!dataset) {
      throw new NotFoundException('Training dataset not found');
    }

    return dataset;
  }

  async createDataset(dto: CreateTrainingDatasetDto) {
    return this.prisma.trainingDataset.create({
      data: {
        name: dto.name,
        datasetType: dto.datasetType,
        countryCode: dto.countryCode?.toUpperCase(),
        practiceArea: dto.practiceArea,
        issueType: dto.issueType,
        version: dto.version ?? '1.0',
        sourcePolicy: dto.sourcePolicy,
        createdById: dto.createdById,
        status: dto.status ?? 'DRAFT',
      },
    });
  }

  async updateDataset(id: string, dto: UpdateTrainingDatasetDto) {
    await this.findDataset(id);
    return this.prisma.trainingDataset.update({
      where: { id },
      data: dto,
    });
  }

  async removeDataset(id: string) {
    await this.findDataset(id);
    await this.prisma.trainingDataset.delete({ where: { id } });
    return { deleted: true };
  }

  async findItems(datasetId: string) {
    await this.findDataset(datasetId);
    return this.prisma.trainingDatasetItem.findMany({
      where: { datasetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createItem(dto: CreateTrainingDatasetItemDto) {
    await this.findDataset(dto.datasetId);
    return this.prisma.trainingDatasetItem.create({
      data: {
        datasetId: dto.datasetId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        inputText: dto.inputText,
        expectedOutput: dto.expectedOutput,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        consentId: dto.consentId,
        riskLevel: dto.riskLevel ?? 'LOW',
        approved: dto.approved ?? false,
      },
    });
  }

  async updateItem(id: string, dto: UpdateTrainingDatasetItemDto) {
    const item = await this.prisma.trainingDatasetItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Training dataset item not found');
    }

    return this.prisma.trainingDatasetItem.update({
      where: { id },
      data: dto,
    });
  }

  async removeItem(id: string) {
    const item = await this.prisma.trainingDatasetItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Training dataset item not found');
    }

    await this.prisma.trainingDatasetItem.delete({ where: { id } });
    return { deleted: true };
  }
}
