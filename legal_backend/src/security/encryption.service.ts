import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface EncryptedPayload {
  __encrypted: true;
  version: 1;
  alg: 'AES-256-GCM';
  keyVersion: string;
  iv: string;
  tag: string;
  encryptedDataKey: string;
  data: string;
}

@Injectable()
export class EncryptionService {
  private readonly keyVersion: string;
  private readonly masterKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.keyVersion = this.configService.get<string>('ENCRYPTION_KEY_VERSION', 'v1');
    this.masterKey = this.resolveMasterKey();
  }

  encryptString(value: string, aad?: string): EncryptedPayload {
    const dataKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
    if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));

    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      __encrypted: true,
      version: 1,
      alg: 'AES-256-GCM',
      keyVersion: this.keyVersion,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      encryptedDataKey: this.encryptDataKey(dataKey).toString('base64'),
      data: ciphertext.toString('base64'),
    };
  }

  decryptString(payload: EncryptedPayload, aad?: string): string {
    if (!this.isEncryptedPayload(payload)) {
      throw new InternalServerErrorException('Invalid encrypted payload');
    }

    const dataKey = this.decryptDataKey(Buffer.from(payload.encryptedDataKey, 'base64'));
    const decipher = createDecipheriv(
      'aes-256-gcm',
      dataKey,
      Buffer.from(payload.iv, 'base64'),
    );
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  encryptJson<T>(value: T, aad?: string): EncryptedPayload {
    return this.encryptString(JSON.stringify(value), aad);
  }

  decryptJson<T>(payload: EncryptedPayload, aad?: string): T {
    return JSON.parse(this.decryptString(payload, aad)) as T;
  }

  encryptStringForStorage(value: string, aad?: string): string {
    return JSON.stringify(this.encryptString(value, aad));
  }

  decryptStringFromStorage(value: string | null | undefined, aad?: string): string | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (this.isEncryptedPayload(parsed)) {
        return this.decryptString(parsed, aad);
      }
    } catch {
      // Legacy plaintext value, returned below.
    }
    return value;
  }

  isEncryptedPayload(value: unknown): value is EncryptedPayload {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Partial<EncryptedPayload>).__encrypted === true &&
      (value as Partial<EncryptedPayload>).version === 1 &&
      (value as Partial<EncryptedPayload>).alg === 'AES-256-GCM'
    );
  }

  private encryptDataKey(dataKey: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }

  private decryptDataKey(encryptedDataKey: Buffer): Buffer {
    const iv = encryptedDataKey.subarray(0, 12);
    const tag = encryptedDataKey.subarray(12, 28);
    const ciphertext = encryptedDataKey.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private resolveMasterKey(): Buffer {
    const configured = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (configured) {
      const decoded = this.decodeConfiguredKey(configured);
      if (decoded.length === 32) return decoded;
      throw new InternalServerErrorException(
        'ENCRYPTION_MASTER_KEY must decode to 32 bytes',
      );
    }

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new InternalServerErrorException(
        'ENCRYPTION_MASTER_KEY is required in production',
      );
    }

    const fallback = this.configService.get<string>('JWT_SECRET', 'dev-only-key');
    return createHash('sha256').update(fallback).digest();
  }

  private decodeConfiguredKey(value: string): Buffer {
    if (/^[0-9a-f]{64}$/i.test(value)) {
      return Buffer.from(value, 'hex');
    }
    return Buffer.from(value, 'base64');
  }
}
