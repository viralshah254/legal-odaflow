import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AiPromptTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async loadActive(key: string) {
    return this.prisma.aIPromptTemplate.findFirst({
      where: { key, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  async renderUserPrompt(key: string, variables: Record<string, string>) {
    const template = await this.loadActive(key);
    if (!template) {
      return null;
    }

    let rendered = template.userTemplate;
    for (const [name, value] of Object.entries(variables)) {
      rendered = rendered.replaceAll(`{{${name}}}`, value);
    }

    return {
      systemPrompt: template.systemPrompt,
      userPrompt: rendered,
      modelTier: template.modelTier,
    };
  }
}
