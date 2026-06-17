import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingAccessService } from './meeting-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { JobsService } from '@/jobs/jobs.service';

const mockPrisma = {
  meeting: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  meetingTranscript: { create: jest.fn() },
  meetingNote: { create: jest.fn() },
  matter: { findFirst: jest.fn() },
};

const mockS3 = {
  isConfigured: jest.fn().mockReturnValue(false),
  putObject: jest.fn(),
};

const mockJobs = {
  enqueueMeetingTranscribeJob: jest.fn().mockResolvedValue({ agentJobId: 'job-1', status: 'QUEUED', queue: 'ai.low_priority' }),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'S3_PROVIDER') return 'local';
    if (key === 'UPLOAD_DIR') return '/tmp/test-uploads';
    return fallback;
  }),
};

describe('MeetingsService', () => {
  let service: MeetingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MeetingsService,
        MeetingAccessService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3UploadService, useValue: mockS3 },
        { provide: JobsService, useValue: mockJobs },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(MeetingsService);
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────────────────────

  it('persists confidentiality and clientId on create', async () => {
    mockPrisma.meeting.create.mockResolvedValue({
      id: 'meeting-1',
      tenantId: 'tenant-1',
      matterId: null,
      clientId: 'client-1',
      createdByUserId: 'user-1',
      title: 'Test Meeting',
      status: 'recording',
      source: 'manual_recording',
      confidentiality: 'restricted',
      participants: ['alice@example.com'],
      scheduledAt: new Date(),
      durationMin: null,
      durationMs: null,
      audioStorageKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      transcripts: [],
      notes: [],
      matter: null,
    });

    const result = await service.create(
      'tenant-1',
      {
        title: 'Test Meeting',
        clientId: 'client-1',
        confidentiality: 'restricted',
        participants: ['alice@example.com'],
      },
      'user-1',
    );

    expect(result.confidentiality).toBe('restricted');
    expect(result.clientId).toBe('client-1');
    expect(result.createdByUserId).toBe('user-1');
    expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confidentiality: 'restricted',
          clientId: 'client-1',
          createdByUserId: 'user-1',
        }),
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────
  // processAudio — enqueues transcription job
  // ──────────────────────────────────────────────────────────────

  it('processAudio sets status to processing and enqueues a MEETING_TRANSCRIBE job', async () => {
    mockPrisma.meeting.findFirst.mockResolvedValue({
      id: 'meeting-1',
      tenantId: 'tenant-1',
      status: 'recording',
      confidentiality: 'standard',
      createdByUserId: 'user-1',
    });
    mockPrisma.meeting.update.mockResolvedValue({});

    const audioBuffer = Buffer.from('fake-audio-data');
    const result = await service.processAudio(
      'tenant-1',
      'meeting-1',
      audioBuffer,
      'audio/webm',
      12000,
      'user-1',
    );

    expect(result.status).toBe('processing');
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'processing' }),
      }),
    );
    expect(mockJobs.enqueueMeetingTranscribeJob).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: 'meeting-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        mimeType: 'audio/webm',
        durationMs: 12000,
      }),
    );
  });

  it('processAudio throws NotFoundException when meeting does not exist', async () => {
    mockPrisma.meeting.findFirst.mockResolvedValue(null);

    await expect(
      service.processAudio('tenant-1', 'nonexistent', Buffer.from(''), 'audio/webm', 0, 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────────────────────
  // getLatestTranscript
  // ──────────────────────────────────────────────────────────────

  it('getLatestTranscript returns null when no transcript exists', async () => {
    mockPrisma.meeting.findFirst.mockResolvedValue({
      id: 'meeting-1',
      transcripts: [],
    });

    const result = await service.getLatestTranscript('tenant-1', 'meeting-1');
    expect(result).toBeNull();
  });

  it('getLatestTranscript returns rawText from the latest transcript', async () => {
    mockPrisma.meeting.findFirst.mockResolvedValue({
      id: 'meeting-1',
      transcripts: [
        { id: 'tx-1', meetingId: 'meeting-1', content: 'Hello world', createdAt: new Date() },
      ],
    });

    const result = await service.getLatestTranscript('tenant-1', 'meeting-1');
    expect(result).not.toBeNull();
    expect(result!.rawText).toBe('Hello world');
    expect(result!.segments).toEqual([]);
  });

  // ──────────────────────────────────────────────────────────────
  // findAll filters confidential meetings via MeetingAccessService
  // ──────────────────────────────────────────────────────────────

  it('findAll excludes restricted meetings from unauthorized callers', async () => {
    mockPrisma.meeting.findMany.mockResolvedValue([
      {
        id: 'a', tenantId: 't', matterId: null, clientId: null, createdByUserId: 'creator',
        title: 'Open', status: 'ready', source: 'upload', confidentiality: 'standard',
        participants: [], scheduledAt: null, durationMin: null, durationMs: null,
        audioStorageKey: null, createdAt: new Date(), updatedAt: new Date(), transcripts: [], notes: [], matter: null,
        visibilityAllowListUserIds: null,
      },
      {
        id: 'b', tenantId: 't', matterId: null, clientId: null, createdByUserId: 'creator',
        title: 'Secret', status: 'ready', source: 'upload', confidentiality: 'restricted',
        participants: [], scheduledAt: null, durationMin: null, durationMs: null,
        audioStorageKey: null, createdAt: new Date(), updatedAt: new Date(), transcripts: [], notes: [], matter: null,
        visibilityAllowListUserIds: null,
      },
    ]);

    const results = await service.findAll('t', {}, 'some-associate', 'ASSOCIATE');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
  });
});
