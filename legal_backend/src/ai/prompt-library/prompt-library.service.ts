/**
 * Firm + system prompt templates for the Assistant workspace.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const SYSTEM_PROMPTS = [
  {
    title: 'Lead counsel key issues review',
    description: 'Exhaustive key issues list from attached contract',
    promptText:
      'You are acting as lead counsel. Review the attached agreement and comments. Prepare a fully exhaustive Key Issues List covering risk, missing clauses, and negotiation priorities.',
    category: 'review',
    deliverableType: 'key_issues_list',
  },
  {
    title: 'Vendor diligence summary',
    description: 'Quick vendor contract diligence memo',
    promptText:
      'Review this vendor agreement and produce a diligence summary: parties, key obligations, liability caps, termination rights, and red flags.',
    category: 'diligence',
    deliverableType: 'clause_summary',
  },
  {
    title: 'GDPR compliance check',
    description: 'Data protection clause review',
    promptText:
      'Analyze this document for GDPR/DPDP compliance. Flag personal data processing, missing DPA clauses, cross-border transfers, and breach notification gaps.',
    category: 'compliance',
    deliverableType: 'research_memo',
  },
  {
    title: 'Redline report',
    description: 'Generate structured redline suggestions',
    promptText:
      'Review this contract against market-standard terms. Produce a redline report with original text, proposed replacement, and rationale for each change.',
    category: 'review',
    deliverableType: 'redline_report',
  },
];

@Injectable()
export class PromptLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, category?: string) {
    await this.ensureSeeded(tenantId);
    return this.prisma.promptLibraryEntry.findMany({
      where: {
        active: true,
        OR: [{ tenantId }, { tenantId: null }],
        ...(category ? { category } : {}),
      },
      orderBy: [{ tenantId: 'desc' }, { title: 'asc' }],
    });
  }

  async create(
    tenantId: string,
    data: {
      title: string;
      description?: string;
      promptText: string;
      category?: string;
      deliverableType?: string;
    },
  ) {
    return this.prisma.promptLibraryEntry.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description,
        promptText: data.promptText,
        category: data.category ?? 'general',
        deliverableType: data.deliverableType,
      },
    });
  }

  private async ensureSeeded(tenantId: string) {
    const count = await this.prisma.promptLibraryEntry.count({
      where: { tenantId: null },
    });
    if (count > 0) return;

    await this.prisma.promptLibraryEntry.createMany({
      data: SYSTEM_PROMPTS.map((p) => ({
        tenantId: null,
        title: p.title,
        description: p.description,
        promptText: p.promptText,
        category: p.category,
        deliverableType: p.deliverableType,
      })),
      skipDuplicates: true,
    });
  }
}
