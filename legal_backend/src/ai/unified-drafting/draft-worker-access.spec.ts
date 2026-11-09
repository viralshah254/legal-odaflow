import { ForbiddenException } from '@nestjs/common';
import { DraftWorkerProcessor } from './draft-worker.processor';

describe('queued draft authorization at execution time', () => {
  const payload = { jobId: 'j', tenantId: 'firm', userId: 'alice', matterId: 'matter', documentKind: 'india_regular_bail_bnss_480', jurisdiction: 'IN', facts: 'Fictional supplied facts', qualityTier: 'standard' };
  function setup() {
    const worker = Object.create(DraftWorkerProcessor.prototype) as any;
    worker.access = { assertActiveMember: jest.fn().mockResolvedValue({ tenantId: 'firm', userId: 'alice', tenantRole: 'FIRM_ADMIN' }), assertMatterReadable: jest.fn() };
    worker.prisma = { draftJob: { findFirst: jest.fn().mockResolvedValue(null) } };
    worker.normalization = { normalize: jest.fn() };
    worker.jobService = { advanceStage: jest.fn() };
    return worker;
  }
  it('stops a suspended user before loading cached context or calling a model', async () => {
    const worker = setup();
    worker.access.assertActiveMember.mockRejectedValue(new ForbiddenException('Membership revoked'));
    await expect(worker.runPipeline(payload, Date.now())).rejects.toThrow('Membership revoked');
    expect(worker.prisma.draftJob.findFirst).not.toHaveBeenCalled();
    expect(worker.normalization.normalize).not.toHaveBeenCalled();
  });
  it('rechecks walls even when an administrator queued the job earlier', async () => {
    const worker = setup();
    worker.access.assertMatterReadable.mockRejectedValue(new ForbiddenException('Wall added'));
    await expect(worker.runPipeline(payload, Date.now())).rejects.toThrow('Wall added');
    expect(worker.prisma.draftJob.findFirst).not.toHaveBeenCalled();
    expect(worker.normalization.normalize).not.toHaveBeenCalled();
  });
  it('rejects a queue payload that does not match the persisted job', async () => {
    const worker = setup();
    worker.prisma.draftJob.findFirst.mockResolvedValue({ matterId: 'other-matter' });
    await expect(worker.runPipeline(payload, Date.now())).rejects.toThrow('actor or matter mismatch');
    expect(worker.jobService.advanceStage).not.toHaveBeenCalled();
    expect(worker.normalization.normalize).not.toHaveBeenCalled();
  });
});
