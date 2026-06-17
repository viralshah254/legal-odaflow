import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.meetingsService.create(tenantId, dto, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.meetingsService.findAll(
      tenantId,
      { matterId, clientId },
      user.id,
      user.tenantRole,
    );
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
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported audio type: ${file.mimetype}`), false);
        }
      },
    }),
  )
  uploadAudio(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { durationMs?: string; draftTranscript?: string },
  ) {
    const durationMs = body.durationMs ? parseInt(body.durationMs, 10) : undefined;
    return this.meetingsService.processAudio(
      tenantId,
      meetingId,
      file.buffer,
      file.mimetype,
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
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported audio type: ${file.mimetype}`), false);
        }
      },
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
      return this.meetingsService.update(tenantId, meetingId, { status: 'processing' });
    }
    const durationMs = body.durationMs ? parseInt(body.durationMs, 10) : undefined;
    return this.meetingsService.processAudio(
      tenantId,
      meetingId,
      file.buffer,
      file.mimetype,
      durationMs,
      user.id,
      body.draftTranscript,
    );
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

  @Get(':meetingId/audio')
  async streamAudio(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.meetingsService.getAudioBuffer(tenantId, meetingId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(buffer);
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
