import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dirname, extname, join } from 'path';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { JobsService } from '@/jobs/jobs.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { CreateMeetingNoteDto } from './dto/create-meeting-note.dto';
import { CreateMeetingTranscriptDto } from './dto/create-meeting-transcript.dto';
import { MeetingAccessService } from './meeting-access.service';

/** Whisper verbose_json segment shape */
interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

/** Structured content stored in MeetingTranscript.content for whisper-1 source */
interface StoredTranscript {
  text: string;
  segments: WhisperSegment[];
}

/**
 * Extended meeting shape that includes fields added by the recording pipeline
 * migration. Once `prisma generate` runs after the migration, the Prisma client
 * will include these natively; until then we cast Prisma results to this type.
 */
interface MeetingRow {
  id: string;
  tenantId: string;
  matterId: string | null;
  clientId?: string | null;
  createdByUserId?: string | null;
  title: string;
  status: string;
  source?: string | null;
  confidentiality?: string | null;
  participants?: unknown;
  visibilityAllowListUserIds?: unknown;
  scheduledAt?: Date | null;
  durationMin?: number | null;
  durationMs?: number | null;
  audioStorageKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Map legacy uppercase DB statuses to the current lowercase values. */
function normalizeMeetingStatus(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'draft',
    RECORDING: 'recording',
    UPLOADED: 'uploaded',
    PROCESSING: 'processing',
    READY: 'ready',
    FAILED: 'failed',
  };
  return map[status] ?? status.toLowerCase();
}

/** Shape returned to API consumers — normalised from Prisma fields */
export interface MeetingResponse {
  id: string;
  tenantId: string;
  matterId: string | null;
  clientId: string | null;
  createdByUserId: string | null;
  title: string;
  status: string;
  source: string;
  confidentiality: string;
  participants: string[];
  scheduledAt: string | null;
  startAt: string | null;
  durationMin: number | null;
  durationMs: number | null;
  audioStorageKey: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly s3Upload: S3UploadService,
    private readonly jobs: JobsService,
    private readonly meetingAccess: MeetingAccessService,
    private readonly llmCompletion: LlmCompletionService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private get uploadRoot(): string {
    return this.configService.get<string>(
      'UPLOAD_DIR',
      join(process.cwd(), 'uploads'),
    );
  }

