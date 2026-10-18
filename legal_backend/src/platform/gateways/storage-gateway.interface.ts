export interface UploadOptions {
  key: string;
  content: Buffer | string;
  contentType: string;
  metadata?: Record<string, string>;
  expiresAt?: Date;
}

export interface StorageGateway {
  upload(options: UploadOptions): Promise<{ url: string; key: string }>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const STORAGE_GATEWAY = Symbol('STORAGE_GATEWAY');
