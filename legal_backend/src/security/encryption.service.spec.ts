import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

function config(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('EncryptionService', () => {
  const masterKey = Buffer.alloc(32, 7).toString('base64');

  it('round-trips JSON with authenticated encryption metadata', () => {
    const service = new EncryptionService(
      config({ ENCRYPTION_MASTER_KEY: masterKey, ENCRYPTION_KEY_VERSION: 'v2' }),
    );

    const encrypted = service.encryptJson({ accessToken: 'secret' }, 'aad');
    expect(encrypted).toMatchObject({
      __encrypted: true,
      alg: 'AES-256-GCM',
      keyVersion: 'v2',
    });
    expect(JSON.stringify(encrypted)).not.toContain('secret');
    expect(service.decryptJson<{ accessToken: string }>(encrypted, 'aad')).toEqual({
      accessToken: 'secret',
    });
  });

  it('rejects tampered authenticated data', () => {
    const service = new EncryptionService(config({ ENCRYPTION_MASTER_KEY: masterKey }));
    const encrypted = service.encryptString('secret', 'aad');

    expect(() => service.decryptString(encrypted, 'different-aad')).toThrow();
  });

  it('stores encrypted strings in text columns and reads legacy plaintext', () => {
    const service = new EncryptionService(config({ ENCRYPTION_MASTER_KEY: masterKey }));

    const stored = service.encryptStringForStorage('sensitive note', 'note-aad');
    expect(stored).not.toContain('sensitive note');
    expect(service.decryptStringFromStorage(stored, 'note-aad')).toBe('sensitive note');
    expect(service.decryptStringFromStorage('legacy plaintext', 'note-aad')).toBe(
      'legacy plaintext',
    );
  });

  it('requires an explicit master key in production', () => {
    expect(() => new EncryptionService(config({ NODE_ENV: 'production' }))).toThrow(
      InternalServerErrorException,
    );
  });
});
