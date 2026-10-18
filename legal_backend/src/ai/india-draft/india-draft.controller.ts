import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { DocumentIngestService } from '@/drafting-session/document-ingest.service';
import { IndiaDraftService } from './india-draft.service';
import { IndiaDraftAdapter } from '@/ai/unified-drafting/adapters/india-draft.adapter';
import {
  ConfirmCaseRecordDto,
  ApplyRepairConfirmationsDto,
  EditIndiaDraftDto,
  ExportIndiaDraftDto,
  ExtractCaseRecordDto,
  ExtractFormFieldsDto,
  FillBlanksDto,
  FixVerificationDto,
  GenerateIndiaDraftDto,
  HumanReviewApproveDto,
  RegenerateSectionDto,
  ResolveCaseLawDto,
  ReverifyIndiaDraftDto,
} from './india-draft.dto';
import { ExtractFormFieldsService } from './extract-form-fields.service';
import { DraftPipelineService } from '@/ai/drafting/platform/draft-pipeline.service';
import { HumanReviewService } from '@/ai/drafting/platform/human-review.service';
import { DraftFilingReleaseService } from '@/ai/drafting/platform/draft-filing-release.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { DraftAccuracyMetricsService } from '@/ai/drafting/platform/draft-accuracy-metrics.service';
import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';
import type { CaseRecord } from '@/ai/drafting/contracts/case-record';

const ALLOWED_EXTRACT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

@Controller('ai/india-draft')
@UseGuards(TenantGuard)
export class IndiaDraftController {
  private readonly logger = new Logger(IndiaDraftController.name);
  constructor(
    private readonly svc: IndiaDraftService,
    private readonly ingest: DocumentIngestService,
    private readonly unifiedAdapter: IndiaDraftAdapter,
    private readonly draftPipeline: DraftPipelineService,
    private readonly humanReview: HumanReviewService,
    private readonly filingRelease: DraftFilingReleaseService,
    private readonly draftHistory: CourtDraftHistoryService,
    private readonly accuracyMetrics: DraftAccuracyMetricsService,
    private readonly extractFormFields: ExtractFormFieldsService,
  ) {}

  /**
   * POST /ai/india-draft/extract-form-fields
   * Prefill client / opposing / court from case details (regex first, LLM if incomplete).
   * No credits charged.
   */
  @Post('extract-form-fields')
  extractFormFieldsEndpoint(
    @TenantId() _tenantId: string,
    @CurrentUser() _user: RequestUser,
    @Body() dto: ExtractFormFieldsDto,
  ) {
    return this.extractFormFields.extract({
      caseDetails: dto.caseDetails,
      kind: dto.kind,
      category: dto.category,
    });
  }

  /**
   * POST /ai/india-draft/extract-case-record
   * Extract a versioned Case Record (no credits). User confirms before generate.
   */
  @Post('extract-case-record')
  extractCaseRecord(
    @TenantId() _tenantId: string,
    @CurrentUser() _user: RequestUser,
    @Body() dto: ExtractCaseRecordDto,
  ) {
    const result = this.draftPipeline.extractOnly({
      documentKind: dto.kind,
      caseDetails: dto.caseDetails,
      clientName: dto.clientName,
      courtName: dto.courtName,
      opposingParty: dto.opposingParty,
      jurisdiction: dto.jurisdiction ?? 'IN',
      attachmentContext: dto.attachmentContext,
    });
    return {
      caseRecord: result.caseRecord,
      playbook: {
        id: result.playbook.id,
        documentKind: result.playbook.documentKind,
        version: result.playbook.version,
        planningMode: result.playbook.planningMode,
        filingGrade: result.playbook.filingGrade,
        mandatoryFields: result.playbook.mandatoryFields,
        partyLabel: result.playbook.partyLabel,
      },
      intakeValidation: result.intakeValidation,
      conflictSuggestions: result.conflictSuggestions,
    };
  }

  /**
   * POST /ai/india-draft/confirm-case-record
   * Locks Case Record version after user resolves conflicts.
   */
  @Post('confirm-case-record')
  confirmCaseRecord(
    @TenantId() _tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ConfirmCaseRecordDto,
  ) {
    const confirmed = this.draftPipeline.confirmCaseRecord(
      dto.caseRecord as unknown as CaseRecord,
      user.id,
      dto.resolutions,
    );
    return { caseRecord: confirmed };
  }

  /**
   * POST /ai/india-draft/apply-repair-confirmations
   * Resolve ambiguous accuracy findings, bump CaseRecord, re-run review-and-repair.
   */
  @Post('apply-repair-confirmations')
  applyRepairConfirmations(
    @TenantId() _tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ApplyRepairConfirmationsDto,
  ) {
    return this.svc.applyRepairConfirmations(
      {
        documentKind: dto.documentKind,
        draft: dto.draft,
        caseRecord: dto.caseRecord as unknown as CaseRecord,
        answers: dto.answers,
        caseDetails: dto.caseDetails,
        accuracyMode: dto.accuracyMode,
      },
      { userId: user.id, tenantId: _tenantId },
    );
  }

  /**
   * POST /ai/india-draft/human-review/approve
   * Filing-grade export requires human approval stamped to draft hash + versions.
   */
  @Post('human-review/approve')
  @UseGuards(RolesGuard)
  @Roles('PARTNER', 'PARTNER_ADMIN', 'FIRM_ADMIN', 'ADVOCATE', 'SENIOR_ADVOCATE')
  async approveHumanReview(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: HumanReviewApproveDto,
  ) {
    const snapshot = await this.filingRelease.recordApprovalFromServer({
      tenantId,
      userId: user.id,
      draftId: dto.draftId,
      tenantRole: user.tenantRole,
      notes: dto.notes,
      expectedContentRevision: dto.expectedContentRevision,
    });
    const record = await this.humanReview.get(tenantId, dto.draftId);
    return { humanReview: record };
  }

