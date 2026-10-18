import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';

describe('CourtDraftHistoryService', () => {
  const prisma = {
    courtDraftRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    draftJob: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new CourtDraftHistoryService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildTitle uses parties when available', () => {
    expect(
      service.buildTitle({
        label: 'Criminal Appeal',
        kind: 'india_criminal_appeal',
        clientName: 'Ram',
        opposingParty: 'Ria',
      }),
    ).toBe('Criminal Appeal — Ram v. Ria');
  });

  it('save persists draft record', async () => {
    const now = new Date();
    prisma.courtDraftRecord.create.mockResolvedValue({
      id: 'draft-1',
      title: 'Revision — Ram v. Ria',
      draftText: 'IN THE HIGH COURT...',
      kind: 'india_maintenance_order_revision',
      label: null,
      countryCode: 'IN',
      category: null,
      source: 'india',
      creditsUsed: 15,
      requiresLawyerReview: false,
      verificationStatus: 'verified',
      createdAt: now,
      updatedAt: now,
    });

    const item = await service.save({
      tenantId: 't1',
      userId: 'u1',
      source: 'india',
      kind: 'india_maintenance_order_revision',
      countryCode: 'IN',
      draftText: 'IN THE HIGH COURT...',
      clientName: 'Ram',
      opposingParty: 'Ria',
      creditsUsed: 15,
    });

    expect(prisma.courtDraftRecord.create).toHaveBeenCalled();
    expect(item.id).toBe('draft-1');
    expect(item.preview).toContain('IN THE HIGH COURT');
  });

  it('linkToClient resolves unified DraftJob id via existing courtDraftRecordId', async () => {
    prisma.courtDraftRecord.findFirst.mockResolvedValueOnce(null);
    prisma.draftJob.findFirst.mockResolvedValueOnce({
      id: 'job-1',
      courtDraftRecordId: 'draft-2',
      status: 'ready',
    });
    prisma.courtDraftRecord.update.mockResolvedValue({
      clientId: 'client-1',
      linkedClientName: 'Acme Corp',
      matterId: 'matter-1',
    });

    const result = await service.linkToClient('job-1', 't1', 'u1', {
      clientId: 'client-1',
      matterId: 'matter-1',
      clientName: 'Acme Corp',
    });

    expect(result.success).toBe(true);
    expect(result.clientId).toBe('client-1');
    expect(result.clientName).toBe('Acme Corp');
    expect(result.matterId).toBe('matter-1');
    expect(prisma.courtDraftRecord.update).toHaveBeenCalledWith({
      where: { id: 'draft-2' },
      data: {
        clientId: 'client-1',
        matterId: 'matter-1',
        linkedClientName: 'Acme Corp',
      },
      select: {
        clientId: true,
        linkedClientName: true,
        matterId: true,
      },
    });
  });

  it('updates an existing CourtDraftRecord when a unified job completes again', async () => {
    prisma.draftJob.findFirst.mockResolvedValue({
      courtDraftRecordId: 'draft-2',
    });
    prisma.courtDraftRecord.update.mockResolvedValue({});

    const id = await service.persistFromUnifiedJob({
      jobId: 'job-1',
      tenantId: 't1',
      userId: 'u1',
      documentKind: 'india_criminal_appeal',
      caseDetails: 'Updated facts',
      clientName: 'Ram',
      opposingParty: 'State',
      draftText: 'Updated durable draft',
      creditsUsed: 22,
    });

    expect(id).toBe('draft-2');
    expect(prisma.courtDraftRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'draft-2' },
        data: expect.objectContaining({
          draftText: 'Updated durable draft',
          creditsUsed: 22,
          caseDetails: 'Updated facts',
        }),
      }),
    );
  });

  it('getById returns full draft text for reopen', async () => {
    const now = new Date();
    prisma.courtDraftRecord.findFirst.mockResolvedValue({
      id: 'draft-1',
      title: 'Test',
      draftText: 'Full draft body',
      kind: 'india_criminal_appeal',
      label: 'Appeal',
      subtitle: null,
      countryCode: 'IN',
      category: 'Criminal',
      source: 'india',
      jurisdiction: 'GJ',
      language: 'en',
      caseDetails: 'Ram vs Ria',
      clientName: 'Ram',
      courtName: 'Gujarat HC',
      opposingParty: 'Ria',
      creditsUsed: 15,
      requiresLawyerReview: false,
      verificationStatus: 'verified',
      verificationAudit: null,
      createdAt: now,
      updatedAt: now,
    });

    const full = await service.getById('draft-1', 't1', 'u1');
    expect(full.draftText).toBe('Full draft body');
    expect(full.caseDetails).toBe('Ram vs Ria');
  });
});
