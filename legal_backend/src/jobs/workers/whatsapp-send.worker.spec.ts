import { normalizeToMetaPhone } from './whatsapp-send.worker';

describe('normalizeToMetaPhone', () => {
  it('strips plus and non-digits', () => {
    expect(normalizeToMetaPhone('+254738266973')).toBe('254738266973');
    expect(normalizeToMetaPhone('+1 (940) 237-9507')).toBe('19402379507');
  });

  it('returns empty for invalid input', () => {
    expect(normalizeToMetaPhone('')).toBe('');
    expect(normalizeToMetaPhone('abc')).toBe('');
  });
});
