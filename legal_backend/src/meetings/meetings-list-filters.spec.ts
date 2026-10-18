import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MeetingsService } from './meetings.service';
import { MeetingAccessService } from './meeting-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { JobsService } from '@/jobs/jobs.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { JwtService } from '@nestjs/jwt';
import { AudioTranscodeService } from './audio-transcode.service';

const mockPrisma = {
  meeting: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  matter: { findFirst: jest.fn() },
};

const mockS3 = { isConfigured: jest.fn().mockReturnValue(false), putObject: jest.fn() };
const mockJobs = { enqueueMeetingTranscribeJob: jest.fn() };
const mockConfig = { get: jest.fn((key: string, fallback?: unknown) => fallback) };
const mockLlm = {};
const mockJwt = { sign: jest.fn() };
const mockAudioTranscode = { transcodeWebmToM4a: jest.fn() };

describe('MeetingsService.findAllPaginated', () => {
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
        { provide: LlmCompletionService, useValue: mockLlm },
        { provide: JwtService, useValue: mockJwt },
        { provide: AudioTranscodeService, useValue: mockAudioTranscode },
      ],
    }).compile();

    service = module.get(MeetingsService);
    jest.clearAllMocks();
    mockPrisma.meeting.findMany.mockResolvedValue([]);
    mockPrisma.meeting.count.mockResolvedValue(0);
  });

  it('filters meetings by direct clientId column', async () => {
    await service.findAllPaginated('tenant-1', { clientId: 'client-xyz', page: 1, limit: 20 });

    expect(mockPrisma.meeting.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ tenantId: 'tenant-1' }),
            expect.objectContaining({ clientId: 'client-xyz' }),
          ]),
        }),
      }),
    );
  });

  it('filters by matterId when provided', async () => {
    await service.findAllPaginated('tenant-1', { matterId: 'matter-1', page: 1, limit: 20 });

    expect(mockPrisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ matterId: 'matter-1' }),
          ]),
        }),
      }),
    );
  });

  it('applies search, status, and date filters', async () => {
    await service.findAllPaginated('tenant-1', {
      search: 'client call',
      status: 'ready',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-24',
      page: 2,
      limit: 10,
    });

    expect(mockPrisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  title: { contains: 'client call', mode: 'insensitive' },
                }),
              ]),
            }),
            expect.objectContaining({
              status: { in: expect.arrayContaining(['ready', 'READY']) },
            }),
            expect.objectContaining({
              createdAt: expect.objectContaining({
                gte: new Date('2026-06-01T00:00:00.000Z'),
                lte: new Date('2026-06-24T23:59:59.999Z'),
              }),
            }),
          ]),
        }),
      }),
    );
  });
});
