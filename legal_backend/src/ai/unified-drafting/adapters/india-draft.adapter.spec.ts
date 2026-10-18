import { IndiaDraftAdapter } from './india-draft.adapter';
import type { DraftJobService } from '../draft-job.service';
import { RIYA_INTAKE } from '@/ai/drafting/accuracy/riya-intake.fixture';

describe('IndiaDraftAdapter', () => {
  it('forwards confirmedCaseRecord and accuracyMode to DraftJobService.create', async () => {
    const create = jest.fn().mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
      estimatedCredits: 10,
    });
    const adapter = new IndiaDraftAdapter({ create } as unknown as DraftJobService);

    const caseRecord = {
      parties: [{ role: 'Complainant', name: 'Riya Desai' }],
      metadata: { caseRecordId: 'cr-1', version: 1 },
    };

    await adapter.createJob(
      {
        kind: 'india_consumer_complaint',
        caseDetails: 'facts…',
        confirmedCaseRecord: caseRecord,
        accuracyMode: 'balanced',
        bundleMode: true,
        bundleIndex: 1,
      } as any,
      { tenantId: 't1', userId: 'u1' } as any,
    );

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.confirmedCaseRecord).toEqual(caseRecord);
    expect(arg.accuracyMode).toBe('balanced');
    expect(arg.bundleMode).toBe(true);
    expect(arg.bundleIndex).toBe(1);
    expect(arg.documentKind).toBe('india_consumer_complaint');
  });

  it('remaps bundle Doc 1 research memo to consumer variant for medical intake', async () => {
    const create = jest.fn().mockResolvedValue({
      jobId: 'job-2',
      status: 'queued',
      estimatedCredits: 10,
    });
    const adapter = new IndiaDraftAdapter({ create } as unknown as DraftJobService);

    await adapter.createJob(
      {
        kind: 'india_legal_research_memo',
        caseDetails: RIYA_INTAKE,
        bundleMode: true,
        bundleIndex: 0,
      } as any,
      { tenantId: 't1', userId: 'u1' } as any,
    );

    expect(create.mock.calls[0][0].documentKind).toBe('india_consumer_research_memo');
  });
});
