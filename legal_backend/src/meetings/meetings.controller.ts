import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { assertUploadBuffer } from '@/common/file-upload-validation';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateMeetingNoteDto } from './dto/create-meeting-note.dto';
import { CreateMeetingTranscriptDto } from './dto/create-meeting-transcript.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
@UseGuards(TenantGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  private validateMeetingAudio(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('No audio file uploaded');
    }
    assertUploadBuffer(
      file.buffer,
      file.originalname || 'recording.webm',
      'meetingAudio',
    );
    return file;
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.meetingsService.create(tenantId, dto, user.id);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('q') search?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      matterId,
      clientId,
      search,
      status,
      dateFrom,
      dateTo,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    };

    const usesPagination =
      filters.page != null ||
      filters.limit != null ||
      !!search?.trim() ||
      !!status?.trim() ||
      !!dateFrom?.trim() ||
      !!dateTo?.trim();

    const result = await this.meetingsService.findAllPaginated(
      tenantId,
      filters,
      user.id,
      user.tenantRole,
    );

    if (usesPagination) {
      return result;
    }

    return result.items;
  }

  @Get(':meetingId')
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.findOne(tenantId, meetingId, user.id, user.tenantRole);
  }

  @Patch(':meetingId')
  update(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(tenantId, meetingId, dto);
  }

  @Delete(':meetingId')
  remove(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.remove(tenantId, meetingId);
  }

  // ---------------------------------------------------------------------------
  // Audio upload — two routes to satisfy both the new generic endpoint and
  // the existing frontend call to /meetings/:id/process.
  // ---------------------------------------------------------------------------

  @Post(':meetingId/audio')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max recording
    }),
  )
  uploadAudio(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { durationMs?: string; draftTranscript?: string },
  ) {
    const audio = this.validateMeetingAudio(file);
    const durationMs = body.durationMs ? parseInt(body.durationMs, 10) : undefined;
    return this.meetingsService.processAudio(
      tenantId,
      meetingId,
      audio.buffer,
      audio.mimetype,
      durationMs,
      user.id,
      body.draftTranscript,
    );
  }

  /** Alias used by FloatingRecorderBar: POST /meetings/:id/process */
  @Post(':meetingId/process')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  processAudio(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { durationMs?: string; draftTranscript?: string },
  ) {
    if (!file) {
      return this.meetingsService.requeueTranscription(tenantId, meetingId, user.id);
    }
    const audio = this.validateMeetingAudio(file);
    const durationMs = body.durationMs ? parseInt(body.durationMs, 10) : undefined;
    return this.meetingsService.processAudio(
      tenantId,
      meetingId,
      audio.buffer,
      audio.mimetype,
      durationMs,
      user.id,
      body.draftTranscript,
    );
  }

  /** Chunked recording upload — multipart S3 parts streamed during capture. */
  @Post(':meetingId/recording-chunks')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream') {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported chunk type: ${file.mimetype}`), false);
        }
      },
    }),
  )
  uploadRecordingChunk(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      partNumber?: string;
      mimeType?: string;
      isLast?: string;
      durationMs?: string;
      draftTranscript?: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('chunk file is required');
    }
    const partNumber = body.partNumber ? parseInt(body.partNumber, 10) : NaN;
    if (!Number.isFinite(partNumber) || partNumber < 1) {
      throw new BadRequestException('partNumber must be a positive integer');
    }
    const mimeType = body.mimeType || file.mimetype || 'audio/webm';
    const isLast = body.isLast === 'true' || body.isLast === '1';
    const durationMs = body.durationMs ? parseInt(body.durationMs, 10) : undefined;
    return this.meetingsService.appendRecordingChunk(
      tenantId,
      meetingId,
      partNumber,
      file.buffer,
      mimeType,
      user.id,
      { isLast, durationMs, draftTranscript: body.draftTranscript },
    );
  }

  @Patch(':meetingId/recording-progress')
  syncRecordingProgress(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
    @Body() body: { durationMs?: number },
  ) {
    if (body.durationMs == null || !Number.isFinite(body.durationMs)) {
      throw new BadRequestException('durationMs is required');
    }
    return this.meetingsService.syncRecordingDuration(tenantId, meetingId, body.durationMs);
  }

  @Post(':meetingId/recording-complete')
  completeRecordingUpload(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
    @Body() body: { durationMs?: number; draftTranscript?: string },
  ) {
    return this.meetingsService.completeRecordingUpload(tenantId, meetingId, user.id, {
      durationMs: body.durationMs,
      draftTranscript: body.draftTranscript,
    });
  }

  // ---------------------------------------------------------------------------
  // GET transcript + notes (frontend already calls these)
  // ---------------------------------------------------------------------------

  @Get(':meetingId/transcript')
  getTranscript(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.getLatestTranscript(tenantId, meetingId);
  }

  @Get(':meetingId/notes')
  getNotes(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.getNotes(tenantId, meetingId);
  }

  // ---------------------------------------------------------------------------
  // Audio stream
  // ---------------------------------------------------------------------------

  @Get(':meetingId/recording-access')
  getRecordingAccess(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.createRecordingAccess(tenantId, meetingId, user.id);
  }

  /** @deprecated use recording-access — kept for older clients */
  @Get(':meetingId/recording-url')
  getRecordingPlaybackUrl(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.getRecordingPlaybackUrl(tenantId, meetingId);
  }

  @Public()
  @Get(':meetingId/audio')
  async streamAudio(
    @Param('meetingId') meetingId: string,
    @Query('recording_token') recordingToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const tenantId = await this.meetingsService.resolveStreamTenant(
      meetingId,
      recordingToken,
      req.headers.authorization,
      req.headers['x-tenant-id'],
    );
    await this.meetingsService.streamRecordingToResponse(
      tenantId,
      meetingId,
      req.headers.range,
      res,
    );
  }

  // ---------------------------------------------------------------------------
  // Re-summarize
  // ---------------------------------------------------------------------------

  @Post(':meetingId/summarize')
  summarize(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.regenerateSummary(tenantId, meetingId, user.id);
  }

  // ---------------------------------------------------------------------------
  // Transcript & note write endpoints (existing)
  // ---------------------------------------------------------------------------

  @Post(':meetingId/transcripts')
  addTranscript(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateMeetingTranscriptDto,
  ) {
    return this.meetingsService.addTranscript(tenantId, meetingId, dto);
  }

  @Post(':meetingId/notes')
  addNote(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateMeetingNoteDto,
  ) {
    return this.meetingsService.addNote(tenantId, meetingId, dto);
  }
}
