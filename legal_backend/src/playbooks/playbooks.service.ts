import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePlaybookDto, UpdatePlaybookDto } from './dto/playbook.dto';

interface PlaybookTaskTemplate {
  title: string;
  priority?: string;
  dueInDays?: number;
  status?: string;
  assigneeId?: string;
}

export interface ExecutePlaybookResult {
  taskCount: number;
  playbookName: string | null;
  playbookId: string | null;
}

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

  async executePlaybook(
    tenantId: string,
    matterId: string,
    matterType: string,
    countryCode: string,
    createdByUserId?: string,
  ): Promise<ExecutePlaybookResult> {
    const normalizedCountry = countryCode.toUpperCase();
    const candidates = await this.prisma.matterPlaybook.findMany({
      where: {
        tenantId,
        isEnabled: true,
        OR: [
          { matterType, countryCode: normalizedCountry },
          { matterType, countryCode: null },
          { matterType: null, countryCode: normalizedCountry },
          { matterType: null, countryCode: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const playbook =
      candidates.find(
        (row) => row.matterType === matterType && row.countryCode === normalizedCountry,
      ) ??
      candidates.find(
        (row) => row.matterType === matterType && !row.countryCode,
      ) ??
      candidates.find((row) => !row.matterType && row.countryCode === normalizedCountry) ??
      candidates[0];

    if (!playbook) {
      return { taskCount: 0, playbookName: null, playbookId: null };
    }

    const templates = this.parseTaskTemplates(playbook.taskTemplates);
    if (templates.length === 0) {
      return { taskCount: 0, playbookName: playbook.name, playbookId: playbook.id };
    }

    const now = new Date();
    await this.prisma.task.createMany({
      data: templates.map((template) => ({
        tenantId,
        matterId,
        title: template.title,
        priority: template.priority ?? 'MEDIUM',
        status: template.status ?? 'TODO',
        assigneeId: template.assigneeId ?? createdByUserId,
        dueDate: template.dueInDays
          ? new Date(now.getTime() + template.dueInDays * 24 * 60 * 60 * 1000)
          : undefined,
      })),
    });

    return {
      taskCount: templates.length,
      playbookName: playbook.name,
      playbookId: playbook.id,
    };
  }

  private parseTaskTemplates(raw: unknown): PlaybookTaskTemplate[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((item): item is PlaybookTaskTemplate => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const title = (item as { title?: unknown }).title;
      return typeof title === 'string' && title.trim().length > 0;
    });
  }

  /** P14-01 — create tasks from MI playbook registry keys. */
  async executeByRegistryKeys(
    tenantId: string,
    matterId: string,
    registryKeys: string[],
    createdByUserId?: string,
  ): Promise<ExecutePlaybookResult> {
    const templatesByKey: Record<string, PlaybookTaskTemplate[]> = {
      demand_notice: [{ title: 'Send legal notice', priority: 'HIGH', dueInDays: 3 }],
      litigation_intake: [{ title: 'File petition', priority: 'HIGH', dueInDays: 7 }],
      transactional_intake: [{ title: 'Draft contract', priority: 'MEDIUM', dueInDays: 5 }],
      evidence_gathering: [{ title: 'Collect evidence', priority: 'HIGH', dueInDays: 2 }],
      client_intake: [{ title: 'Schedule client call', priority: 'MEDIUM', dueInDays: 1 }],
    };

    const templates: PlaybookTaskTemplate[] = [];
    for (const key of registryKeys) {
      const mapped = templatesByKey[key];
      if (mapped) templates.push(...mapped);
      else templates.push({ title: key.replace(/_/g, ' '), priority: 'MEDIUM', dueInDays: 5 });
    }

    if (templates.length === 0) {
      return { taskCount: 0, playbookName: null, playbookId: null };
    }

    const now = new Date();
    await this.prisma.task.createMany({
      data: templates.map((template) => ({
        tenantId,
        matterId,
        title: template.title,
        priority: template.priority ?? 'MEDIUM',
        status: template.status ?? 'TODO',
        assigneeId: template.assigneeId ?? createdByUserId,
        dueDate: template.dueInDays
          ? new Date(now.getTime() + template.dueInDays * 24 * 60 * 60 * 1000)
          : undefined,
      })),
    });

    return {
      taskCount: templates.length,
      playbookName: `MI registry (${registryKeys.join(', ')})`,
      playbookId: null,
    };
  }
}