  private toResponse(m: {
    id: string;
    tenantId: string;
    matterId: string | null;
    clientId?: string | null;
    createdByUserId?: string | null;
    title: string;
    status: string;
    source?: string | null;
    confidentiality?: string | null;
    participants?: unknown;
    scheduledAt?: Date | null;
    durationMin?: number | null;
    durationMs?: number | null;
    audioStorageKey?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): MeetingResponse {
    return {
      id: m.id,
      tenantId: m.tenantId,
      matterId: m.matterId,
      clientId: m.clientId ?? null,
      createdByUserId: m.createdByUserId ?? null,
      title: m.title,
      status: normalizeMeetingStatus(m.status),
      source: m.source ?? 'manual_recording',
      confidentiality: m.confidentiality ?? 'standard',
      participants: Array.isArray(m.participants) ? (m.participants as string[]) : [],
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
      startAt: m.scheduledAt?.toISOString() ?? null,
      durationMin: m.durationMin ?? null,
      durationMs: m.durationMs ?? null,
      audioStorageKey: m.audioStorageKey ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  private async persistAudioBuffer(
    tenantId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
    const key = `${tenantId}/recordings/${new Date().toISOString().slice(0, 10).replace(/-/g, '/')}/${randomUUID()}.${ext}`;

    const provider = this.configService.get<string>('S3_PROVIDER', 'local');
    if (provider === 'local') {
      const target = join(this.uploadRoot, key);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buffer);
      return key;
    }

    await this.s3Upload.putObject(key, buffer, mimeType);
    return key;
  }

  async loadAudioBuffer(audioStorageKey: string): Promise<Buffer> {
    const provider = this.configService.get<string>('S3_PROVIDER', 'local');
    if (provider === 'local') {
      const filePath = join(this.uploadRoot, audioStorageKey);
      return readFileSync(filePath);
    }
    throw new Error('S3 audio download not implemented; use pre-signed URL flow for production');
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(tenantId: string, dto: CreateMeetingDto, callerUserId?: string) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    // Cast create args to any to bridge Prisma type lag until migration runs.
    const meeting = await (this.prisma.meeting.create as (args: unknown) => Promise<MeetingRow>)({
      data: {
        tenantId,
        matterId: dto.matterId,
        clientId: dto.clientId,
        createdByUserId: callerUserId ?? dto.createdByUserId,
        title: dto.title,
        status: dto.status ?? 'recording',
        source: dto.source ?? 'manual_recording',
        confidentiality: dto.confidentiality ?? 'standard',
        participants: (dto.participants ?? []) as string[],
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
        durationMin: dto.durationMin,
        durationMs: dto.durationMs,
      },
      include: { transcripts: true, notes: true, matter: true },
    });

    return this.toResponse(meeting);
  }

  async findAll(
    tenantId: string,
    filters: { matterId?: string; clientId?: string } = {},
    callerUserId?: string,
    callerRole?: string,
  ) {
    const rows = await this.prisma.meeting.findMany({
      where: {
        tenantId,
        matterId: filters.matterId || undefined,
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
      },
      include: { transcripts: true, notes: true, matter: true },
      orderBy: { updatedAt: 'desc' },
    });

    const meetings = rows as unknown as MeetingRow[];

    const filtered: MeetingRow[] =
      callerUserId
        ? this.meetingAccess.filterMeetings(meetings, callerUserId, callerRole) as MeetingRow[]
        : meetings;

    return filtered.map((m) => this.toResponse(m));
  }

  async findOne(tenantId: string, meetingId: string, callerUserId?: string, callerRole?: string) {
    const row = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      include: { transcripts: true, notes: true, matter: true },
    });

    if (!row) {
      throw new NotFoundException('Meeting not found');
    }

    const meeting = row as unknown as MeetingRow;

    if (callerUserId) {
      this.meetingAccess.assertCanReadMeeting({
        confidentiality: meeting.confidentiality ?? 'standard',
        createdByUserId: meeting.createdByUserId,
        visibilityAllowListUserIds: Array.isArray(meeting.visibilityAllowListUserIds)
          ? (meeting.visibilityAllowListUserIds as string[])
          : null,
        callerUserId,
        callerRole,
      });
    }

    return this.toResponse(meeting);
  }

