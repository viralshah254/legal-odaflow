import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DraftFinetuneExportService } from './draft-finetune-export.service';
import { DraftTrainingPipelineService } from './draft-training-pipeline.service';
import { DraftCorrectionService } from './draft-correction.service';
import { AzureFineTuneService } from './azure-finetune.service';
import { DraftEvalAutomationService } from './draft-eval-automation.service';

@Controller('admin/training')
@UseGuards(JwtAuthGuard)
export class DraftTrainingAdminController {
  constructor(
    private readonly exportService: DraftFinetuneExportService,
    private readonly pipeline: DraftTrainingPipelineService,
    private readonly draftCorrections: DraftCorrectionService,
    private readonly azureFineTune: AzureFineTuneService,
    private readonly evalAutomation: DraftEvalAutomationService,
  ) {}

  /**
   * Export fine-tuning dataset as JSONL.
   * Download: GET /admin/training/export-finetune-dataset?tenantId=...
   */
  @Get('export-finetune-dataset')
  async exportDataset(
    @Query('tenantId') tenantId?: string,
    @Query('documentKind') documentKind?: string,
    @Query('sectionType') sectionType?: string,
    @Query('minEditRatio') minEditRatioStr?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const { jsonl, rowCount } = await this.exportService.exportJsonl({
      tenantId,
      documentKind,
      sectionType,
      minEditRatio: minEditRatioStr ? parseFloat(minEditRatioStr) : 0.7,
    });

    res!.setHeader('Content-Type', 'application/jsonl');
    res!.setHeader(
      'Content-Disposition',
      `attachment; filename="draft-finetune-${Date.now()}.jsonl"`,
    );
    res!.setHeader('X-Row-Count', String(rowCount));
    res!.send(jsonl);
  }

  /** Summary stats for the admin dashboard. */
  @Get('summary')
  async getSummary(@Query('tenantId') tenantId?: string) {
    return this.exportService.getSummary(tenantId);
  }

  /** Manually trigger the training pipeline for a tenant. */
  @Post('run-pipeline')
  async runPipeline(@Query('tenantId') tenantId: string) {
    return this.pipeline.runForTenant(tenantId);
  }

  // ── Draft correction signals ──────────────────────────────────────────────

  @Get('draft-corrections')
  async listDraftCorrections(
    @Query('documentKind') documentKind?: string,
    @Query('status') status?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    return this.draftCorrections.listPendingSignals({
      documentKind,
      status,
      limit: limitStr ? parseInt(limitStr, 10) : 50,
      offset: offsetStr ? parseInt(offsetStr, 10) : 0,
    });
  }

  @Post('draft-corrections/:id/approve')
  async approveDraftCorrection(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body?: { reviewNotes?: string },
  ) {
    return this.draftCorrections.approveSignal(
      id,
      req.user.userId ?? req.user.id,
      body?.reviewNotes,
    );
  }

  @Post('draft-corrections/:id/reject')
  async rejectDraftCorrection(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body?: { reviewNotes?: string },
  ) {
    return this.draftCorrections.rejectSignal(
      id,
      req.user.userId ?? req.user.id,
      body?.reviewNotes,
    );
  }

  // ── Azure fine-tune ───────────────────────────────────────────────────────

  @Post('finetune/start')
  async startFineTune(
    @Body()
    body: { documentKind: string; sectionType: string; baseModel?: string },
  ) {
    return this.azureFineTune.startFineTuneJob(body);
  }

  @Get('finetune/eligible')
  async listEligibleFineTunes() {
    return this.azureFineTune.findEligibleSections();
  }

  @Post('finetune/:id/register-deployment')
  async registerDeployment(
    @Param('id') id: string,
    @Body() body: { deploymentName: string },
  ) {
    await this.azureFineTune.registerDeployment(id, body.deploymentName);
    return { ok: true };
  }

  // ── Eval automation ───────────────────────────────────────────────────────

  @Post('eval/run')
  async runEval() {
    return this.evalAutomation.runNow();
  }
}
