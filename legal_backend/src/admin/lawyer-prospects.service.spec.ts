import { BadRequestException, ConflictException } from '@nestjs/common';
import { LawyerProspectsService } from './lawyer-prospects.service';

function createService() {
  const prisma = {
    lawyerProspect: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    prospectImportRun: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  const config = { get: jest.fn() };
  const service = new LawyerProspectsService(prisma as never, config as never);
  return { service, prisma };
}

describe('LawyerProspectsService.createManualProspect', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requires organisation for firm prospects', async () => {
    const { service } = createService();

    await expect(
      service.createManualProspect({
        fullName: 'Rohit Sharma',
        practiceType: 'FIRM',
        phone: '+919422314120',
        email: 'rohit@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid India phone numbers', async () => {
    const { service } = createService();

    await expect(
      service.createManualProspect({
        fullName: 'Rohit Sharma',
        practiceType: 'SOLO',
        phone: '123',
        email: 'rohit@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates an existing prospect by email', async () => {
    const { service, prisma } = createService();
    const existing = {
      id: 'existing-id',
      dedupeKey: 'old-key',
      outreachStatus: 'CONTACTED',
    };

    prisma.lawyerProspect.findFirst.mockResolvedValue(existing);
    prisma.lawyerProspect.findUnique.mockResolvedValue(null);
    prisma.lawyerProspect.update.mockResolvedValue({
      ...existing,
      fullName: 'Rohit Sharma',
      email: 'rohit@example.com',
    });

    const result = await service.createManualProspect({
      fullName: 'rohit sharma',
      practiceType: 'FIRM',
      organisation: 'Shende Advocates',
      phone: '+919422314120',
      email: 'rohit@example.com',
      state: 'Gujarat',
      city: 'Ahmedabad',
    });

    expect(prisma.lawyerProspect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-id' },
        data: expect.objectContaining({
          fullName: 'Rohit Sharma',
          firstName: 'Rohit',
          lastName: 'Sharma',
          organisation: 'Shende Advocates',
          email: 'rohit@example.com',
          source: 'manual',
        }),
      }),
    );
    expect(result.action).toBe('updated');
  });

  it('accepts international E.164 phone numbers for non-India countries', async () => {
    const { service, prisma } = createService();
    const prospect = {
      id: 'prospect-us',
      dedupeKey: 'abc123',
      country: 'United States',
      phone: '+14155552671',
    };

    prisma.lawyerProspect.findFirst.mockResolvedValue(null);
    prisma.lawyerProspect.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(prospect);
    prisma.prospectImportRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.lawyerProspect.create.mockResolvedValue(prospect);

    const result = await service.createManualProspect({
      fullName: 'Jane Doe',
      practiceType: 'SOLO',
      phone: '+14155552671',
      email: 'jane@example.com',
      countryCode: 'US',
      state: 'California',
      city: 'San Francisco',
    });

    expect(result.action).toBe('inserted');
    expect(prisma.lawyerProspect.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          country: 'United States',
          phone: '+14155552671',
          source: 'manual',
        }),
      }),
    );
  });

  it('throws when email update would collide on dedupe key', async () => {
    const { service, prisma } = createService();

    prisma.lawyerProspect.findFirst.mockResolvedValue({ id: 'existing-id' });
    prisma.lawyerProspect.findUnique.mockResolvedValue({ id: 'other-id' });

    await expect(
      service.createManualProspect({
        fullName: 'Rohit Sharma',
        practiceType: 'SOLO',
        phone: '+919422314120',
        email: 'rohit@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
