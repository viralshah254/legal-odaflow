import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import {
  DEFAULT_ECONOMY_MODEL,
  DEFAULT_AUTO_MODEL,
  DRAFT_ENRICH_MODEL,
  getModelCostSync,
} from '@/ai/model-costs.config';
import {
  estimateTokenCostUsd,
  computeCreditsFromProviderCost,
  DEFAULT_CREDIT_USD_VALUE,
} from '@/ai-credits/credit-pricing.util';
import { buildLocalePromptInstruction } from '@/config/locales';
import { getClauseCatalogForKind } from '@/config/template-clause-rules';
import { getKenyaDraftCatalogEntry } from '@/config/templates/kenya-drafting-catalog';
import {
  CONTRACT_INTAKE_FIELD_IDS,
  extractFieldsHeuristicFromFacts,
  normalizeExtractedFields,
  type PlanQuestionItem,
} from '@/consumers/intake-field-extraction';
import {
  DocumentAutomationService,
  type MergeFieldContext,
} from '@/document-automation/document-automation.service';
import { DocumentDraftService } from '@/document-automation/document-draft.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { PrismaService } from '@/prisma/prisma.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { TemplatesService } from '@/templates/templates.service';
import { ESignService } from '@/esign/esign.service';
import { PortalService } from '@/portal/portal.service';
import { DocumentIngestService } from './document-ingest.service';
import type {
  CreateDraftingSessionDto,
  DraftingSessionEditDto,
  DraftingSessionFinalizeDto,
} from './dto/drafting-session.dto';

