import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePlaybookDto, UpdatePlaybookDto } from './dto/playbook.dto';

@Injectable()
export class PlaybooksService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreatePlaybookDto) {
    return this.prisma.matterPlaybook.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        matterType: dto.matterType,
        countryCode: dto.countryCode?.toUpperCase(),
        jurisdiction: dto.jurisdiction,
        practiceArea: dto.practiceArea,
        taskTemplates: dto.taskTemplates as Prisma.InputJsonValue,
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  findAll(tenantId: string, isEnabled?: string) {
    return this.prisma.matterPlaybook.findMany({
      where: {
        tenantId,
        isEnabled: isEnabled === undefined ? undefined : isEnabled === 'true',
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, playbookId: string) {
    const playbook = await this.prisma.matterPlaybook.findFirst({
      where: { id: playbookId, tenantId },
    });

    if (!playbook) {
      throw new NotFoundException('Playbook not found');
    }

    return playbook;
  }

  async update(tenantId: string, playbookId: string, dto: UpdatePlaybookDto) {
    await this.findOne(tenantId, playbookId);

    return this.prisma.matterPlaybook.update({
      where: { id: playbookId },
      data: {
        name: dto.name,
        description: dto.description,
        matterType: dto.matterType,
        countryCode: dto.countryCode?.toUpperCase(),
        jurisdiction: dto.jurisdiction,
        practiceArea: dto.practiceArea,
        taskTemplates: dto.taskTemplates as Prisma.InputJsonValue | undefined,
        isEnabled: dto.isEnabled,
      },
    });
  }

  async remove(tenantId: string, playbookId: string) {
    await this.findOne(tenantId, playbookId);
    await this.prisma.matterPlaybook.delete({ where: { id: playbookId } });
    return { success: true };
  }
}