  async update(tenantId: string, meetingId: string, dto: UpdateMeetingDto) {
    await this.findOne(tenantId, meetingId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const updated = await (this.prisma.meeting.update as (args: unknown) => Promise<MeetingRow>)({
      where: { id: meetingId },
      data: dto,
      include: { transcripts: true, notes: true, matter: true },
    });

    return this.toResponse(updated);
  }

  async remove(tenantId: string, meetingId: string) {
    await this.findOne(tenantId, meetingId);
    await this.prisma.meeting.delete({ where: { id: meetingId } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Audio upload + async transcription trigger
  // ---------------------------------------------------------------------------

  async processAudio(
    tenantId: string,
    meetingId: string,
    audioBuffer: Buffer,
    mimeType: string,
    durationMs: number | undefined,
    callerUserId: string,
    draftTranscript?: string,
  ): Promise<{ status: string }> {
    const row = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });
    if (!row) throw new NotFoundException('Meeting not found');

    const audioStorageKey = await this.persistAudioBuffer(tenantId, audioBuffer, mimeType);

    // Save draft transcript from Web Speech API immediately so the meeting detail
    // page can show something while Whisper processes in the background.
    if (draftTranscript?.trim()) {
      await this.prisma.meetingTranscript.create({
        data: {
          tenantId,
          meetingId,
          content: draftTranscript.trim(),
          source: 'web-speech-api',
        },
      });
    }

    await (this.prisma.meeting.update as (args: unknown) => Promise<unknown>)({
      where: { id: meetingId },
      data: {
        status: 'processing',
        audioStorageKey,
        durationMs: durationMs ?? undefined,
      },
    });

    await this.jobs.enqueueMeetingTranscribeJob({
      meetingId,
      tenantId,
      userId: callerUserId,
      audioStorageKey,
      mimeType,
      durationMs,
    });

    return { status: 'processing' };
  }

  // ---------------------------------------------------------------------------
  // Transcript & notes reads
  // ---------------------------------------------------------------------------

  async getLatestTranscript(tenantId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      include: { transcripts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const t = meeting.transcripts[0];
    if (!t) return null;

    let rawText: string = t.content;
    let segments: Array<{ startMs: number; endMs: number; text: string; speakerLabel: string }> = [];

    // Try to parse structured JSON content stored by the whisper-1 pipeline
    if (t.content.trimStart().startsWith('{')) {
      try {
        const parsed = JSON.parse(t.content) as StoredTranscript;
        if (parsed.text !== undefined) {
          rawText = parsed.text;
          segments = (parsed.segments ?? []).map((s) => ({
            startMs: Math.round(s.start * 1000),
            endMs: Math.round(s.end * 1000),
            text: s.text.trim(),
            speakerLabel: '',
          }));
        }
      } catch {
        // Fallback: treat as plain text
      }
    }

    return {
      id: t.id,
      meetingId: t.meetingId,
      version: 1,
      language: 'en',
      rawText,
      segments,
      createdAt: t.createdAt.toISOString(),
    };
  }

  /** Stream the stored audio file for a meeting. Returns buffer + mime type. */
  async getAudioBuffer(tenantId: string, meetingId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const meeting = await (this.prisma.meeting.findFirst as (args: unknown) => Promise<MeetingRow | null>)({
      where: { id: meetingId, tenantId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const key = (meeting as MeetingRow).audioStorageKey;
    if (!key) throw new NotFoundException('No audio recording available for this meeting');

    const buffer = await this.loadAudioBuffer(key);
    const ext = extname(key).replace('.', '') || 'webm';
    const mimeType = ext === 'mp4' ? 'video/mp4' : `audio/${ext}`;
    return { buffer, mimeType };
  }

  /** Re-run GPT summarization from the latest transcript and create a new note. */
  async regenerateSummary(tenantId: string, meetingId: string, callerUserId: string) {
    const meeting = await (this.prisma.meeting.findFirst as (args: unknown) => Promise<(MeetingRow & { transcripts: Array<{ content: string; source: string | null }> }) | null>)({
      where: { id: meetingId, tenantId },
      include: { transcripts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const latestTranscript = meeting.transcripts[0];
    if (!latestTranscript) throw new NotFoundException('No transcript available to summarize');

    let transcriptText: string = latestTranscript.content;
    if (latestTranscript.content.trimStart().startsWith('{')) {
      try {
        const parsed = JSON.parse(latestTranscript.content) as StoredTranscript;
        if (parsed.text !== undefined) transcriptText = parsed.text;
      } catch {
        // use raw content
      }
    }

    let notesMarkdown = '';
    try {
      const result = await this.llmCompletion.complete({
        modelName: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a specialist legal meeting analyst. Generate concise, factual meeting notes from transcripts.',
          },
          {
            role: 'user',
            content: `Transcript of client meeting titled "${(meeting as MeetingRow).title}":\n\n${transcriptText}\n\nGenerate meeting notes with these sections:\n## Summary\n## Decisions Made\n## Action Items\n## Open Questions`,
          },
        ],
        maxTokens: 800,
        temperature: 0.2,
      });
      notesMarkdown = result.content;
    } catch {
      notesMarkdown = `## Summary\n- Transcript processed. Review for follow-up items.`;
    }

    const note = await this.prisma.meetingNote.create({
      data: { tenantId, meetingId, content: notesMarkdown, createdById: callerUserId },
    });

    return {
      id: note.id,
      meetingId: note.meetingId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.createdAt.toISOString(),
    };
  }

  async getNotes(tenantId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      include: { notes: { orderBy: { createdAt: 'asc' } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    return meeting.notes.map((n) => ({
      id: n.id,
      meetingId: n.meetingId,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Transcript & notes writes (existing)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });
    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }
  }
}
