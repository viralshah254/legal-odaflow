import { BadRequestException } from '@nestjs/common';
import { KenyaIngestOpsService } from './kenya-ingest-ops.service';
import { LEGAL_INGEST_JOB_TYPES } from '@/jobs/jobs.constants';

describe('KenyaIngestOpsService', () => {
  const jobsService = {
    enqueueLegalIngestJob: jest
      .fn()
      .mockResolvedValue({ agentJobId: 'job-1', queue: 'legal.ingest', status: 'QUEUED' }),
  };
  const sourcePolicies = {
    seedDefaults: jest.fn().mockResolvedValue(undefined),
    assertFetchAllowed: jest.fn().mockResolvedValue({ id: 'policy-1' }),
    listPolicies: jest.fn().mockResolvedValue([
      {
        sourceKey: 'KENYA_LAW',
        displayName: 'Kenya Law',
        enabled: false,
        productionApproved: false,
        emergencyDisabledAt: null,
        lastReviewedAt: null,
      },
    ]),
    getManifestIngestCursor: jest.fn().mockResolvedValue(3),
    setManifestIngestCursor: jest.fn().mockResolvedValue(undefined),
    setEnabled: jest.fn().mockResolvedValue(undefined),
  };
  const statuteIngest = {
    getIngestStatus: jest.fn().mockResolvedValue({
      acts: [
        { actId: 'a1', sectionCount: 5, meetsTier1Threshold: true },
        { actId: 'a2', sectionCount: 0, meetsTier1Threshold: false },
      ],
    }),
    ingestKeManifestAct: jest.fn().mockResolvedValue({
      countryCode: 'KE',
      actId: 'a1',
      sectionsUpserted: 2,
      chunksStored: 2,
      connectorHits: 2,
      errors: [],
    }),
  };
  const legalSourceService = {
    syncKenyaCaseLaw: jest.fn().mockResolvedValue({ processed: 1, ingested: 1, skipped: 0, errors: [] }),
  };
  const legalCorpusRegistry = {
    markSupersededKenyaExpressions: jest.fn().mockResolvedValue(1),
  };
  const prisma = {
    legalSource: {
      findFirst: jest.fn().mockResolvedValue({ lastSyncedAt: new Date('2026-07-01T00:00:00.000Z') }),
    },
    legalAuthority: {
      count: jest.fn().mockResolvedValue(12),
      groupBy: jest.fn().mockResolvedValue([
        { court: 'KEELRC', _count: { id: 5 } },
        { court: 'KESC', _count: { id: 3 } },
      ]),
    },
  };

  const service = new KenyaIngestOpsService(
    prisma as never,
    jobsService as never,
    sourcePolicies as never,
    statuteIngest as never,
    legalSourceService as never,
    {} as never,
    { isEnabled: () => false, buildManifestEntries: jest.fn() } as never,
    { listArchivePage: jest.fn().mockResolvedValue([{ title: 'Gazette', sourceUrl: 'https://example.test' }]) } as never,
    { discover: jest.fn().mockResolvedValue([{ title: 'County act', sourceUrl: 'https://example.test/county' }]) } as never,
    legalCorpusRegistry as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns operational status with manifest coverage and cursor', async () => {
    jest.spyOn(require('./ke-manifest.loader'), 'keManifestExists').mockReturnValue(true);
    jest.spyOn(require('./ke-manifest.loader'), 'loadKeSourcesManifest').mockReturnValue({
      source: 'kenyalaw.org',
      builtAt: '2026-06-29T00:00:00.000Z',
      acts: [{ actId: 'a1' }, { actId: 'a2' }],
    });

    const status = await service.getOperationalStatus();
    expect(status.manifest.entryCount).toBe(2);
    expect(status.coverage.actsWithSections).toBe(1);
    expect(status.ingestCursor).toBe(3);
  });

  it('enqueues resumable manifest batch ingest jobs', async () => {
    await service.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_BATCH_INGEST, {
      manifestCursor: 10,
      batchSize: 4,
    });

    expect(jobsService.enqueueLegalIngestJob).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'KE',
        jobType: LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_BATCH_INGEST,
        manifestCursor: 10,
        batchSize: 4,
      }),
    );
  });

  it('validates extended collection names', () => {
    expect(service.parseExtendedCollection('county_law')).toBe('COUNTY_LAW');
    expect(() => service.parseExtendedCollection('invalid')).toThrow(BadRequestException);
  });

  it('pauses and resumes source policies', async () => {
    await service.pauseSource('KENYA_LAW');
    await service.resumeSource('KENYA_GAZETTE');

    expect(sourcePolicies.setEnabled).toHaveBeenNthCalledWith(1, 'KENYA_LAW', false);
    expect(sourcePolicies.setEnabled).toHaveBeenNthCalledWith(2, 'KENYA_GAZETTE', true, {
      clearEmergency: true,
    });
  });

  it('diffs manifest changes and re-ingests updated works', async () => {
    const kenyaCatalog = {
      buildManifestEntries: jest.fn().mockResolvedValue([
        {
          actId: 'ke-act-2015-17',
          title: 'Companies Act',
          workFrbrUri: 'akn/ke/act/2015/17',
          expressionFrbrUri: 'akn/ke/act/2015/17/eng@2024-12-27',
          publicUrl: 'https://new.kenyalaw.org/akn/ke/act/2015/17/eng@2024-12-27',
          nature: 'act',
        },
      ]),
    };
    const changeService = new KenyaIngestOpsService(
      prisma as never,
      jobsService as never,
      sourcePolicies as never,
      statuteIngest as never,
      legalSourceService as never,
      kenyaCatalog as never,
      { isEnabled: () => false } as never,
      { listArchivePage: jest.fn() } as never,
      { discover: jest.fn() } as never,
      legalCorpusRegistry as never,
    );

    jest.spyOn(require('./ke-manifest.loader'), 'keManifestExists').mockReturnValue(true);
    jest.spyOn(require('./ke-manifest.loader'), 'loadKeSourcesManifest').mockReturnValue({
      countryCode: 'KE',
      source: 'kenyalaw.org',
      builtAt: '2026-01-01T00:00:00.000Z',
      placeCode: 'ke',
      acts: [
        {
          actId: 'ke-act-2015-17',
          title: 'Companies Act',
          workFrbrUri: 'akn/ke/act/2015/17',
          expressionFrbrUri: 'akn/ke/act/2015/17/eng@2022-12-31',
          publicUrl: 'https://new.kenyalaw.org/akn/ke/act/2015/17/eng@2022-12-31',
          nature: 'act',
        },
      ],
    });
    jest.spyOn(require('./ke-manifest.loader'), 'keManifestPath').mockReturnValue('/tmp/ke-manifest.json');

    const result = await changeService.runManifestChangeSync({ reingest: true });

    expect(result.updatedWorks).toBe(1);
    expect(result.reingested).toBe(1);
    expect(legalCorpusRegistry.markSupersededKenyaExpressions).toHaveBeenCalledWith(
      'akn/ke/act/2015/17',
      'akn/ke/act/2015/17/eng@2024-12-27',
    );
    expect(statuteIngest.ingestKeManifestAct).toHaveBeenCalledWith(
      expect.objectContaining({ expressionFrbrUri: 'akn/ke/act/2015/17/eng@2024-12-27' }),
      { forceReindex: true },
    );
  });
});
