import * as admin from 'firebase-admin';
import { FirebaseAuthService } from './firebase-auth.service';

jest.mock('firebase-admin', () => ({ initializeApp: jest.fn(), auth: jest.fn() }));

describe('Firebase legal account identity', () => {
  const verifyIdToken = jest.fn();
  const user = { id: 'lawyer', email: 'lawyer@example.invalid', firebaseUid: null, name: 'Lawyer', isActive: true };
  const prisma = { user: { findFirst: jest.fn(), update: jest.fn() } };
  const auth = { issueTokensForUser: jest.fn() };
  let service: FirebaseAuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    (admin.auth as unknown as jest.Mock).mockReturnValue({ verifyIdToken });
    service = new FirebaseAuthService({ get: jest.fn() } as never, prisma as never, auth as never);
    Object.assign(service, { firebaseApp: {} });
  });

  it.each([false, undefined])('rejects an unverified email claim before account lookup or mutation (verified=%s)', async (email_verified) => {
    verifyIdToken.mockResolvedValue({ uid: 'untrusted-uid', email: user.email, email_verified });
    await expect(service.loginWithFirebase({ idToken: 'signed-token' })).rejects.toThrow('Verify your email');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auth.issueTokensForUser).not.toHaveBeenCalled();
  });

  it('allows the verified email ownership path to link an active account', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'verified-uid', email: user.email, email_verified: true });
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, firebaseUid: 'verified-uid' });
    auth.issueTokensForUser.mockResolvedValue({ accessToken: 'test-access-token' });
    await expect(service.loginWithFirebase({ idToken: 'signed-token' })).resolves.toEqual({ accessToken: 'test-access-token' });
    expect(auth.issueTokensForUser).toHaveBeenCalledWith(user.id);
  });
});
