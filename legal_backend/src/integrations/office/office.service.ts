/**
 * Office add-in services: document-grounded amendments for Word.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedlineExportService } from '@/platform/document-review/redline-export.service';
import type { RedlineEditOp } from '@/platform/document-review/document-review.types';

export interface DraftAmendmentsDto {
  documentText: string;
  instruction: string;
  matterId?: string;
  countryCode?: string;
  tenantId: string;
}

export interface DraftAmendment {
  id: string;
  clauseLabel: string;
  originalText: string;
  proposedText: string;
  rationale: string;
  anchorText: string;
}

@Injectable()
export class OfficeService {
  constructor(
    private readonly llm: LlmCompletionService,
    private readonly prisma: PrismaService,
    private readonly redlineExport: RedlineExportService,
  ) {}

  async draftAmendments(dto: DraftAmendmentsDto): Promise<{
    amendments: DraftAmendment[];
    editOps: RedlineEditOp[];
  }> {
    if (!dto.documentText?.trim() || !dto.instruction?.trim()) {
      throw new BadRequestException('documentText and instruction are required.');
    }

    const maxChars = 120_000;
    const docText =
      dto.documentText.length > maxChars
        ? dto.documentText.slice(0, maxChars) + '\n\n[Document truncated for processing]'
        : dto.documentText;

    let matterContext = '';
    if (dto.matterId) {
      try {
        const matter = await this.prisma.matter.findFirst({
          where: { id: dto.matterId, tenantId: dto.tenantId },
          select: { title: true, factsSummary: true, jurisdiction: true, practiceArea: true },
        });
        if (matter) {
          matterContext = `\n\nMatter context:\n${JSON.stringify(matter)}`;
        }
      } catch {
        // Matter context is optional
      }
    }

    const systemPrompt = `You are an expert contract lawyer. The user has a document open in Microsoft Word and wants specific amendments.
Return a JSON array of amendment objects. Each object must have:
- clauseLabel: short name (e.g. "Indemnification")
- originalText: exact substring from the document to replace (must appear verbatim in the document, max 500 chars)
- proposedText: replacement language
- rationale: one sentence explaining why

Return ONLY valid JSON array, no markdown fences. Limit to 8 amendments focused on the user's instruction.`;

    const userPrompt = `Instruction: ${dto.instruction}
Country/jurisdiction: ${dto.countryCode ?? 'US'}
${matterContext}

Document:
"""
${docText}
"""`;

    const result = await this.llm.complete({
      modelName: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 3000,
      temperature: 0.2,
    });

    const amendments = this.parseAmendments(result.content, docText);
    const editOps = amendments.map((a) =>
      this.redlineExport.toEditOp({
        id: a.id,
        sectionRef: a.clauseLabel,
        originalText: a.originalText,
        proposedText: a.proposedText,
        reason: a.rationale,
        riskLevel: 'high',
        category: 'playbook',
        anchorText: a.anchorText,
        changeType: 'replace',
        severity: 'high',
      }),
    );

    return { amendments, editOps };
  }

  private parseAmendments(raw: string, docText: string): DraftAmendment[] {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        clauseLabel?: string;
        originalText?: string;
        proposedText?: string;
        rationale?: string;
      }>;

      return parsed
        .filter((a) => a.originalText && a.proposedText)
        .map((a) => {
          const originalText = a.originalText!.trim();
          const anchorText = docText.includes(originalText)
            ? originalText.slice(0, Math.min(originalText.length, 80))
            : originalText.split(/\s+/).slice(0, 6).join(' ');

          return {
            id: randomUUID(),
            clauseLabel: a.clauseLabel ?? 'Amendment',
            originalText,
            proposedText: a.proposedText!.trim(),
            rationale: a.rationale ?? 'Suggested amendment per instruction.',
            anchorText,
          };
        });
    } catch {
      return [];
    }
  }
}
