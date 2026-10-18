import { ResearchRetrievalGapService } from './research-retrieval-gap.service';

describe('ResearchRetrievalGapService', () => {
  const prisma = {
    researchRetrievalGap: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    legalAuthority: { findMany: jest.fn() },
  };
  const jobs = { enqueueLegalIngestJob: jest.fn() };
  const service = new ResearchRetrievalGapService(prisma as never, jobs as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.researchRetrievalGap.upsert.mockResolvedValue({ id: 'gap-1' });
  });

  it('deduplicates identical gaps within one research run', async () => {
    await service.recordPipelineGaps({
      query: 'What does section 10 provide?',
      countryCode: 'in',
      rejectedCandidates: [
        {
          authorityId: 'statute-in-demo-act-s10',
          gate: 'heading_only_statute',
          reason: 'stub',
        },
        {
          authorityId: 'statute-in-demo-act-s10',
          gate: 'heading_only_statute',
          reason: 'stub',
        },
      ],
    });

    expect(prisma.researchRetrievalGap.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.researchRetrievalGap.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          countryCode: 'IN',
          gapType: 'stub_text',
          expectedAuthority: 'statute-in-demo-act-s10',
        }),
        update: expect.objectContaining({ occurrenceCount: { increment: 1 } }),
      }),
    );
  });

  it('queues a real act ingest only when an act identifier is present', async () => {
    prisma.researchRetrievalGap.findUnique.mockResolvedValue({
      id: 'gap-1',
      countryCode: 'IN',
      gapType: 'stub_text',
      expectedAuthority: 'BNSS section 10',
      detail: { actId: 'bnss', section: '10' },
    });
    jobs.enqueueLegalIngestJob.mockResolvedValue({
      agentJobId: 'job-1',
      status: 'QUEUED',
    });

    await expect(service.triggerIngest('gap-1')).resolves.toEqual(
      expect.objectContaining({ ok: true, state: 'queued', agentJobId: 'job-1' }),
    );
    expect(jobs.enqueueLegalIngestJob).toHaveBeenCalledWith(
      expect.objectContaining({ actId: 'bnss', jobType: 'STATUTE_ACT_INGEST' }),
    );
  });

  it('does not enqueue an unregistered act identifier from gap metadata', async () => {
    prisma.researchRetrievalGap.findUnique.mockResolvedValue({
      id: 'gap-unsafe',
      countryCode: 'IN',
      gapType: 'stub_text',
      expectedAuthority: 'Untrusted act section 10',
      detail: { actId: '../../untrusted', section: '10' },
    });

    await expect(service.triggerIngest('gap-unsafe')).resolves.toEqual(
      expect.objectContaining({ ok: false, state: 'manual_required' }),
    );
    expect(jobs.enqueueLegalIngestJob).not.toHaveBeenCalled();
  });

  it('fails open when persistence is unavailable during research', async () => {
    prisma.researchRetrievalGap.upsert.mockRejectedValueOnce(new Error('table unavailable'));

    await expect(
      service.recordPipelineGaps({
        query: 'What does BNSS section 10 provide?',
        countryCode: 'IN',
        requestedSection: { actId: 'bnss', section: '10' },
        exactSectionFound: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('returns manual remediation instead of claiming success for ambiguous gaps', async () => {
    prisma.researchRetrievalGap.findUnique.mockResolvedValue({
      id: 'gap-2',
      countryCode: 'IN',
      gapType: 'citation_metadata',
      expectedAuthority: 'Unknown citation',
      detail: {},
    });

    await expect(service.triggerIngest('gap-2')).resolves.toEqual(
      expect.objectContaining({ ok: false, state: 'manual_required' }),
    );
    expect(jobs.enqueueLegalIngestJob).not.toHaveBeenCalled();
  });
});
