jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
}));

import { BadRequestException } from '@nestjs/common';
import { DraftJobService } from '@/ai/unified-drafting/draft-job.service';

describe('DraftJobService result persistence', () => {
  const prisma = {
    draftJob: {
      findFirst: jest.fn(),
    },
  };
  const config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
  const service = new DraftJobService(prisma as never, config as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the durable CourtDraftRecord id as draftId', async () => {
    prisma.draftJob.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'ready',
      courtDraftRecordId: 'draft-1',
      assembledDraftJson: { fullText: 'Draft' },
      verificationReportJson: null,
      sections: [],
      issues: [],
      actualCostUsd: 1,
      completedAt: new Date('2026-07-27T00:00:00.000Z'),
    });

    await expect(service.getResult('job-1', 'tenant-1')).resolves.toEqual(
      expect.objectContaining({
        jobId: 'job-1',
        draftId: 'draft-1',
        courtDraftRecordId: 'draft-1',
      }),
    );
  });

  it('does not expose a ready result without a durable draft record', async () => {
    prisma.draftJob.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'ready',
      courtDraftRecordId: null,
      sections: [],
      issues: [],
    });

    await expect(service.getResult('job-1', 'tenant-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
