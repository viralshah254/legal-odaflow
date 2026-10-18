import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { resolveRequestLocale } from '@/config/locales';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CitationVerificationService } from '@/ai/citations/citation-verification.service';
import { getClauseRulesForKind } from '@/config/template-clause-rules';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '@/users/users.service';
import { CreateQuestionnaireDto, UpdateQuestionnaireDto } from './dto/questionnaire.dto';
import { DocumentAutomationService, type MergeFieldContext } from './document-automation.service';
import { DocumentDraftService } from './document-draft.service';

@Controller('document-automation')
@UseGuards(TenantGuard)
export class DocumentAutomationController {
  constructor(
    private readonly documentAutomation: DocumentAutomationService,
    private readonly documentDraft: DocumentDraftService,
    private readonly citationVerification: CitationVerificationService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Post('matters/:matterId/templates/:templateId/generate')
  generateFromTemplate(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.documentAutomation.generateFromTemplate(tenantId, matterId, templateId);
  }

  @Post('templates/:templateId/assemble')
  assemble(
    @TenantId() tenantId: string,
    @Param('templateId') templateId: string,
    @Body() body: { answers: Record<string, string | boolean>; context?: MergeFieldContext },
  ) {
    return this.documentAutomation.assembleFromQuestionnaire(
      tenantId,
      templateId,
      body.answers,
      body.context ?? {},
    );
  }

  @Get('questionnaires')
  listQuestionnaires(@TenantId() tenantId: string, @Query('isActive') isActive?: string) {
    return this.documentAutomation.listQuestionnaires(tenantId, isActive);
  }

  @Post('questionnaires')
  createQuestionnaire(@TenantId() tenantId: string, @Body() dto: CreateQuestionnaireDto) {
    return this.documentAutomation.createQuestionnaire(tenantId, dto);
  }

  @Get('questionnaires/:questionnaireId')
  getQuestionnaire(
    @TenantId() tenantId: string,
    @Param('questionnaireId') questionnaireId: string,
  ) {
    return this.documentAutomation.findQuestionnaire(tenantId, questionnaireId);
  }

  @Patch('questionnaires/:questionnaireId')
  updateQuestionnaire(
    @TenantId() tenantId: string,
    @Param('questionnaireId') questionnaireId: string,
    @Body() dto: UpdateQuestionnaireDto,
  ) {
    return this.documentAutomation.updateQuestionnaire(tenantId, questionnaireId, dto);
  }

  @Delete('questionnaires/:questionnaireId')
  removeQuestionnaire(
    @TenantId() tenantId: string,
    @Param('questionnaireId') questionnaireId: string,
  ) {
    return this.documentAutomation.removeQuestionnaire(tenantId, questionnaireId);
  }

  // ─── AI Template Draft (golden path) ─────────────────────────────

  /** POST /document-automation/matters/:matterId/templates/:templateId/draft-with-ai */
  @Post('matters/:matterId/templates/:templateId/draft-with-ai')
  async draftWithAi(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Param('templateId') templateId: string,
    @Headers('accept-language') acceptLanguage?: string,
    @Body() body?: { mergeFieldOverrides?: Record<string, string>; knowledgeSources?: string[] },
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.documentDraft.draftWithAi(
      tenantId,
      user.id,
      matterId,
      templateId,
      resolveRequestLocale(acceptLanguage, preferredLocale),
      body?.mergeFieldOverrides,
      body?.knowledgeSources,
    );
  }

  /** GET /document-automation/matters/:matterId/documents */
  @Get('matters/:matterId/documents')
  listMatterDocuments(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.documentDraft.listMatterDocuments(tenantId, matterId);
  }

  /** GET /document-automation/documents/:documentId */
  @Get('documents/:documentId')
  getDraft(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentDraft.getDraft(tenantId, documentId);
  }

  /** PATCH /document-automation/documents/:documentId — save edited HTML */
  @Patch('documents/:documentId')
  updateDraft(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @Body() body: { htmlContent: string },
  ) {
    return this.documentDraft.updateDraftHtml(tenantId, documentId, body.htmlContent);
  }

  /** POST /document-automation/documents/:documentId/export/docx */
  @Post('documents/:documentId/export/docx')
  exportDocx(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentDraft.exportDocx(tenantId, documentId);
  }

  /** POST /document-automation/documents/:documentId/export/pdf */
  @Post('documents/:documentId/export/pdf')
  exportPdf(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentDraft.exportPdf(tenantId, documentId);
  }

  /** GET /document-automation/documents/:documentId/export/:format/download */
  @Get('documents/:documentId/export/:format/download')
  async downloadExport(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @Param('format') format: string,
    @Res() res: Response,
  ) {
    const fmt = format.toLowerCase();
    if (fmt !== 'pdf' && fmt !== 'docx') {
      res.status(400).json({ message: 'format must be pdf or docx' });
      return;
    }
    const file = await this.documentDraft.readExportFile(tenantId, documentId, fmt);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/"/g, '')}"`);
    res.send(file.buffer);
  }

  /** POST /document-automation/playbook-review */
  @Post('playbook-review')
  playbookReview(
    @Body() body: { text: string; documentKind: string },
  ) {
    const rules = getClauseRulesForKind(body.documentKind ?? 'memo');
    const textLower = (body.text ?? '').toLowerCase();
    const findings = rules.map((clause) => {
      const tokens = clause
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 3);
      const matched = tokens.some((token) => textLower.includes(token));
      return {
        clause,
        status: matched ? 'present' : 'missing',
        severity: matched ? 'ok' : 'warning',
      };
    });
    const missing = findings.filter((f) => f.status === 'missing');
    return {
      documentKind: body.documentKind,
      totalClauses: rules.length,
      missingCount: missing.length,
      passed: missing.length === 0,
      findings,
    };
  }

  /** POST /document-automation/documents/:documentId/citation-check */
  @Post('documents/:documentId/citation-check')
  async citationCheck(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true, htmlContent: true },
    });
    if (!doc?.htmlContent) {
      return { verified: false, warnings: ['No HTML content found'], citations: [], unverifiableCitations: [] };
    }
    return this.citationVerification.verifyDocumentDraftCitations({
      documentId: doc.id,
      tenantId,
      htmlContent: doc.htmlContent,
    });
  }
}
