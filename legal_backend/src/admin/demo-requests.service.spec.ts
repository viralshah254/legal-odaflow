import { BadRequestException } from '@nestjs/common';
import { DemoRequestsService } from './demo-requests.service';

function createService() {
  const prisma = {
    demoRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new DemoRequestsService(prisma as never);
  return { service, prisma };
}

describe('DemoRequestsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('persists a normalized marketing demo request', async () => {
    const { service, prisma } = createService();
    const created = {
      id: 'demo-1',
      contactName: 'Priya Sharma',
      email: 'priya@example.com',
      companyName: 'Sharma & Associates',
      status: 'NEW',
    };
    prisma.demoRequest.findFirst.mockResolvedValue(null);
    prisma.demoRequest.create.mockResolvedValue(created);

    await expect(
      service.create({
        contactName: '  Priya Sharma  ',
        email: '  PRIYA@EXAMPLE.COM ',
        companyName: '  Sharma & Associates ',
        phone: '  +91 98765 43210 ',
        countryCode: 'in',
        source: 'demo_page',
      }),
    ).resolves.toEqual(created);

    expect(prisma.demoRequest.create).toHaveBeenCalledWith({
      data: {
        contactName: 'Priya Sharma',
        email: 'priya@example.com',
        companyName: 'Sharma & Associates',
        phone: '+91 98765 43210',
        jobTitle: null,
        firmSize: null,
        countryCode: 'IN',
        message: null,
        source: 'demo_page',
      },
    });
  });

  it('prevents duplicate requests from the same email within 24 hours', async () => {
    const { service, prisma } = createService();
    prisma.demoRequest.findFirst.mockResolvedValue({ id: 'existing-demo' });

    await expect(
      service.create({
        contactName: 'Priya Sharma',
        email: 'priya@example.com',
        companyName: 'Sharma & Associates',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.demoRequest.create).not.toHaveBeenCalled();
  });

  it('returns persisted requests to the admin listing', async () => {
    const { service, prisma } = createService();
    const request = {
      id: 'demo-1',
      contactName: 'Priya Sharma',
      email: 'priya@example.com',
      companyName: 'Sharma & Associates',
      status: 'NEW',
    };
    prisma.demoRequest.findMany.mockResolvedValue([request]);
    prisma.demoRequest.count.mockResolvedValue(1);

    await expect(service.list({ status: 'NEW', limit: 50, offset: 0 })).resolves.toEqual({
      items: [request],
      total: 1,
      limit: 50,
      offset: 0,
    });

    expect(prisma.demoRequest.findMany).toHaveBeenCalledWith({
      where: { status: 'NEW' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: 0,
    });
  });
});
