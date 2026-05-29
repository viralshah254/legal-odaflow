import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTemplateDto) {
    return this.prisma.documentTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        content: dto.content,
        category: dto.category,
        matterType: dto.matterType,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(tenantId: string, category?: string, isActive?: string) {
    return this.prisma.documentTemplate.findMany({
      where: {
        tenantId,
        category: category || undefined,
        isActive:
          isActive === undefined ? undefined : isActive === 'true',
      },
      orderBy: { updatedAt: 'desc' },
    });
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

  async remove(tenantId: string, templateId: string) {
    await this.findOne(tenantId, templateId);
    await this.prisma.documentTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }
}
