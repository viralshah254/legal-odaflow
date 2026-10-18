import { AuthService } from './auth.service';
import { mapProspectToPrefill } from '@/admin/prospect-prefill.util';

function createAuthService() {
  const prisma = {
    user: { findUnique: jest.fn() },
    lawyerProspect: { findFirst: jest.fn(), updateMany: jest.fn() },
  };

  const service = new AuthService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, prisma };
}

describe('AuthService.lookupEmail', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns prospectPrefill when no active user exists', async () => {
    const { service, prisma } = createAuthService();
    const prospect = {
      id: 'p1',
      fullName: 'Rohit Sharma',
      firstName: 'Rohit',
      lastName: 'Sharma',
      organisation: 'Shende Advocates',
      practiceAreas: null,
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      phone: '+919422314120',
      alternatePhone: null,
      whatsapp: '+919422314120',
      whatsappConfidence: 'high',
      email: 'rohit@example.com',
      emailConfidence: 'manual',
      website: null,
      profileUrl: null,
      barEnrollmentNumber: null,
      barCouncilState: null,
      lawyerVerified: false,
      verifiedAt: null,
      source: 'manual',
      dedupeKey: 'abc',
      outreachStatus: 'NEW',
      isTest: false,
      importRunId: null,
      scrapedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.lawyerProspect.findFirst.mockResolvedValue(prospect);

    await expect(service.lookupEmail('rohit@example.com')).resolves.toEqual({
      exists: false,
      hasPassword: false,
      hasFirebaseAccount: false,
      prospectPrefill: mapProspectToPrefill(prospect),
    });
  });

  it('does not return prospectPrefill for existing users', async () => {
    const { service, prisma } = createAuthService();

    prisma.user.findUnique.mockResolvedValue({
      isActive: true,
      passwordHash: 'hash',
      firebaseUid: null,
    });

    await expect(service.lookupEmail('rohit@example.com')).resolves.toEqual({
      exists: true,
      hasPassword: true,
      hasFirebaseAccount: false,
    });
    expect(prisma.lawyerProspect.findFirst).not.toHaveBeenCalled();
  });
});
