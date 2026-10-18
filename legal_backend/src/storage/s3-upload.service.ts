import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export type PresignedPutResult = {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
};

@Injectable()
export class S3UploadService {
  private client: S3Client | null = null;
  private readonly objectMetaCache = new Map<
    string,
    { contentLength: number; etag?: string; contentType?: string; expiresAt: number }
  >();

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const provider = this.configService.get<string>('S3_PROVIDER', 'local');
    if (provider === 'local') return false;
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    const accessKey =
      this.configService.get<string>('S3_ACCESS_KEY_ID', '').trim() ||
      this.configService.get<string>('AWS_ACCESS_KEY_ID', '').trim();
    const secretKey =
      this.configService.get<string>('S3_SECRET_ACCESS_KEY', '').trim() ||
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY', '').trim();
    return Boolean(bucket && accessKey && secretKey);
  }

  getRequiredUploadHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const kmsKeyId = this.configService.get<string>('S3_SSE_KMS_KEY_ID', '').trim();
    if (kmsKeyId) {
      headers['x-amz-server-side-encryption'] = 'aws:kms';
      headers['x-amz-server-side-encryption-aws-kms-key-id'] = kmsKeyId;
    } else {
      headers['x-amz-server-side-encryption'] = 'AES256';
    }
    if (!this.shouldSkipObjectAcl()) {
      headers['x-amz-acl'] = 'private';
    }
    return headers;
  }

  private shouldSkipObjectAcl(): boolean {
    return this.configService.get<string>('S3_SKIP_OBJECT_ACL', '').trim() === 'true';
  }

  private getBucket(): string {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }
    return bucket;
  }

  private getClient(): S3Client {
    if (!this.client) {
      const region = this.configService.get<string>('S3_REGION', 'us-east-1');
      const accessKeyId =
        this.configService.get<string>('S3_ACCESS_KEY_ID', '') ||
        this.configService.get<string>('AWS_ACCESS_KEY_ID', '');
      const secretAccessKey =
        this.configService.get<string>('S3_SECRET_ACCESS_KEY', '') ||
        this.configService.get<string>('AWS_SECRET_ACCESS_KEY', '');

      if (!accessKeyId || !secretAccessKey) {
        throw new ServiceUnavailableException('S3 credentials are not configured');
      }

      this.client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
    return this.client;
  }

  private buildPutObjectInput(
    key: string,
    contentType: string,
    body?: Buffer,
  ): PutObjectCommandInput {
    const bucket = this.getBucket();
    const kmsKeyId = this.configService.get<string>('S3_SSE_KMS_KEY_ID', '').trim();

    const input: PutObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
      ServerSideEncryption: kmsKeyId ? 'aws:kms' : 'AES256',
    };

    if (kmsKeyId) {
      input.SSEKMSKeyId = kmsKeyId;
    }

    if (!this.shouldSkipObjectAcl()) {
      input.ACL = ObjectCannedACL.private;
    }

    if (body) {
      input.Body = body;
    }

    return input;
  }

  private buildObjectUrl(key: string): string {
    const cdnUrl = this.configService.get<string>('S3_PUBLIC_CDN_URL', '').trim();
    if (cdnUrl) {
      return `${cdnUrl.replace(/\/$/, '')}/${key}`;
    }

    const bucket = this.getBucket();
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<string> {
    await this.getClient().send(
      new PutObjectCommand(
        this.buildPutObjectInput(key, contentType || 'application/octet-stream', body),
      ),
    );

    return this.buildObjectUrl(key);
  }

  /** Short-lived GET URL — browser fetches byte ranges directly from S3 (fastest seek path). */
  async getPresignedGetUrl(key: string, expiresInSeconds = 14400): Promise<string> {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }

    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async headObject(key: string): Promise<{ contentLength: number; etag?: string; contentType?: string }> {
    const cached = this.objectMetaCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        contentLength: cached.contentLength,
        etag: cached.etag,
        contentType: cached.contentType,
      };
    }

    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }

    const response = await this.getClient().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );

    const meta = {
      contentLength: response.ContentLength ?? 0,
      etag: response.ETag,
      contentType: response.ContentType,
    };
    this.objectMetaCache.set(key, { ...meta, expiresAt: Date.now() + 10 * 60 * 1000 });
    return meta;
  }

  async getObjectStream(
    key: string,
    range?: { start: number; end: number },
    knownTotalSize?: number,
  ): Promise<{ stream: Readable; contentLength: number; contentRange?: string; totalSize: number }> {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }

    const totalSize = knownTotalSize ?? (await this.headObject(key)).contentLength;

    if (!range) {
      const response = await this.getClient().send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!response.Body) {
        throw new Error(`S3 object not found: ${key}`);
      }
      return {
        stream: response.Body as Readable,
        contentLength: totalSize,
        totalSize,
      };
    }

    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: `bytes=${range.start}-${range.end}`,
      }),
    );
    if (!response.Body) {
      throw new Error(`S3 object not found: ${key}`);
    }

    const contentLength = range.end - range.start + 1;
    return {
      stream: response.Body as Readable,
      contentLength,
      contentRange: `bytes ${range.start}-${range.end}/${totalSize}`,
      totalSize,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }

    const response = await this.getClient().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    if (!response.Body) {
      throw new Error(`S3 object not found: ${key}`);
    }

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async createPresignedPutUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<PresignedPutResult> {
    const command = new PutObjectCommand(
      this.buildPutObjectInput(key, contentType || 'application/octet-stream'),
    );

    const uploadUrl = await getSignedUrl(this.getClient(), command, {
      expiresIn: expiresInSeconds,
    });

    return {
      uploadUrl,
      uploadHeaders: this.getRequiredUploadHeaders(),
    };
  }

  async createMultipartUpload(key: string, contentType?: string): Promise<string> {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }

    const response = await this.getClient().send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
      }),
    );

    if (!response.UploadId) {
      throw new ServiceUnavailableException('Failed to start S3 multipart upload');
    }
    return response.UploadId;
  }

  async uploadMultipartPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<string> {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }

    const response = await this.getClient().send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    );

    if (!response.ETag) {
      throw new ServiceUnavailableException(`S3 upload part ${partNumber} failed`);
    }
    return response.ETag;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<void> {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }

    await this.getClient().send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const bucket = this.configService.get<string>('S3_BUCKET', '').trim();
    if (!bucket) return;

    await this.getClient().send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }
}
