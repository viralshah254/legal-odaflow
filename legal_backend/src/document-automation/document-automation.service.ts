import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface MergeFieldContext {
  clientName?: string;
  matterTitle?: string;
  caseNumber?: string;
  today?: string;
  [key: string]: string | undefined;
}

export interface AssembledDocument {
  title: string;
  body: string;
  appliedClauses: string[];
  skippedClauses: string[];
}

@Injectable()
export class DocumentAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async assembleFromQuestionnaire(
    tenantId: string,
    templateId: string,
    answers: Record<string, string | boolean>,
    context: MergeFieldContext,
  ): Promise<AssembledDocument> {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const bodyTemplate = template.content ?? '';
    const clauses = this.parseConditionalClauses(bodyTemplate);
    const applied: string[] = [];
    const skipped: string[] = [];
    let body = bodyTemplate;

    for (const clause of clauses) {
      const shouldInclude = this.evaluateCondition(clause.condition, answers);
      if (shouldInclude) {
        body = body.replace(clause.marker, clause.content);
        applied.push(clause.id);
      } else {
        body = body.replace(clause.marker, '');
        skipped.push(clause.id);
      }
    }

    body = this.applyMergeFields(body, context);

    return {
      title: template.name,
      body,
      appliedClauses: applied,
      skippedClauses: skipped,
    };
  }

  private applyMergeFields(text: string, context: MergeFieldContext): string {
    const merged: Record<string, string> = {
      today: new Date().toISOString().slice(0, 10),
    };
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) merged[key] = value;
    }
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => merged[key] ?? '');
  }

  private parseConditionalClauses(body: string) {
    const regex = /\[\[if:([^\]]+)\]\]([\s\S]*?)\[\[\/if\]\]/g;
    const clauses: Array<{ id: string; marker: string; condition: string; content: string }> = [];
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = regex.exec(body)) !== null) {
      clauses.push({
        id: `clause_${index++}`,
        marker: match[0],
        condition: match[1].trim(),
        content: match[2].trim(),
      });
    }
    return clauses;
  }

  private evaluateCondition(condition: string, answers: Record<string, string | boolean>) {
    const [key, op, raw] = condition.split(/\s+/);
    const value = answers[key];
    if (op === '==' || !op) {
      return String(value) === raw;
    }
    if (op === '!=') {
      return String(value) !== raw;
    }
    if (op === 'truthy') {
      return Boolean(value);
    }
    return Boolean(value);
  }
}
