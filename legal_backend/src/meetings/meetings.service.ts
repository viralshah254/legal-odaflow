import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateMeetingNoteDto } from './dto/create-meeting-note.dto';
import { CreateMeetingTranscriptDto } from './dto/create-meeting-transcript.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMeetingDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    return this.prisma.meeting.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        title: dto.title,
        status: dto.status ?? 'SCHEDULED',
        scheduledAt: dto.scheduledAt,
        durationMin: dto.durationMin,
      },
      include: { transcripts: true, notes: true, matter: true },
    });
  }

  async findAll(tenantId: string, matterId?: string) {
    return this.prisma.meeting.findMany({
      where: { tenantId, matterId: matterId || undefined },
      include: { transcripts: true, notes: true, matter: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      include: { transcripts: true, notes: true, matter: true },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  async update(tenantId: string, meetingId: string, dto: UpdateMeetingDto) {
    await this.findOne(tenantId, meetingId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: dto,
      include: { transcripts: true, notes: true, matter: true },
    });
  }

  async remove(tenantId: string, meetingId: string) {
    await this.findOne(tenantId, meetingId);
    await this.prisma.meeting.delete({ where: { id: meetingId } });
    return { success: true };
  }

  async addTranscript(
    tenantId: string,
    meetingId: string,
    dto: CreateMeetingTranscriptDto,
  ) {
    await this.findOne(tenantId, meetingId);

    return this.prisma.meetingTranscript.create({
      data: {
        tenantId,
        meetingId,
        content: dto.content,
        source: dto.source,
      },
    });
  }

  async addNote(tenantId: string, meetingId: string, dto: CreateMeetingNoteDto) {
    await this.findOne(tenantId, meetingId);

    return this.prisma.meetingNote.create({
      data: {
        tenantId,
        meetingId,
        content: dto.content,
        createdById: dto.createdById,
      },
    });
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }
  }
}
