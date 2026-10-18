import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3UploadService } from './s3-upload.service';

const mockSend = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  ObjectCannedACL: { private: 'private' },
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
}));

function configFor(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: string) =>
      values[key] ?? defaultValue ?? '',
    ),
  } as unknown as ConfigService;
}

describe('S3UploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getRequiredUploadHeaders returns SSE-S3 and private ACL by default', () => {
    const service = new S3UploadService(
      configFor({
        S3_BUCKET: 'test-bucket',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    );

    expect(service.getRequiredUploadHeaders()).toEqual({
      'x-amz-server-side-encryption': 'AES256',
      'x-amz-acl': 'private',
    });
  });

  it('getRequiredUploadHeaders returns KMS headers when S3_SSE_KMS_KEY_ID is set', () => {
    const service = new S3UploadService(
      configFor({
        S3_SSE_KMS_KEY_ID: 'arn:aws:kms:us-east-1:123:key/abc',
      }),
    );

    expect(service.getRequiredUploadHeaders()).toEqual({
      'x-amz-server-side-encryption': 'aws:kms',
      'x-amz-server-side-encryption-aws-kms-key-id': 'arn:aws:kms:us-east-1:123:key/abc',
      'x-amz-acl': 'private',
    });
  });

  it('getRequiredUploadHeaders omits ACL when S3_SKIP_OBJECT_ACL=true', () => {
    const service = new S3UploadService(
      configFor({
        S3_SKIP_OBJECT_ACL: 'true',
      }),
    );

    expect(service.getRequiredUploadHeaders()).toEqual({
      'x-amz-server-side-encryption': 'AES256',
    });
  });

  it('putObject sends SSE-S3 and private ACL', async () => {
    const service = new S3UploadService(
      configFor({
        S3_BUCKET: 'test-bucket',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    );

    await service.putObject('tenant/doc.pdf', Buffer.from('data'), 'application/pdf');

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'tenant/doc.pdf',
        Body: Buffer.from('data'),
        ContentType: 'application/pdf',
        ServerSideEncryption: 'AES256',
        ACL: 'private',
      }),
    );
    expect(mockSend).toHaveBeenCalled();
  });

  it('putObject uses KMS when S3_SSE_KMS_KEY_ID is set', async () => {
    const service = new S3UploadService(
      configFor({
        S3_BUCKET: 'test-bucket',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
        S3_SSE_KMS_KEY_ID: 'arn:aws:kms:us-east-1:123:key/abc',
      }),
    );

    await service.putObject('tenant/doc.pdf', Buffer.from('data'));

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: 'arn:aws:kms:us-east-1:123:key/abc',
      }),
    );
  });

  it('putObject omits ACL when S3_SKIP_OBJECT_ACL=true', async () => {
    const service = new S3UploadService(
      configFor({
        S3_BUCKET: 'test-bucket',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
        S3_SKIP_OBJECT_ACL: 'true',
      }),
    );

    await service.putObject('tenant/doc.pdf', Buffer.from('data'));

    const call = (PutObjectCommand as unknown as jest.Mock).mock.calls.at(-1)?.[0];
    expect(call.ACL).toBeUndefined();
  });

  it('createPresignedPutUrl returns signed URL and required upload headers', async () => {
    const service = new S3UploadService(
      configFor({
        S3_BUCKET: 'test-bucket',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    );

    const result = await service.createPresignedPutUrl('tenant/doc.pdf', 'application/pdf');

    expect(getSignedUrl).toHaveBeenCalled();
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ServerSideEncryption: 'AES256',
        ACL: 'private',
      }),
    );
    expect(result).toEqual({
      uploadUrl: 'https://signed.example/upload',
      uploadHeaders: {
        'x-amz-server-side-encryption': 'AES256',
        'x-amz-acl': 'private',
      },
    });
  });
});
