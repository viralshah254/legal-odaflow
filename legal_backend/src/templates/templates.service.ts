import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TemplateLibraryService } from './template-library.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { canManageTemplateDeletion, TEMPLATE_CATEGORY } from './template-categories';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateLibrary: TemplateLibraryService,
  ) {}

  async create(tenantId: string, dto: CreateTemplateDto, userId?: string) {
    return this.prisma.documentTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        content: dto.content,
        category: dto.category,
        matterType: dto.matterType,
        countryCode: dto.countryCode,
        practiceArea: dto.practiceArea,
        documentKind: dto.documentKind,
        source: 'CUSTOM',
        isActive: dto.isActive ?? true,
        createdByUserId: userId,
      },
    });
  }

  async findAll(
    tenantId: string,
    options: {
      category?: string;
      isActive?: string;
      practiceArea?: string;
      countryCode?: string;
      source?: string;
      userId?: string;
    } = {},
  ) {
    let provisionedCount = 0;
    if (options.userId) {
      provisionedCount = await this.templateLibrary.maybeAutoProvisionOnFirstVisit(
        tenantId,
        options.userId,
      );
    }

    const templates = await this.prisma.documentTemplate.findMany({
      where: {
        tenantId,
        category: options.category || undefined,
        countryCode: options.countryCode || undefined,
        practiceArea: options.practiceArea || undefined,
        source: options.source || undefined,
        NOT: { source: 'SESSION' },
        isActive:
          options.isActive === undefined ? undefined : options.isActive === 'true',
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      templates,
      provisionedCount,
    };
  }

  async checkNameExists(
    tenantId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    return { exists: !!existing };
  }

  async findOne(tenantId: string, templateId: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async update(tenantId: string, templateId: string, dto: UpdateTemplateDto) {
    await this.findOne(tenantId, templateId);

    return this.prisma.documentTemplate.update({
      where: { id: templateId },
      data: dto,
    });
  }

  async remove(
    tenantId: string,
    templateId: string,
    userId: string,
    tenantRole?: string,
  ) {
    const template = await this.findOne(tenantId, templateId);

    if (
      !canManageTemplateDeletion({
        category: template.category,
        createdByUserId: template.createdByUserId,
        userId,
        tenantRole,
      })
    ) {
      throw new ForbiddenException(
        'Only the template creator or a firm admin can delete user templates',
      );
    }

    await this.prisma.documentTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }

  /** Fork a library template into a hidden session copy (not listed in template library). */
  async forkTemplateForSession(
    tenantId: string,
    templateId: string,
    userId: string,
  ) {
    const source = await this.findOne(tenantId, templateId);

    return this.prisma.documentTemplate.create({
      data: {
        tenantId,
        name: `${source.name} (draft session)`,
        content: source.content,
        category: TEMPLATE_CATEGORY.USER,
        matterType: source.matterType,
        countryCode: source.countryCode,
        practiceArea: source.practiceArea,
        documentKind: source.documentKind,
        jurisdiction: source.jurisdiction,
        conditionalFields: source.conditionalFields ?? undefined,
        source: 'SESSION',
        systemTemplateId: source.systemTemplateId,
        isActive: false,
        createdByUserId: userId,
      },
    });
  }

  /** Ensure a tenant copy exists for a system template, then return its id. */
  async resolveSystemTemplateId(
    tenantId: string,
    systemTemplateId: string,
  ): Promise<string> {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { tenantId, systemTemplateId, isActive: true },
      select: { id: true },
    });
    if (existing) return existing.id;

    const system = await this.prisma.systemDocumentTemplate.findFirst({
      where: { id: systemTemplateId, isActive: true },
    });
    if (!system) {
      throw new NotFoundException('System template not found');
    }

    await this.templateLibrary.provisionTemplates(tenantId, {
      systemTemplateIds: [systemTemplateId],
    });

    const provisioned = await this.prisma.documentTemplate.findFirst({
      where: { tenantId, systemTemplateId, isActive: true },
      select: { id: true },
    });
    if (!provisioned) {
      throw new NotFoundException('Failed to provision system template');
    }
    return provisioned.id;
  }
}
