import {
  ForbiddenException,
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { dirname, extname, join } from 'path';
import { createReadStream, existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type { Readable } from 'stream';
import { PrismaService } from '@/prisma/prisma.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { JobsService } from '@/jobs/jobs.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { CreateMeetingNoteDto } from './dto/create-meeting-note.dto';
import { CreateMeetingTranscriptDto } from './dto/create-meeting-transcript.dto';
import { MeetingAccessService } from './meeting-access.service';
import { AudioTranscodeService } from './audio-transcode.service';
import { buildMeetingNotesUserPrompt, MEETING_NOTES_SYSTEM_PROMPT } from './meeting-notes.prompt';
import type { MeetingListFilters, MeetingListPage } from './meeting-list.types';

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

interface RecordingUploadSession {
  tenantId: string;
  meetingId: string;
  key: string;
  uploadId?: string;
  mimeType: string;
  parts: Array<{ PartNumber: number; ETag: string }>;
  localChunks: Buffer[];
  nextPartNumber: number;
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
  /** In-flight multipart uploads keyed by tenantId:meetingId */
  private readonly recordingSessions = new Map<string, RecordingUploadSession>();
  /** Avoid duplicate WebM → M4A transcodes when playback is requested concurrently. */
  private readonly playbackTranscodeLocks = new Map<string, Promise<{ key: string; mimeType: string }>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly s3Upload: S3UploadService,
    private readonly jobs: JobsService,
    private readonly meetingAccess: MeetingAccessService,
    private readonly llmCompletion: LlmCompletionService,
    private readonly jwtService: JwtService,
    private readonly audioTranscode: AudioTranscodeService,
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

  /** True when meeting audio/video should be stored in S3 (never on local disk in production). */
  private recordingsUseObjectStorage(): boolean {
    const provider = this.configService.get<string>('S3_PROVIDER', 'local').trim().toLowerCase();
    if (provider === 'local') {
      return false;
    }
    return this.s3Upload.isConfigured();
  }

  private assertRecordingsObjectStorageReady(): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    if (!isProduction) {
      return;
    }
    if (this.recordingsUseObjectStorage()) {
      return;
    }
    throw new ServiceUnavailableException(
      'Meeting recordings require S3 in production. Set S3_PROVIDER to aws or s3 (not local), plus S3_BUCKET, S3_REGION, and S3 credentials.',
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
    this.assertRecordingsObjectStorageReady();

    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
    const key = `${tenantId}/recordings/${new Date().toISOString().slice(0, 10).replace(/-/g, '/')}/${randomUUID()}.${ext}`;

    if (this.recordingsUseObjectStorage()) {
      await this.s3Upload.putObject(key, buffer, mimeType);
      return key;
    }

    const target = join(this.uploadRoot, key);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buffer);
    return key;
  }

  async loadAudioBuffer(audioStorageKey: string): Promise<Buffer> {
    if (this.recordingsUseObjectStorage()) {
      return this.s3Upload.getObject(audioStorageKey);
    }

    const filePath = join(this.uploadRoot, audioStorageKey);
    return readFileSync(filePath);
  }

  private recordingSessionKey(tenantId: string, meetingId: string): string {
    return `${tenantId}:${meetingId}`;
  }

  private buildRecordingStorageKey(tenantId: string, mimeType: string): string {
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
    return `${tenantId}/recordings/${new Date().toISOString().slice(0, 10).replace(/-/g, '/')}/${randomUUID()}.${ext}`;
  }

  private async triggerProcessingAfterUpload(
    tenantId: string,
    meetingId: string,
    audioStorageKey: string,
    mimeType: string,
    durationMs: number | undefined,
    callerUserId: string,
    draftTranscript?: string,
  ): Promise<{ status: string }> {
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

  /**
   * Streamed recording upload — one S3 multipart part per request.
   * Client buffers MediaRecorder slices until each part is ≥ 5 MB (S3 rule), except the final part.
   */
  async appendRecordingChunk(
    tenantId: string,
    meetingId: string,
    partNumber: number,
    chunkBuffer: Buffer,
    mimeType: string,
    callerUserId: string,
    options?: { isLast?: boolean; durationMs?: number; draftTranscript?: string },
  ): Promise<{ status: string; partsReceived: number; complete?: boolean }> {
    this.assertRecordingsObjectStorageReady();

    const row = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });
    if (!row) throw new NotFoundException('Meeting not found');

    const sessionKey = this.recordingSessionKey(tenantId, meetingId);
    let session = this.recordingSessions.get(sessionKey);

    if (!session && partNumber !== 1) {
      throw new BadRequestException('Recording upload must start with partNumber=1');
    }

    if (!session) {
      session = {
        tenantId,
        meetingId,
        key: this.buildRecordingStorageKey(tenantId, mimeType),
        mimeType,
        parts: [],
        localChunks: [],
        nextPartNumber: 1,
      };
      if (this.recordingsUseObjectStorage()) {
        session.uploadId = await this.s3Upload.createMultipartUpload(session.key, mimeType);
      }
      this.recordingSessions.set(sessionKey, session);
    }

    if (partNumber !== session.nextPartNumber) {
      throw new BadRequestException(
        `Expected partNumber=${session.nextPartNumber}, received ${partNumber}`,
      );
    }

    if (this.recordingsUseObjectStorage() && session.uploadId) {
      const etag = await this.s3Upload.uploadMultipartPart(
        session.key,
        session.uploadId,
        partNumber,
        chunkBuffer,
      );
      session.parts.push({ PartNumber: partNumber, ETag: etag });
    } else {
      session.localChunks.push(chunkBuffer);
    }
    session.nextPartNumber = partNumber + 1;

    if (options?.isLast) {
      let audioStorageKey = session.key;
      if (this.recordingsUseObjectStorage() && session.uploadId) {
        await this.s3Upload.completeMultipartUpload(session.key, session.uploadId, session.parts);
      } else {
        const merged = Buffer.concat(session.localChunks);
        audioStorageKey = await this.persistAudioBuffer(tenantId, merged, mimeType);
      }

      this.recordingSessions.delete(sessionKey);
      const result = await this.triggerProcessingAfterUpload(
        tenantId,
        meetingId,
        audioStorageKey,
        mimeType,
        options.durationMs,
        callerUserId,
        options.draftTranscript,
      );
      return { ...result, partsReceived: partNumber, complete: true };
    }

    return { status: 'uploading', partsReceived: partNumber };
  }

  /** Complete a chunked upload when all parts were already flushed during capture. */
  async completeRecordingUpload(
    tenantId: string,
    meetingId: string,
    callerUserId: string,
    options?: { durationMs?: number; draftTranscript?: string },
  ): Promise<{ status: string; complete: true }> {
    const sessionKey = this.recordingSessionKey(tenantId, meetingId);
    const session = this.recordingSessions.get(sessionKey);
    if (!session || (session.parts.length === 0 && session.localChunks.length === 0)) {
      throw new BadRequestException('No active recording upload to complete');
    }

    let audioStorageKey = session.key;
    if (this.recordingsUseObjectStorage() && session.uploadId) {
      await this.s3Upload.completeMultipartUpload(session.key, session.uploadId, session.parts);
    } else {
      const merged = Buffer.concat(session.localChunks);
      audioStorageKey = await this.persistAudioBuffer(tenantId, merged, session.mimeType);
    }

    this.recordingSessions.delete(sessionKey);
    const result = await this.triggerProcessingAfterUpload(
      tenantId,
      meetingId,
      audioStorageKey,
      session.mimeType,
      options?.durationMs,
      callerUserId,
      options?.draftTranscript,
    );
    return { ...result, complete: true };
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /** Update elapsed duration while a meeting is still recording (for list/detail UI). */
  async syncRecordingDuration(
    tenantId: string,
    meetingId: string,
    durationMs: number,
  ): Promise<{ durationMs: number }> {
    const row = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });
    if (!row) throw new NotFoundException('Meeting not found');
    if (normalizeMeetingStatus(row.status) !== 'recording') {
      throw new BadRequestException('Meeting is not actively recording');
    }

    await (this.prisma.meeting.update as (args: unknown) => Promise<unknown>)({
      where: { id: meetingId },
      data: { durationMs },
    });

    return { durationMs };
  }

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
    filters: MeetingListFilters = {},
    callerUserId?: string,
    callerRole?: string,
  ): Promise<MeetingResponse[]> {
    const page = await this.findAllPaginated(tenantId, filters, callerUserId, callerRole);
    return page.items;
  }

  private statusVariants(normalized: string): string[] {
    const legacy: Record<string, string> = {
      draft: 'SCHEDULED',
      recording: 'RECORDING',
      uploaded: 'UPLOADED',
      processing: 'PROCESSING',
      ready: 'READY',
      failed: 'FAILED',
    };
    const upper = normalized.toUpperCase();
    return [...new Set([normalized, upper, legacy[normalized]].filter(Boolean))] as string[];
  }

  private buildListWhere(
    tenantId: string,
    filters: MeetingListFilters,
    callerUserId?: string,
    callerRole?: string,
  ): Record<string, unknown> {
    const and: Record<string, unknown>[] = [{ tenantId }];

    if (filters.matterId) {
      and.push({ matterId: filters.matterId });
    }
    if (filters.clientId) {
      and.push({ clientId: filters.clientId });
    }

    if (filters.status?.trim()) {
      const normalized = normalizeMeetingStatus(filters.status.trim());
      and.push({ status: { in: this.statusVariants(normalized) } });
    }

    const search = filters.search?.trim();
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) {
        createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
      }
      if (filters.dateTo) {
        const end = new Date(`${filters.dateTo}T23:59:59.999Z`);
        createdAt.lte = end;
      }
      and.push({ createdAt });
    }

    const accessWhere = this.meetingAccess.buildListAccessWhere(callerUserId, callerRole);
    if (accessWhere) {
      and.push(accessWhere);
    }

    return and.length === 1 ? and[0] : { AND: and };
  }

  async findAllPaginated(
    tenantId: string,
    filters: MeetingListFilters = {},
    callerUserId?: string,
    callerRole?: string,
  ): Promise<MeetingListPage> {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);
    const skip = (page - 1) * limit;
    const where = this.buildListWhere(tenantId, filters, callerUserId, callerRole);

    const [total, rows] = await Promise.all([
      this.prisma.meeting.count({ where: where as never }),
      this.prisma.meeting.findMany({
        where: where as never,
        include: { matter: { select: { title: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const meetings = rows as unknown as MeetingRow[];
    const filtered =
      callerUserId
        ? (this.meetingAccess.filterMeetings(meetings, callerUserId, callerRole) as MeetingRow[])
        : meetings;

    return {
      items: filtered.map((m) => this.toResponse(m)),
      total,
      page,
      limit,
      hasMore: skip + filtered.length < total,
    };
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
    return this.triggerProcessingAfterUpload(
      tenantId,
      meetingId,
      audioStorageKey,
      mimeType,
      durationMs,
      callerUserId,
      draftTranscript,
    );
  }

  /**
   * Re-enqueue Whisper + notes for a meeting that already has stored audio.
   * Skips if a whisper-1 transcript already exists (idempotent).
   */
  async requeueTranscription(
    tenantId: string,
    meetingId: string,
    callerUserId: string,
  ): Promise<{ status: string; skipped?: boolean }> {
    const meeting = await (this.prisma.meeting.findFirst as (args: unknown) => Promise<(MeetingRow & {
      transcripts: Array<{ source: string | null }>;
    }) | null>)({
      where: { id: meetingId, tenantId },
      include: {
        transcripts: {
          where: { source: { in: ['whisper-1', 'deepgram-stream'] } },
          take: 1,
        },
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    if (meeting.transcripts.length > 0) {
      if (meeting.status === 'ready') {
        return { status: 'ready', skipped: true };
      }
      // Transcript already saved — worker is likely generating notes; do not re-enqueue.
      return { status: meeting.status, skipped: true };
    }

    const audioStorageKey = meeting.audioStorageKey;
    if (!audioStorageKey) {
      throw new BadRequestException('No audio recording saved for this meeting');
    }

    const ext = extname(audioStorageKey).replace('.', '') || 'webm';
    const mimeType = ext === 'mp4' ? 'video/mp4' : `audio/${ext}`;

    await (this.prisma.meeting.update as (args: unknown) => Promise<unknown>)({
      where: { id: meetingId },
      data: { status: 'processing' },
    });

    await this.jobs.enqueueMeetingTranscribeJob({
      meetingId,
      tenantId,
      userId: callerUserId,
      audioStorageKey,
      mimeType,
      durationMs: meeting.durationMs ?? undefined,
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
    const { key, mimeType } = await this.resolveRecordingAsset(tenantId, meetingId);
    const buffer = await this.loadAudioBuffer(key);
    return { buffer, mimeType };
  }

  /**
   * Short-lived token for `<audio>` / `<video>` src URLs (no Authorization header).
   * Same token is reused in sessionStorage so the browser HTTP cache stays valid.
   */
  async createRecordingAccess(
    tenantId: string,
    meetingId: string,
    callerUserId: string,
  ): Promise<{ recordingToken: string; streamUrl: string | null; mimeType: string; isVideo: boolean }> {
    const meeting = await (this.prisma.meeting.findFirst as (args: unknown) => Promise<MeetingRow | null>)({
      where: { id: meetingId, tenantId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: callerUserId } },
    });
    const callerRole = membership?.status === 'ACTIVE' ? membership.role : undefined;
    this.meetingAccess.assertCanReadMeeting({
      confidentiality: meeting.confidentiality ?? 'standard',
      createdByUserId: meeting.createdByUserId,
      visibilityAllowListUserIds: Array.isArray(meeting.visibilityAllowListUserIds)
        ? (meeting.visibilityAllowListUserIds as string[])
        : null,
      callerUserId,
      callerRole,
    });

    const { mimeType } = await this.resolvePlaybackAsset(tenantId, meetingId);
    const recordingToken = this.jwtService.sign(
      { purpose: 'meeting-recording', meetingId, tenantId, sub: callerUserId },
      { expiresIn: '4h' },
    );

    let streamUrl: string | null = null;
    if (this.recordingsUseObjectStorage()) {
      const { key } = await this.resolvePlaybackAsset(tenantId, meetingId);
      streamUrl = await this.s3Upload.getPresignedGetUrl(key, 4 * 60 * 60);
    }

    return { recordingToken, streamUrl, mimeType, isVideo: mimeType.startsWith('video/') };
  }

  verifyRecordingAccessToken(token: string): { meetingId: string; tenantId: string; userId: string } {
    let payload: { purpose?: string; meetingId?: string; tenantId?: string; sub?: string };
    try {
      payload = this.jwtService.verify(token) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired recording token');
    }
    if (
      payload.purpose !== 'meeting-recording' ||
      !payload.meetingId ||
      !payload.tenantId ||
      !payload.sub
    ) {
      throw new UnauthorizedException('Invalid recording token');
    }
    return {
      meetingId: payload.meetingId,
      tenantId: payload.tenantId,
      userId: payload.sub,
    };
  }

  async resolveStreamTenant(
    meetingId: string,
    recordingToken?: string,
    authorization?: string,
    tenantHeader?: string | string[],
  ): Promise<string> {
    if (recordingToken) {
      const claims = this.verifyRecordingAccessToken(recordingToken);
      if (claims.meetingId !== meetingId) {
        throw new ForbiddenException('Recording token does not match this meeting');
      }
      return claims.tenantId;
    }

    if (authorization?.startsWith('Bearer ')) {
      const bearer = authorization.slice('Bearer '.length);
      let payload: { sub?: string };
      try {
        payload = this.jwtService.verify(bearer) as { sub?: string };
      } catch {
        throw new UnauthorizedException('Invalid access token');
      }
      if (!payload.sub) {
        throw new UnauthorizedException('Invalid access token');
      }
      const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
      if (!tenantId) {
        throw new ForbiddenException('X-Tenant-Id header is required');
      }
      const membership = await this.prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId, userId: payload.sub } },
      });
      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException('You are not an active member of this tenant');
      }
      return tenantId;
    }

    throw new UnauthorizedException('Recording access token required');
  }

  /** Stream recording with HTTP Range support for browser byte-range caching. */
  async streamRecordingToResponse(
    tenantId: string,
    meetingId: string,
    rangeHeader: string | undefined,
    res: Response,
  ): Promise<void> {
    const { key, mimeType } = await this.resolvePlaybackAsset(tenantId, meetingId);
    const parsedRange = this.parseHttpRange(rangeHeader);

    let stream: Readable;
    let status = 200;
    let contentLength: number;
    let contentRange: string | undefined;
    let etag: string | undefined;

    if (this.recordingsUseObjectStorage()) {
      const meta = await this.s3Upload.headObject(key);
      const totalSize = meta.contentLength;
      etag = meta.etag;
      const range = parsedRange ? this.clampByteRange(parsedRange, totalSize) : null;

      if (range) {
        status = 206;
        const result = await this.s3Upload.getObjectStream(key, range, totalSize);
        stream = result.stream;
        contentLength = result.contentLength;
        contentRange = result.contentRange;
      } else {
        const result = await this.s3Upload.getObjectStream(key, undefined, totalSize);
        stream = result.stream;
        contentLength = totalSize;
      }
    } else {
      const filePath = join(this.uploadRoot, key);
      const stats = statSync(filePath);
      const totalSize = stats.size;
      etag = `"${stats.mtimeMs}-${totalSize}"`;
      const range = parsedRange ? this.clampByteRange(parsedRange, totalSize) : null;

      if (range) {
        status = 206;
        stream = createReadStream(filePath, { start: range.start, end: range.end });
        contentLength = range.end - range.start + 1;
        contentRange = `bytes ${range.start}-${range.end}/${totalSize}`;
      } else {
        stream = createReadStream(filePath);
        contentLength = totalSize;
      }
    }

    res.status(status);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(contentLength),
      'Cache-Control': 'private, max-age=604800',
      ...(contentRange ? { 'Content-Range': contentRange } : {}),
      ...(etag ? { ETag: etag } : {}),
    });
    stream.pipe(res);
  }

  private parseHttpRange(
    rangeHeader: string | undefined,
  ): { start: number; end: number } | null {
    if (!rangeHeader?.startsWith('bytes=')) return null;
    const spec = rangeHeader.slice('bytes='.length).trim();
    const dash = spec.indexOf('-');
    if (dash < 0) return null;

    const rawStart = spec.slice(0, dash);
    const rawEnd = spec.slice(dash + 1);
    if (!rawStart && !rawEnd) return null;

    if (!rawStart) {
      const suffix = parseInt(rawEnd, 10);
      if (!Number.isFinite(suffix) || suffix <= 0) return null;
      return { start: -suffix, end: -1 };
    }

    const start = parseInt(rawStart, 10);
    if (!Number.isFinite(start) || start < 0) return null;
    if (!rawEnd) {
      return { start, end: Number.MAX_SAFE_INTEGER };
    }
    const end = parseInt(rawEnd, 10);
    if (!Number.isFinite(end) || end < start) return null;
    return { start, end };
  }

  private clampByteRange(
    range: { start: number; end: number },
    totalSize: number,
  ): { start: number; end: number } {
    if (range.start < 0) {
      const suffixLength = Math.abs(range.start);
      const start = Math.max(0, totalSize - suffixLength);
      return { start, end: totalSize - 1 };
    }
    const start = Math.min(range.start, totalSize - 1);
    const end = Math.min(range.end, totalSize - 1);
    return { start, end };
  }

  /** @deprecated presigned URLs bypass browser cache — use createRecordingAccess + range stream */
  async getRecordingPlaybackUrl(
    tenantId: string,
    meetingId: string,
  ): Promise<{ url: string | null; mimeType: string; isVideo: boolean }> {
    const { key, mimeType } = await this.resolvePlaybackAsset(tenantId, meetingId);
    const isVideo = mimeType.startsWith('video/');

    if (this.recordingsUseObjectStorage()) {
      const url = await this.s3Upload.getPresignedGetUrl(key);
      return { url, mimeType, isVideo };
    }

    return { url: null, mimeType, isVideo };
  }

  private async resolvePlaybackAsset(
    tenantId: string,
    meetingId: string,
  ): Promise<{ key: string; mimeType: string }> {
    const original = await this.resolveRecordingAsset(tenantId, meetingId);
    const ext = extname(original.key).replace('.', '').toLowerCase();
    if (ext !== 'webm') {
      return original;
    }

    const playbackKey = original.key.replace(/\.webm$/i, '.m4a');
    if (await this.playbackAssetExists(playbackKey)) {
      return { key: playbackKey, mimeType: 'audio/mp4' };
    }

    let inFlight = this.playbackTranscodeLocks.get(playbackKey);
    if (!inFlight) {
      inFlight = this.createPlaybackAsset(original.key, playbackKey);
      this.playbackTranscodeLocks.set(playbackKey, inFlight);
      inFlight.finally(() => {
        this.playbackTranscodeLocks.delete(playbackKey);
      });
    }
    return inFlight;
  }

  private async createPlaybackAsset(
    sourceKey: string,
    playbackKey: string,
  ): Promise<{ key: string; mimeType: string }> {
    const sourceBuffer = await this.loadAudioBuffer(sourceKey);
    const transcoded = await this.audioTranscode.transcodeWebmToM4a(sourceBuffer);
    await this.persistPlaybackBuffer(playbackKey, transcoded);
    return { key: playbackKey, mimeType: 'audio/mp4' };
  }

  private async playbackAssetExists(key: string): Promise<boolean> {
    if (this.recordingsUseObjectStorage()) {
      try {
        await this.s3Upload.headObject(key);
        return true;
      } catch {
        return false;
      }
    }
    return existsSync(join(this.uploadRoot, key));
  }

  private async persistPlaybackBuffer(key: string, buffer: Buffer): Promise<void> {
    if (this.recordingsUseObjectStorage()) {
      await this.s3Upload.putObject(key, buffer, 'audio/mp4');
      return;
    }

    const target = join(this.uploadRoot, key);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buffer);
  }

  private async resolveRecordingAsset(
    tenantId: string,
    meetingId: string,
  ): Promise<{ key: string; mimeType: string }> {
    const meeting = await (this.prisma.meeting.findFirst as (args: unknown) => Promise<MeetingRow | null>)({
      where: { id: meetingId, tenantId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const key = (meeting as MeetingRow).audioStorageKey;
    if (!key) throw new NotFoundException('No audio recording available for this meeting');

    const ext = extname(key).replace('.', '') || 'webm';
    const mimeType =
      ext === 'mp4' || ext === 'mov'
        ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
        : ext === 'webm' && key.includes('video')
          ? 'video/webm'
          : `audio/${ext}`;

    return { key, mimeType };
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
            content: MEETING_NOTES_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildMeetingNotesUserPrompt((meeting as MeetingRow).title, transcriptText),
          },
        ],
        maxTokens: 1200,
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