  @Post('human-review/status')
  async humanReviewStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: HumanReviewApproveDto,
  ) {
    const { snapshot } = await this.filingRelease.resolveAuthoritativeSnapshot(
      tenantId,
      user.id,
      dto.draftId,
      user.tenantRole,
    );
    return this.humanReview.isApprovalValid({
      tenantId,
      draftId: dto.draftId,
      caseRecordId: snapshot.caseRecordId,
      caseRecordVersion: snapshot.caseRecordVersion,
      playbookVersion: snapshot.playbookVersion,
      draftHash: snapshot.draftHash,
      evidenceRevision: snapshot.evidenceRevision,
      courtProfileId: snapshot.courtProfileId,
      contentRevision: snapshot.contentRevision,
      releaseDigest: snapshot.releaseDigest,
    });
  }

  @Get('accuracy-metrics')
  accuracyMetricsSnapshot(
    @TenantId() _tenantId: string,
    @CurrentUser() _user: RequestUser,
  ) {
    return this.accuracyMetrics.snapshot();
  }

  /**
   * POST /ai/india-draft/generate
   * Generate a full court document from format kind + case details.
   *
   * When UNIFIED_DRAFT_ENGINE_ENABLED=true and the request is within the rollout
   * percentage, routes to the async unified engine and returns a jobId immediately.
   * Legacy clients detect the migratedToAsyncEngine flag and poll /draft-jobs/:jobId.
   */
  @Post('generate')
  generateDraft(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateIndiaDraftDto,
  ) {
    if (this.unifiedAdapter.isEnabled(tenantId, user.id)) {
      return this.unifiedAdapter.createJob(dto, { userId: user.id, tenantId });
    }
    return this.svc.generateDraft(dto, { userId: user.id, tenantId });
  }

  /**
   * POST /ai/india-draft/fill-blanks
   * AI fills empty {{placeholders}} based on the already-provided context.
   */
  @Post('fill-blanks')
  fillBlanks(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: FillBlanksDto,
  ) {
    return this.svc.fillBlanks(dto, { userId: user.id, tenantId });
  }

  /**
   * POST /ai/india-draft/edit
   * AI refines a selected passage according to an instruction.
   */
  @Post('edit')
  editSelection(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: EditIndiaDraftDto,
  ) {
    return this.svc.editSelection(dto, { userId: user.id, tenantId });
  }

  @Post('reverify')
  reverifyDraft(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ReverifyIndiaDraftDto,
  ) {
    return this.svc.reverify(dto, { userId: user.id, tenantId });
  }

  @Post('fix-verification')
  fixVerification(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: FixVerificationDto,
  ) {
    return this.svc.fixVerification(dto, { userId: user.id, tenantId });
  }

  /**
   * POST /ai/india-draft/export
   * Returns a styled HTML shell for PDF/DOCX export.
   */
  @Post('export')
  async exportDraft(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ExportIndiaDraftDto,
  ) {
    let exportDto = dto;
    if (dto.exportMode === 'filing') {
      if (!dto.draftId) {
        throw new BadRequestException('A persisted draft is required for filing export.');
      }
      const released = await this.filingRelease.assertFilingExportAllowed(
        tenantId,
        user.id,
        dto.draftId,
        user.tenantRole,
      );
      exportDto = {
        ...dto,
        html: released.draftText,
        citationAppendix: released.citationAppendix as ExportIndiaDraftDto['citationAppendix'],
      };
    }
    return this.svc.exportDraft(exportDto, { userId: user.id, tenantId });
  }

  /**
   * POST /ai/india-draft/extract-context
   * Extracts plain text from an uploaded document (PDF, DOCX, image, TXT).
   * No credits charged — extraction only. The caller passes extractedText
   * as attachmentContext to /generate.
   */
  @Post('extract-context')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async extractContext(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ extractedText: string; fileName: string; mimeType: string }> {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_EXTRACT_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: PDF, DOCX, DOC, TXT, PNG, JPG, WEBP.',
      );
    }

    let extractedText = '';
    try {
      const result = await this.ingest.ingestBuffer(
        file.buffer,
        file.mimetype,
        file.originalname,
      );
      extractedText = result.plainText.slice(0, 10000);
    } catch (err) {
      this.logger.warn(`extract-context ingest failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('Could not extract text from this file. Try a different format.');
    }

    return {
      extractedText,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };
  }

  /**
   * POST /ai/india-draft/regenerate-section
   * v2 engine only: targeted repair of a single section.
   * Returns the regenerated SectionResult for the specified sectionId.
   * The client replaces only that section in its local document state.
   */
  @Post('regenerate-section')
  regenerateSection(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RegenerateSectionDto,
  ) {
    return this.svc.regenerateSection(dto, { userId: user.id, tenantId });
  }

  /**
   * POST /ai/india-draft/resolve-case-law
   * Look up a user-supplied citation; on success write-through to authority registry.
   */
  @Post('resolve-case-law')
  resolveCaseLaw(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ResolveCaseLawDto,
  ) {
    return this.svc.resolveCaseLaw(dto, { userId: user.id, tenantId });
  }
}
