import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
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
  create(@TenantId() tenantId: string, @Body() dto: CreateMeetingDto) {
    return this.meetingsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
  ) {
    return this.meetingsService.findAll(tenantId, matterId);
  }

  @Get(':meetingId')
  findOne(
    @TenantId() tenantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.findOne(tenantId, meetingId);
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
