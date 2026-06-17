import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MeetingsService } from './meetings.service';
import { MeetingAccessService } from './meeting-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import { S3UploadService } from '@/storage/s3-upload.service';
import { JobsService } from '@/jobs/jobs.service';

const mockPrisma = {
  meeting: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  matter: { findFirst: jest.fn() },
};

const mockS3 = { isConfigured: jest.fn().mockReturnValue(false), putObject: jest.fn() };
const mockJobs = { enqueueMeetingTranscribeJob: jest.fn() };
const mockConfig = { get: jest.fn((key: string, fallback?: unknown) => fallback) };

describe('MeetingsService.findAll clientId filter', () => {
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
    mockPrisma.meeting.findMany.mockResolvedValue([]);
  });

  it('filters meetings by direct clientId column', async () => {
    await service.findAll('tenant-1', { clientId: 'client-xyz' });

    expect(mockPrisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          clientId: 'client-xyz',
        }),
      }),
    );
  });

  it('filters by matterId when provided', async () => {
    await service.findAll('tenant-1', { matterId: 'matter-1' });

    expect(mockPrisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ matterId: 'matter-1' }),
      }),
    );
  });
});
