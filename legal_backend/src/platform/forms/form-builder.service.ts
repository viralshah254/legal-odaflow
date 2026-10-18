import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { FormSubmission, FormWorkflow } from '@prisma/client';

export interface FormSchemaField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean' | 'file';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  validations?: Array<{ rule: string; value?: unknown; message?: string }>;
  conditions?: Array<{ fieldId: string; operator: string; value: unknown }>;
}

export interface FormSchema {
  fields: FormSchemaField[];
  sections?: Array<{ id: string; title: string; fieldIds: string[] }>;
}

export interface CreateFormDto {
  name: string;
  description?: string;
  schema: FormSchema;
  outputTemplate?: string;
  jurisdiction?: string;
  documentType?: string;
}

@Injectable()
export class FormBuilderService {
  private readonly logger = new Logger(FormBuilderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createForm(tenantId: string | null, dto: CreateFormDto): Promise<FormWorkflow> {
    return this.prisma.formWorkflow.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        schema: dto.schema as any,
        outputTemplate: dto.outputTemplate,
        jurisdiction: dto.jurisdiction,
        documentType: dto.documentType,
        status: 'active',
        version: 1,
      },
    });
  }

  async getForm(id: string, tenantId?: string): Promise<FormWorkflow> {
    const form = await this.prisma.formWorkflow.findFirst({
      where: {
        id,
        status: { not: 'archived' },
        ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}),
      },
    });
    if (!form) {
      throw new NotFoundException(`Form ${id} not found`);
    }
    return form;
  }

  async listForms(
    tenantId?: string,
    filters?: { jurisdiction?: string; documentType?: string; status?: string },
  ): Promise<FormWorkflow[]> {
    return this.prisma.formWorkflow.findMany({
      where: {
        status: filters?.status ?? 'active',
        ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : { tenantId: null }),
        ...(filters?.jurisdiction ? { jurisdiction: filters.jurisdiction } : {}),
        ...(filters?.documentType ? { documentType: filters.documentType } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async startSubmission(
    formId: string,
    tenantId: string,
    userId: string,
    matterId?: string,
  ): Promise<FormSubmission> {
    await this.getForm(formId, tenantId);

    return this.prisma.formSubmission.create({
      data: {
        formId,
        tenantId,
        userId,
        matterId,
        answers: {},
        status: 'in_progress',
      },
    });
  }

  async updateAnswers(
    submissionId: string,
    tenantId: string,
    answers: Record<string, unknown>,
  ): Promise<FormSubmission> {
    const sub = await this.prisma.formSubmission.findFirst({
      where: { id: submissionId, tenantId },
    });
    if (!sub) {
      throw new NotFoundException(`Submission ${submissionId} not found`);
    }
    if (sub.status === 'completed') {
      throw new BadRequestException('Cannot update a completed submission');
    }

    return this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: { answers: { ...(sub.answers as object), ...answers } as any },
    });
  }

  async completeSubmission(submissionId: string, tenantId: string): Promise<FormSubmission & { renderedOutput?: string }> {
    const sub = await this.prisma.formSubmission.findFirst({
      where: { id: submissionId, tenantId },
      include: { form: true },
    });
    if (!sub) {
      throw new NotFoundException(`Submission ${submissionId} not found`);
    }
    if (sub.status === 'completed') {
      throw new BadRequestException('Submission already completed');
    }

    const schema = (sub.form.schema as unknown) as FormSchema;
    const answers = sub.answers as Record<string, unknown>;
    this.validateRequiredFields(schema, answers);

    // Render outputTemplate by substituting {{fieldId}} placeholders with answers
    const outputTemplate = sub.form.outputTemplate as string | null;
    let renderedOutput: string | undefined;

    if (outputTemplate) {
      renderedOutput = this.renderOutputTemplate(outputTemplate, answers, schema);
    }

    const updated = await this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        ...(renderedOutput ? { renderedOutput } : {}),
      },
    });

    return { ...updated, renderedOutput };
  }

  /**
   * Renders an outputTemplate string by substituting {{fieldId}} with answer values.
   * Supports conditional blocks: {{#if fieldId}}...{{/if}}
   */
  private renderOutputTemplate(
    template: string,
    answers: Record<string, unknown>,
    schema: FormSchema,
  ): string {
    let result = template;

    // Build a label map for human-readable substitutions
    const labelMap = Object.fromEntries(schema.fields.map((f) => [f.id, f.label]));

    // Process conditional blocks {{#if fieldId}}content{{/if}}
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, fieldId: string, content: string) => {
        const value = answers[fieldId];
        if (value === undefined || value === null || value === false || value === '') return '';
        return content;
      },
    );

    // Process loops {{#each fieldId}}content{{/each}} for multiselect
    result = result.replace(
      /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_, fieldId: string, content: string) => {
        const value = answers[fieldId];
        if (!Array.isArray(value)) return '';
        return value.map((v) => content.replace(/\{\{item\}\}/g, String(v))).join('\n');
      },
    );

    // Substitute simple field placeholders {{fieldId}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_, fieldId: string) => {
      const value = answers[fieldId];
      if (value === undefined || value === null) return `[${labelMap[fieldId] ?? fieldId}]`;
      if (Array.isArray(value)) return value.join(', ');
      if (value instanceof Date) return value.toLocaleDateString();
      return String(value);
    });

    return result;
  }

  async getSubmission(id: string, tenantId: string): Promise<FormSubmission> {
    const sub = await this.prisma.formSubmission.findFirst({
      where: { id, tenantId },
      include: { form: true },
    });
    if (!sub) {
      throw new NotFoundException(`Submission ${id} not found`);
    }
    return sub;
  }

  async listSubmissions(
    tenantId: string,
    userId?: string,
    matterId?: string,
  ): Promise<FormSubmission[]> {
    return this.prisma.formSubmission.findMany({
      where: {
        tenantId,
        ...(userId ? { userId } : {}),
        ...(matterId ? { matterId } : {}),
      },
      include: { form: { select: { name: true, documentType: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private validateRequiredFields(
    schema: FormSchema,
    answers: Record<string, unknown>,
  ): void {
    const missing: string[] = [];
    for (const field of schema.fields) {
      if (field.required && (answers[field.id] === undefined || answers[field.id] === '')) {
        missing.push(field.label);
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(`Required fields missing: ${missing.join(', ')}`);
    }
  }
}