function extractTemplateTokens(html: string): string[] {
  const matches = [...html.matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

function isNonEmpty(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'boolean') return true;
  return typeof value === 'string' && value.trim().length > 0;
}

function computeCompletionScore(
  documentKind: string | null | undefined,
  fieldValues: Record<string, unknown>,
): number {
  const catalog = getClauseCatalogForKind(documentKind ?? 'service_agreement');
  const mandatory = catalog.filter((c) => c.mandatory).length;
  const filledMandatory = catalog
    .filter((c) => c.mandatory)
    .filter((c) => {
      const key = c.title.replace(/\W+/g, '').toLowerCase();
      return Object.entries(fieldValues).some(
        ([k, v]) => k.toLowerCase().includes(key.slice(0, 8)) && isNonEmpty(v),
      );
    }).length;

  const tokenIds = CONTRACT_INTAKE_FIELD_IDS as readonly string[];
  const filledTokens = tokenIds.filter((id) => isNonEmpty(fieldValues[id])).length;
  const tokenScore = tokenIds.length ? filledTokens / tokenIds.length : 0;
  const clauseScore = mandatory ? filledMandatory / mandatory : 0.5;
  return Math.round((tokenScore * 0.6 + clauseScore * 0.4) * 100);
}

@Injectable()
export class DraftingSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly documentAutomation: DocumentAutomationService,
    private readonly documentDraft: DocumentDraftService,
    private readonly aiGateway: AiGatewayService,
    private readonly llm: LlmCompletionService,
    private readonly ingest: DocumentIngestService,
    private readonly config: ConfigService,
    private readonly s3Upload: S3UploadService,
    private readonly esign: ESignService,
    private readonly portal: PortalService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly usageRecorder: AiUsageRecorderService,
  ) {}

  private uploadRoot(): string {
    return this.config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  }

  private async persistBytes(
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<string> {
    const provider = this.config.get<string>('S3_PROVIDER', 'local');
    if (provider === 'local') {
      const target = join(this.uploadRoot(), key);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buffer);
      const apiUrl = this.config.get<string>('API_URL', 'http://localhost:4000').replace(/\/$/, '');
      const cdnUrl = this.config.get<string>('S3_PUBLIC_CDN_URL', '').trim();
      return `${cdnUrl || `${apiUrl}/uploads`}/${key}`;
    }
    if (!this.s3Upload.isConfigured()) {
      throw new BadRequestException('Cloud storage is not configured for uploads');
    }
    return this.s3Upload.putObject(key, buffer, mimeType);
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateDraftingSessionDto,
    locale?: string,
  ) {
    let templateId = dto.templateId;
    const kenyaEntry =
      dto.countryCode === 'KE' ? getKenyaDraftCatalogEntry(dto.documentKind) : undefined;
    if (dto.systemTemplateId) {
      templateId = await this.templates.resolveSystemTemplateId(tenantId, dto.systemTemplateId);
    }
    if (!templateId && dto.countryCode === 'KE' && dto.documentKind) {
      if (kenyaEntry) {
        const tenantTemplate = await this.prisma.documentTemplate.findFirst({
          where: {
            tenantId,
            countryCode: 'KE',
            documentKind: kenyaEntry.documentKind,
            isActive: true,
          },
          select: { id: true },
          orderBy: { updatedAt: 'desc' },
        });
        templateId = tenantTemplate?.id;

        if (!templateId) {
          const systemTemplate = await this.prisma.systemDocumentTemplate.findFirst({
            where: {
              countryCode: 'KE',
              documentKind: kenyaEntry.documentKind,
              isActive: true,
            },
            select: { id: true },
            orderBy: { sortOrder: 'asc' },
          });
          if (systemTemplate) {
            templateId = await this.templates.resolveSystemTemplateId(tenantId, systemTemplate.id);
          }
        }
      }
    }
    if (!templateId) {
      throw new BadRequestException('templateId or systemTemplateId is required');
    }

    const sourceTemplate = await this.templates.findOne(tenantId, templateId);
    const forked = await this.templates.forkTemplateForSession(tenantId, templateId, userId);
    const documentKind = dto.documentKind ?? sourceTemplate.documentKind ?? 'service_agreement';

    let fieldValues: Record<string, string> = Object.fromEntries(
      (kenyaEntry?.requiredAuthorityFields ?? [])
        .filter((field) => field.required)
        .map((field) => [field.id, '']),
    );
    let unresolvedQuestions: PlanQuestionItem[] = [];

    if (dto.sourceQuery?.trim()) {
      const extracted = await this.extractFieldValues(
        dto.sourceQuery,
        documentKind,
        forked.content,
        locale,
      );
      fieldValues = { ...fieldValues, ...extracted.fieldValues };
      unresolvedQuestions = extracted.unresolvedQuestions;
    }

    const session = await this.prisma.draftingSession.create({
      data: {
        tenantId,
        userId,
        mode: 'template',
        templateId,
        forkedTemplateId: forked.id,
        documentKind,
        countryCode: dto.countryCode ?? sourceTemplate.countryCode ?? undefined,
        sourceQuery: dto.sourceQuery,
        fieldValues: fieldValues as Prisma.InputJsonValue,
        unresolvedQuestions: unresolvedQuestions as unknown as Prisma.InputJsonValue,
        completionScore: computeCompletionScore(documentKind, fieldValues),
      },
    });

    return this.toResponse(session, sourceTemplate.name);
  }

  async get(tenantId: string, sessionId: string) {
    const session = await this.loadSession(tenantId, sessionId);
    const templateName = session.forkedTemplateId
      ? (
          await this.prisma.documentTemplate.findFirst({
            where: { id: session.forkedTemplateId, tenantId },
            select: { name: true, content: true },
          })
        )?.name
      : session.sourceFileName;
    return this.toResponse(session, templateName ?? 'Document');
  }

  async updateFields(
    tenantId: string,
    sessionId: string,
    fieldValues: Record<string, string | boolean>,
    clauseAnswers?: Record<string, string | boolean>,
  ) {
    const session = await this.loadSession(tenantId, sessionId);
    const merged = {
      ...((session.fieldValues as Record<string, string>) ?? {}),
      ...fieldValues,
    };
    const updated = await this.prisma.draftingSession.update({
      where: { id: sessionId },
      data: {
        fieldValues: merged as Prisma.InputJsonValue,
        clauseAnswers: clauseAnswers
          ? ({ ...((session.clauseAnswers as Record<string, unknown>) ?? {}), ...clauseAnswers } as Prisma.InputJsonValue)
          : undefined,
        completionScore: computeCompletionScore(session.documentKind, merged),
      },
    });
    return this.toResponse(updated);
  }

  async extract(
    tenantId: string,
    sessionId: string,
    text: string | undefined,
    locale?: string,
  ) {
    const session = await this.loadSession(tenantId, sessionId);
    const sourceText = text?.trim() || session.sourceQuery?.trim() || '';
    if (!sourceText) {
      throw new BadRequestException('No text provided for extraction');
    }

    const debit = await this.creditLedger.assertAndDebit({
      tenantId,
      taskType: AI_TASK_TYPES.DRAFT_EXTRACT_FIELDS,
    });

    await this.usageRecorder.recordAfterFlatDebit({
      tenantId,
      taskType: AI_TASK_TYPES.DRAFT_EXTRACT_FIELDS,
      mode: 'AUTO',
      modelName: this.config.get<string>('AI_CHEAP_MODEL', 'gpt-5.4-mini'),
      credits: debit.creditsDebited,
    });

    const template = session.forkedTemplateId
      ? await this.prisma.documentTemplate.findFirst({
          where: { id: session.forkedTemplateId, tenantId },
        })
      : null;

    const result = await this.extractFieldValues(
      sourceText,
      session.documentKind ?? 'service_agreement',
      template?.content ?? session.workingHtml ?? '',
      locale,
    );

    const merged = {
      ...((session.fieldValues as Record<string, string>) ?? {}),
      ...result.fieldValues,
    };

    const updated = await this.prisma.draftingSession.update({
      where: { id: sessionId },
      data: {
        fieldValues: merged as Prisma.InputJsonValue,
        unresolvedQuestions: result.unresolvedQuestions as unknown as Prisma.InputJsonValue,
        completionScore: computeCompletionScore(session.documentKind, merged),
      },
    });

    return {
      ...this.toResponse(updated),
      extractedFields: result.fieldValues,
      unresolvedQuestions: result.unresolvedQuestions,
    };
  }

  async assemble(tenantId: string, sessionId: string) {
    const session = await this.loadSession(tenantId, sessionId);
    if (!session.forkedTemplateId) {
      throw new BadRequestException('Template session required for assemble');
    }

    const fieldValues = (session.fieldValues ?? {}) as Record<string, string>;
    const clauseAnswers = (session.clauseAnswers ?? {}) as Record<string, string | boolean>;
    const context = this.buildMergeContext(fieldValues);

    const assembled = await this.documentAutomation.assembleFromQuestionnaire(
      tenantId,
      session.forkedTemplateId,
      clauseAnswers,
      context,
    );

    const updated = await this.prisma.draftingSession.update({
      where: { id: sessionId },
      data: {
        workingHtml: assembled.body,
        status: 'ASSEMBLED',
      },
    });

    return {
      ...this.toResponse(updated),
      assembled,
    };
  }

  async generate(
    tenantId: string,
    userId: string,
    sessionId: string,
    locale?: string,
    knowledgeSources?: string[],
  ) {
    const session = await this.loadSession(tenantId, sessionId);
    if (!session.forkedTemplateId) {
      throw new BadRequestException('Template session required for generate');
    }

    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: session.forkedTemplateId, tenantId },
    });
    if (!template) throw new NotFoundException('Forked template not found');

    const fieldValues = (session.fieldValues ?? {}) as Record<string, string>;
    const context = this.buildMergeContext(fieldValues);

    const assembled = await this.documentAutomation.assembleFromQuestionnaire(
      tenantId,
      session.forkedTemplateId,
      (session.clauseAnswers ?? {}) as Record<string, string | boolean>,
      context,
    );

    const aiResult = await this.aiGateway.runTemplateDraft({
      tenantId,
      userId,
      matterId: sessionId,
      templateId: session.forkedTemplateId,
      templateHtml: template.content,
      templateName: template.name,
      mergedHtml: assembled.body,
      locale,
      templateMeta: {
        documentKind: session.documentKind ?? template.documentKind ?? undefined,
        countryCode: session.countryCode ?? template.countryCode ?? undefined,
        jurisdiction: template.jurisdiction ?? undefined,
        practiceArea: template.practiceArea ?? undefined,
      },
      matterContext: {
        ...context,
        documentType: session.documentKind ?? template.documentKind ?? template.name,
        selectedTemplateKind: session.documentKind ?? undefined,
        practiceArea: 'Contract & Document Drafting',
        countryCode: session.countryCode ?? template.countryCode ?? undefined,
        factsSummary: session.sourceQuery ?? undefined,
      },
      knowledgeSources,
    });

    const updated = await this.prisma.draftingSession.update({
      where: { id: sessionId },
      data: {
        workingHtml: aiResult.draftHtml,
        status: 'ASSEMBLED',
      },
    });

    return {
      ...this.toResponse(updated),
      draftHtml: aiResult.draftHtml,
      disclaimer: aiResult.disclaimer,
      verification: aiResult.verification,
    };
  }

  async finalize(
    tenantId: string,
    userId: string,
    sessionId: string,
    dto: DraftingSessionFinalizeDto,
  ) {
    const session = await this.loadSession(tenantId, sessionId);
    const html = session.workingHtml;
    if (!html?.trim()) {
      throw new BadRequestException('No document content to save. Assemble or generate first.');
    }

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId },
      });
      if (!client) throw new NotFoundException('Client not found');
    }
    if (dto.matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: { id: dto.matterId, tenantId },
      });
      if (!matter) throw new NotFoundException('Matter not found');
    }

    const baseName =
      dto.fileName?.trim() ||
      session.sourceFileName?.replace(/\.[^.]+$/, '') ||
      `Draft-${session.documentKind ?? 'document'}`;

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const htmlKey = `${tenantId}/drafting-sessions/${datePrefix}/${sessionId}-${randomUUID()}.html`;
    const htmlUrl = await this.persistBytes(htmlKey, Buffer.from(html, 'utf8'), 'text/html');

    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          tenantId,
          matterId: dto.matterId,
          clientId: dto.clientId,
          fileName: `${baseName}.html`,
          fileUrl: htmlUrl,
          mimeType: 'text/html',
          htmlContent: html,
          uploadedById: userId,
          generatedFromTemplateId: session.forkedTemplateId ?? session.templateId ?? undefined,
          aiDraftStatus: 'FINALIZED',
        },
      });
      await tx.documentVersion.create({
        data: {
          tenantId,
          documentId: created.id,
          version: 1,
          fileName: `${baseName}.html`,
          fileUrl: htmlUrl,
          uploadedById: userId,
        },
      });
      return created;
    });

    const actions = dto.actions ?? ['save'];
    const result: Record<string, unknown> = {
      documentId: document.id,
      fileUrl: htmlUrl,
      fileName: document.fileName,
    };

    if (actions.includes('export_docx') || actions.includes('export_pdf')) {
      if (dto.matterId) {
        await this.prisma.document.update({
          where: { id: document.id },
          data: { matterId: dto.matterId },
        });
        if (actions.includes('export_docx')) {
          const docx = await this.documentDraft.exportDocx(tenantId, document.id);
          result.docxUrl = docx.url;
        }
        if (actions.includes('export_pdf')) {
          const pdf = await this.documentDraft.exportPdf(tenantId, document.id);
          result.pdfUrl = pdf.url;
        }
      }
    }

    if (actions.includes('sign') && dto.signers?.length) {
      const envelope = await this.esign.sendForSignature(tenantId, userId, {
        matterId: dto.matterId,
        documentId: document.id,
        documentUrl: htmlUrl,
        documentName: baseName,
        signers: dto.signers,
        subject: `Please sign: ${baseName}`,
      });
      result.envelopeId = envelope.id;
    }

    if (actions.includes('review') && dto.matterId && dto.clientId) {
      const shared = await this.portal.shareDocumentWithClient(tenantId, userId, {
        matterId: dto.matterId,
        clientId: dto.clientId,
        documentName: baseName,
        documentUrl: htmlUrl,
        message: dto.reviewMessage,
      });
      result.reviewMessageId = shared.messageId;
    }

    await this.prisma.draftingSession.update({
      where: { id: sessionId },
      data: {
        status: 'FINALIZED',
        documentId: document.id,
        clientId: dto.clientId,
        matterId: dto.matterId,
      },
    });

    return result;
  }

  async importDocument(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const ingested = await this.ingest.ingestBuffer(
      file.buffer,
      file.mimetype ?? '',
      file.originalname ?? 'document',
    );

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const originalKey = `${tenantId}/drafting-sessions/${datePrefix}/${randomUUID()}-${file.originalname}`;
    const originalUrl = await this.persistBytes(originalKey, file.buffer, ingested.mimeType);

    const sourceDoc = await this.prisma.document.create({
      data: {
        tenantId,
        fileName: file.originalname,
        fileUrl: originalUrl,
        mimeType: ingested.mimeType,
        extractedText: ingested.plainText,
        htmlContent: ingested.html,
        uploadedById: userId,
      },
    });

    const session = await this.prisma.draftingSession.create({
      data: {
        tenantId,
        userId,
        mode: 'import',
        workingHtml: ingested.html,
        sourceDocumentId: sourceDoc.id,
        sourceFileName: file.originalname,
        sourceMimeType: ingested.mimeType,
        sourceFormat: ingested.sourceFormat,
        extractionStatus: 'completed',
        status: 'DRAFT',
      },
    });

    return this.toResponse(session, file.originalname);
  }

  async analyze(tenantId: string, sessionId: string, locale?: string) {
    const session = await this.loadSession(tenantId, sessionId);
    const text = session.workingHtml ?? '';
    if (!text.trim()) {
      throw new BadRequestException('No content to analyze');
    }

    const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const result = await this.aiGateway.runPlanQuestions({
      countryCode: session.countryCode ?? 'IN',
      facts: plainText.slice(0, 8000),
      issueType: 'Contract & Document Drafting',
      mode: 'FIRM_INTAKE',
      locale,
    });

    const documentKind =
      (typeof result.extractedFields.documentType === 'string'
        ? result.extractedFields.documentType
        : null) ?? session.documentKind ?? 'service_agreement';

    const fieldValues = {
      ...((session.fieldValues as Record<string, string>) ?? {}),
      ...Object.fromEntries(
        Object.entries(result.extractedFields).filter(
          ([, v]) => typeof v === 'string' && v.trim(),
        ),
      ),
    };

    const updated = await this.prisma.draftingSession.update({
      where: { id: sessionId },
      data: {
        documentKind,
        fieldValues: fieldValues as Prisma.InputJsonValue,
        unresolvedQuestions: result.questions as unknown as Prisma.InputJsonValue,
        completionScore: computeCompletionScore(documentKind, fieldValues),
      },
    });

    return {
      ...this.toResponse(updated),
      extractedFields: result.extractedFields,
      unresolvedQuestions: result.questions,
    };
  }

  async edit(
    tenantId: string,
    sessionId: string,
    dto: DraftingSessionEditDto,
    locale?: string,
  ) {
    const session = await this.loadSession(tenantId, sessionId);
    const html = session.workingHtml ?? '';
    if (!html.trim()) throw new BadRequestException('No content to edit');

    const markupPercent = this.config.get<number>('AI_DOCUMENT_EDIT_MARKUP_PERCENT', 100);
    const markupMultiplier = 1 + markupPercent / 100; // 2.0 for 100%

    if (dto.selectedText?.trim()) {
      const revised = await this.editSelection(
        dto.selectedText,
        dto.instruction,
        dto.context,
        session.documentKind ?? undefined,
        locale,
      );

      const updatedHtml = html.includes(dto.selectedText)
        ? html.replace(dto.selectedText, revised.revisedText)
        : html;

      if (session.documentId) {
        await this.snapshotVersion(tenantId, session.documentId, html, session.userId);
      }

      const updated = await this.prisma.draftingSession.update({
        where: { id: sessionId },
        data: { workingHtml: updatedHtml },
      });

      const chargedCredits = this.computeEditCreditsWithMarkup(
        revised.modelName,
        revised.inputTokens,
        revised.outputTokens,
        markupMultiplier,
        1,
      );
      await this.creditLedger.assertAndDebit({
        tenantId,
        userId: session.userId,
        taskType: AI_TASK_TYPES.DRAFT_SELECTION_EDIT,
        credits: chargedCredits,
        metadata: {
          sessionId,
          modelName: revised.modelName,
          inputTokens: revised.inputTokens,
          outputTokens: revised.outputTokens,
          markupMultiplier,
        },
      });
      void this.usageRecorder.recordAfterFlatDebit({
        tenantId,
        userId: session.userId,
        taskType: AI_TASK_TYPES.DRAFT_SELECTION_EDIT,
        mode: 'AUTO',
        modelName: revised.modelName,
        credits: chargedCredits,
        inputTokens: revised.inputTokens,
        outputTokens: revised.outputTokens,
      });

      return { ...this.toResponse(updated), ...revised, creditsUsed: chargedCredits };
    }

    const revised = await this.editBulk(html, dto.instruction, session.documentKind ?? undefined, locale);

    if (session.documentId) {
      await this.snapshotVersion(tenantId, session.documentId, html, session.userId);
    }

    const updated = await this.prisma.draftingSession.update({
      where: { id: sessionId },
      data: { workingHtml: revised.html },
    });

    const chargedCredits = this.computeEditCreditsWithMarkup(
      revised.modelName,
      revised.inputTokens,
      revised.outputTokens,
      markupMultiplier,
      2,
    );
    await this.creditLedger.assertAndDebit({
      tenantId,
      userId: session.userId,
      taskType: AI_TASK_TYPES.DRAFT_BULK_EDIT,
      credits: chargedCredits,
      metadata: {
        sessionId,
        modelName: revised.modelName,
        inputTokens: revised.inputTokens,
        outputTokens: revised.outputTokens,
        markupMultiplier,
      },
    });
    void this.usageRecorder.recordAfterFlatDebit({
      tenantId,
      userId: session.userId,
      taskType: AI_TASK_TYPES.DRAFT_BULK_EDIT,
      mode: 'AUTO',
      modelName: revised.modelName,
      credits: chargedCredits,
      inputTokens: revised.inputTokens,
      outputTokens: revised.outputTokens,
    });

    return { ...this.toResponse(updated), explanation: revised.explanation, creditsUsed: chargedCredits };
  }

  async exportSession(
    tenantId: string,
    sessionId: string,
    format: 'docx' | 'pdf',
  ) {
    const session = await this.loadSession(tenantId, sessionId);
    const html = session.workingHtml;
    if (!html?.trim()) throw new BadRequestException('No content to export');

    const buffer =
      format === 'docx'
        ? await this.htmlToDocxBuffer(html)
        : await this.htmlToPdfBuffer(html);

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const ext = format;
    const key = `${tenantId}/drafting-sessions/${datePrefix}/${sessionId}-export.${ext}`;
    const mime =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const url = await this.persistBytes(key, buffer, mime);

    return { url, format, fileName: `${session.sourceFileName ?? 'document'}.${ext}` };
  }

  private async extractFieldValues(
    text: string,
    documentKind: string,
    templateContent: string,
    locale?: string,
  ) {
    const tokens = extractTemplateTokens(templateContent);
    const plan = await this.aiGateway.runPlanQuestions({
      countryCode: 'IN',
      facts: text,
      issueType: 'Contract & Document Drafting',
      mode: 'FIRM_INTAKE',
      locale,
    });

    const heuristic = extractFieldsHeuristicFromFacts(text);
    const normalized = normalizeExtractedFields({
      ...heuristic,
      ...plan.extractedFields,
      documentType: documentKind,
    });

    const fieldValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(normalized)) {
      if (typeof value === 'string') fieldValues[key] = value;
      else if (Array.isArray(value)) fieldValues[key] = value.join(', ');
    }

    for (const token of tokens) {
      if (fieldValues[token]) continue;
    }

    const unresolvedQuestions = plan.questions.filter(
      (q) => !isNonEmpty(fieldValues[q.id]),
    );

    return { fieldValues, unresolvedQuestions };
  }

  private buildMergeContext(fieldValues: Record<string, string>): MergeFieldContext {
    const today = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return {
      ...fieldValues,
      today,
      servicesDescription: fieldValues.scopeOfWork ?? fieldValues.servicesDescription,
      contractEndDate: fieldValues.contractDuration,
    };
  }

  private resolveEditModel(instructionLength: number, htmlLength = 0): string {
    // Selection edit with a short instruction → ultra-cheap (DeepSeek)
    if (htmlLength === 0 && instructionLength < 120) {
      return this.config.get<string>('AI_CHEAP_MODEL', DEFAULT_ECONOMY_MODEL);
    }
    // Bulk edit on a small document → GPT-5.4-mini
    if (htmlLength < 6_000) {
      return this.config.get<string>('AI_FAST_MODEL', DEFAULT_AUTO_MODEL);
    }
    // Bulk edit on a larger document → mid-tier model (AI_MID_MODEL, default Terra)
    return this.config.get<string>('AI_MID_MODEL', DRAFT_ENRICH_MODEL);
  }

  private computeEditCreditsWithMarkup(
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    markupMultiplier: number,
    minCredits: number,
  ): number {
    const costs = getModelCostSync(modelName);
    const providerCostUsd = estimateTokenCostUsd(
      costs.inputPer1M,
      costs.outputPer1M,
      inputTokens,
      outputTokens,
    );
    const baseCredits = computeCreditsFromProviderCost(providerCostUsd, DEFAULT_CREDIT_USD_VALUE, 0, minCredits);
    return baseCredits; // Shared usage pricing already applies the 2× markup.
  }

  private async editSelection(
    selectedText: string,
    instruction: string,
    context: string | undefined,
    documentKind: string | undefined,
    locale?: string,
  ) {
    const localeInstruction = buildLocalePromptInstruction(locale);
    const modelName = this.resolveEditModel(instruction.length, 0);
    const systemPrompt = [
      'You edit a passage in a legal document. Return ONLY the revised passage, then a line EXPLANATION: with a brief note.',
      localeInstruction,
    ]
      .filter(Boolean)
      .join(' ');

    const userPrompt = `Document kind: ${documentKind ?? 'agreement'}
Instruction: ${instruction}
${context ? `Context:\n${context}\n` : ''}
Selected passage:
"${selectedText}"`;

    const result = await this.llm.complete({
      modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1200,
      temperature: 0.3,
    });

    const parts = result.content.split(/\nEXPLANATION:/i);
    return {
      revisedText: (parts[0] ?? result.content).trim(),
      explanation: parts[1]?.trim() ?? 'Text revised as requested.',
      modelName: result.modelName,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  }

  private async editBulk(
    html: string,
    instruction: string,
    documentKind: string | undefined,
    locale?: string,
  ) {
    const modelName = this.resolveEditModel(instruction.length, html.length);
    const localeInstruction = buildLocalePromptInstruction(locale);
    const result = await this.llm.complete({
      modelName,
      messages: [
        {
          role: 'system',
          content: [
            'Apply the user instruction to the HTML document. Return JSON: {"html":"...", "explanation":"..."}',
            'Preserve structure; change only what the instruction requires.',
            localeInstruction,
          ]
            .filter(Boolean)
            .join(' '),
        },
        {
          role: 'user',
          content: `Document kind: ${documentKind ?? 'agreement'}\nInstruction: ${instruction}\n\nHTML:\n${html.slice(0, 12000)}`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(result.content) as { html?: string; explanation?: string };
      if (parsed.html?.trim()) {
        return {
          html: parsed.html,
          explanation: parsed.explanation ?? 'Document updated.',
          modelName: result.modelName,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        };
      }
    } catch {
      // fall through
    }

    return {
      html,
      explanation: 'Could not apply edit automatically.',
      modelName: result.modelName,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  }

  private async snapshotVersion(
    tenantId: string,
    documentId: string,
    html: string,
    userId: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) return;

    const nextVersion = doc.version + 1;
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const key = `${tenantId}/drafting-sessions/${datePrefix}/${documentId}-v${nextVersion}.html`;
    const fileUrl = await this.persistBytes(key, Buffer.from(html, 'utf8'), 'text/html');

    await this.prisma.$transaction([
      this.prisma.documentVersion.create({
        data: {
          tenantId,
          documentId,
          version: nextVersion,
          fileName: doc.fileName,
          fileUrl,
          uploadedById: userId,
        },
      }),
      this.prisma.document.update({
        where: { id: documentId },
        data: { version: nextVersion },
      }),
    ]);
  }

  private async htmlToDocxBuffer(html: string): Promise<Buffer> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const htmlToDocx = require('html-to-docx') as (
        content: string,
        header?: string,
        opts?: Record<string, unknown>,
        footer?: string,
      ) => Promise<Buffer>;
      return htmlToDocx(html, undefined, { table: { row: { cantSplit: true } } });
    } catch {
      return Buffer.from(html, 'utf8');
    }
  }

  private async htmlToPdfBuffer(html: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer-core') as typeof import('puppeteer-core');
    const configured = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH')?.trim();
    const browser = await puppeteer.launch({
      executablePath: configured || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(`<!DOCTYPE html><html><body>${html}</body></html>`, {
        waitUntil: 'load',
      });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async loadSession(tenantId: string, sessionId: string) {
    const session = await this.prisma.draftingSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Drafting session not found');
    return session;
  }

  private toResponse(
    session: {
      id: string;
      mode: string;
      status: string;
      templateId: string | null;
      forkedTemplateId: string | null;
      documentKind: string | null;
      countryCode: string | null;
      sourceQuery: string | null;
      fieldValues: unknown;
      clauseAnswers: unknown;
      workingHtml: string | null;
      unresolvedQuestions: unknown;
      sourceDocumentId: string | null;
      sourceFileName: string | null;
      sourceFormat: string | null;
      extractionStatus: string | null;
      documentId: string | null;
      clientId: string | null;
      matterId: string | null;
      completionScore: number | null;
      createdAt: Date;
      updatedAt: Date;
    },
    templateName?: string,
  ) {
    const fieldValues = (session.fieldValues ?? {}) as Record<string, string>;
    const clauseCatalog = getClauseCatalogForKind(session.documentKind ?? 'service_agreement');
    const kenyaMetadata =
      session.countryCode === 'KE'
        ? getKenyaDraftCatalogEntry(session.documentKind)
        : undefined;

    return {
      id: session.id,
      mode: session.mode,
      status: session.status,
      templateId: session.templateId,
      forkedTemplateId: session.forkedTemplateId,
      templateName,
      documentKind: session.documentKind,
      countryCode: session.countryCode,
      sourceQuery: session.sourceQuery,
      fieldValues,
      clauseAnswers: (session.clauseAnswers ?? {}) as Record<string, string | boolean>,
      workingHtml: session.workingHtml,
      unresolvedQuestions: (session.unresolvedQuestions ?? []) as PlanQuestionItem[],
      sourceDocumentId: session.sourceDocumentId,
      sourceFileName: session.sourceFileName,
      sourceFormat: session.sourceFormat,
      extractionStatus: session.extractionStatus,
      documentId: session.documentId,
      clientId: session.clientId,
      matterId: session.matterId,
      completionScore: session.completionScore ?? computeCompletionScore(session.documentKind, fieldValues),
      clauseCatalog,
      jurisdictionMetadata:
        session.countryCode === 'KE'
          ? {
              countryCode: 'KE',
              jurisdiction: 'Kenya',
              advocateReviewStatus: kenyaMetadata?.advocateReview.status ?? 'pending',
              advocateReviewed: kenyaMetadata?.advocateReview.status === 'reviewed',
              reviewedBy: kenyaMetadata?.advocateReview.reviewedBy,
              reviewedAt: kenyaMetadata?.advocateReview.reviewedAt,
              authorityVerificationRequired: true,
              filingRequirementsVerificationRequired: true,
              requiredAuthorityFields: kenyaMetadata?.requiredAuthorityFields ?? [],
            }
          : undefined,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }
}
