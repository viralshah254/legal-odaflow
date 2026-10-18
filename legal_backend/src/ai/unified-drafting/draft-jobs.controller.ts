import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Sse,
  MessageEvent,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Observable, fromEvent, EMPTY } from 'rxjs';
import { map, takeUntil, finalize } from 'rxjs/operators';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';
import { DraftJobService, CreateDraftJobDto } from './draft-job.service';
import { DraftProgressService } from './progress/draft-progress.service';
import { CaseLawEnrichService } from './enrich/case-law-enrich.service';
import { CreateDraftJobDtoClass } from './dto/create-draft-job.dto';

interface AuthRequest {
  user: { id: string; tenantId: string; tenantRole?: string };
}

@Controller('draft-jobs')
export class DraftJobsController {
  constructor(
    private readonly jobService: DraftJobService,
    private readonly progressService: DraftProgressService,
    private readonly caseLawEnrich: CaseLawEnrichService,
    private readonly access: ArtifactAccessResolver,
  ) {}

  /** Create a new draft job. Returns immediately with jobId. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() body: CreateDraftJobDtoClass, @Req() req: AuthRequest) {
    const dto: CreateDraftJobDto = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      matterId: body.matterId,
      profile: body.profile ?? 'india_court',
      documentKind: body.documentKind,
      qualityTier: body.qualityTier ?? 'standard',
      facts: body.facts,
      jurisdiction: body.jurisdiction,
      courtName: body.courtName,
      clientName: body.clientName,
      opposingParty: body.opposingParty,
      attachmentContext: body.attachmentContext,
      formNumber: body.formNumber,
      language: body.language,
      idempotencyKey: body.idempotencyKey,
    };
    return this.jobService.create(dto);
  }

  /** Get the current status of a draft job. */
  @Get(':jobId')
  async getStatus(@Param('jobId') jobId: string, @Req() req: AuthRequest) {
    await this.access.assertDraftJobAccessible(
      { tenantId: req.user.tenantId, userId: req.user.id, tenantRole: req.user.tenantRole },
      jobId,
    );
    return this.jobService.getStatus(jobId, req.user.tenantId);
  }

  /** Get the completed result of a ready draft job. */
  @Get(':jobId/result')
  async getResult(@Param('jobId') jobId: string, @Req() req: AuthRequest) {
    await this.access.assertDraftJobAccessible(
      { tenantId: req.user.tenantId, userId: req.user.id, tenantRole: req.user.tenantRole },
      jobId,
    );
    return this.jobService.getResult(jobId, req.user.tenantId);
  }

  /** SSE stream of progress events for a job. */
  @Sse(':jobId/events')
  async streamProgress(
    @Param('jobId') jobId: string,
    @Req() req: AuthRequest,
  ): Promise<Observable<MessageEvent>> {
    await this.access.assertDraftJobAccessible(
      { tenantId: req.user.tenantId, userId: req.user.id, tenantRole: req.user.tenantRole },
      jobId,
    );
    const subject = this.progressService.subscribe(jobId);
    return subject.pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: 'draft_progress',
        id: `${jobId}-${event.percent}`,
      } satisfies MessageEvent)),
      finalize(() => this.progressService.releaseSubscriber(jobId)),
    );
  }

  /** Cancel a queued or in-progress draft job. */
  @Post(':jobId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('jobId') jobId: string, @Req() req: AuthRequest) {
    await this.access.assertDraftJobAccessible(
      { tenantId: req.user.tenantId, userId: req.user.id, tenantRole: req.user.tenantRole },
      jobId,
    );
    await this.jobService.cancel(jobId, req.user.tenantId);
  }

  /**
   * Enrich an existing draft with verified authorities (case laws, sections, or both).
   * Debits platform credits from actual provider token cost.
   */
  @Post(':jobId/enrich')
  @HttpCode(HttpStatus.OK)
  async enrichDraft(
    @Param('jobId') jobId: string,
    @Body() body: EnrichCaseLawsRequest,
    @Req() req: AuthRequest,
  ) {
    if (!body.draftText || !body.documentKind) {
      throw new BadRequestException('draftText and documentKind are required');
    }

    await this.access.assertDraftJobAccessible(
      { tenantId: req.user.tenantId, userId: req.user.id, tenantRole: req.user.tenantRole },
      jobId,
    );

    const result = await this.caseLawEnrich.enrich({
      jobId,
      draftText: body.draftText,
      documentKind: body.documentKind,
      rawFacts: body.rawFacts ?? '',
      tenantId: req.user.tenantId,
      userId: req.user.id,
      mode: body.mode ?? 'case_laws',
    });

    return result;
  }

  /**
   * @deprecated Use POST :jobId/enrich with mode=case_laws
   */
  @Post(':jobId/enrich-case-laws')
  @HttpCode(HttpStatus.OK)
  async enrichCaseLaws(
    @Param('jobId') jobId: string,
    @Body() body: EnrichCaseLawsRequest,
    @Req() req: AuthRequest,
  ) {
    if (!body.draftText || !body.documentKind) {
      throw new BadRequestException('draftText and documentKind are required');
    }

    await this.access.assertDraftJobAccessible(
      { tenantId: req.user.tenantId, userId: req.user.id, tenantRole: req.user.tenantRole },
      jobId,
    );

    const result = await this.caseLawEnrich.enrich({
      jobId,
      draftText: body.draftText,
      documentKind: body.documentKind,
      rawFacts: body.rawFacts ?? '',
      tenantId: req.user.tenantId,
      userId: req.user.id,
      mode: 'case_laws',
    });

    return result;
  }
}

interface EnrichCaseLawsRequest {
  draftText: string;
  documentKind: string;
  rawFacts?: string;
  mode?: 'case_laws' | 'sections' | 'both';
}

