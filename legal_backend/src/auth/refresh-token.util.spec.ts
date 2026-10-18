import { hashRefreshToken } from './refresh-token.util';

describe('hashRefreshToken', () => {
  it('produces a stable HMAC for the same token and pepper', () => {
    const a = hashRefreshToken('plain-token', 'pepper');
    const b = hashRefreshToken('plain-token', 'pepper');
    expect(a).toBe(b);
    expect(a).not.toBe('plain-token');
  });

  it('changes when pepper changes', () => {
    const a = hashRefreshToken('plain-token', 'pepper-a');
    const b = hashRefreshToken('plain-token', 'pepper-b');
    expect(a).not.toBe(b);
  });
});
