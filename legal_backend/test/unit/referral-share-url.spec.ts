import { buildReferralShareUrl } from '@/common/app-url';

describe('buildReferralShareUrl', () => {
  const appUrl = 'https://umbrella.okaylegal.ai';

  it('points to the landing page root, not /auth', () => {
    const url = buildReferralShareUrl(appUrl, 'TESTCODE');
    expect(url).toBe('https://umbrella.okaylegal.ai/?ref=TESTCODE');
  });

  it('uppercases the code', () => {
    const url = buildReferralShareUrl(appUrl, 'lowercase');
    expect(url).toContain('ref=LOWERCASE');
  });

  it('does not contain /auth in the path', () => {
    expect(buildReferralShareUrl(appUrl, 'CODE')).not.toContain('/auth');
  });
});
