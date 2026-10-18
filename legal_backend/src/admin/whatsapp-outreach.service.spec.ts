import { BadRequestException } from '@nestjs/common';

const mockClose = jest.fn().mockResolvedValue(undefined);
const mockAddBulk = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    addBulk: mockAddBulk,
    close: mockClose,
    getJobs: jest.fn().mockResolvedValue([]),
  })),
}));

import { WhatsappOutreachService } from './whatsapp-outreach.service';

type MockProspect = {
  id: string;
  whatsapp: string | null;
  phone: string | null;
  firstName: string | null;
  fullName: string;
  city: string | null;
};

function createService() {
  const prisma = {
    lawyerProspect: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    subscription: { findMany: jest.fn() },
    tenantUser: { findMany: jest.fn() },
    whatsappCampaign: { create: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
  const service = new WhatsappOutreachService(prisma as never, config as never);
  return { service, prisma };
}

describe('WhatsappOutreachService', () => {
  afterEach(async () => {
    mockAddBulk.mockClear();
    mockClose.mockClear();
  });

  it('createCampaign testOnly queries isTest prospects and skips bulk filters', async () => {
    const { service, prisma } = createService();
    const prospects: MockProspect[] = [
      {
        id: 'cm7test25473826697300001',
        whatsapp: '+254738266973',
        phone: null,
        firstName: 'Test',
        fullName: 'Test User (Admin)',
        city: 'Ahmedabad',
      },
    ];
    prisma.lawyerProspect.findMany.mockResolvedValue(prospects);
    prisma.whatsappCampaign.create.mockResolvedValue({
      id: 'camp1',
      name: 'Test',
      status: 'RUNNING',
      totalQueued: 1,
      messages: [{ id: 'msg1', prospectId: prospects[0].id, to: '+254738266973' }],
    });

    const result = await service.createCampaign({
      name: 'Test send',
      templateName: 'umbrella_english',
      testOnly: true,
      testProspectIds: ['cm7test25473826697300001'],
    });

    expect(prisma.lawyerProspect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isTest: true,
          id: { in: ['cm7test25473826697300001'] },
        }),
      }),
    );
    expect(mockAddBulk).toHaveBeenCalled();
    expect(result.totalQueued).toBe(1);
  });

  it('createCampaign testOnly throws when no prospects match', async () => {
    const { service, prisma } = createService();
    prisma.lawyerProspect.findMany.mockResolvedValue([]);

    await expect(
      service.createCampaign({
        name: 'Empty test',
        templateName: 'umbrella_english',
        testOnly: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createCampaign bulk mode excludes isTest prospects', async () => {
    const { service, prisma } = createService();
    prisma.lawyerProspect.findMany.mockResolvedValue([]);

    await expect(
      service.createCampaign({
        name: 'Wave 1',
        templateName: 'umbrella_english',
        country: 'India',
        cities: ['Bangalore', 'Ahmedabad'],
        whatsappConfidence: 'verified',
        limit: 250,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.lawyerProspect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isTest: false }),
      }),
    );
  });
});
