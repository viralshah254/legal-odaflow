import { BadRequestException } from '@nestjs/common';
import { assertUploadBuffer } from './file-upload-validation';

describe('assertUploadBuffer', () => {
  it('accepts valid PDF buffers', () => {
    const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(() => assertUploadBuffer(buffer, 'contract.pdf', 'document')).not.toThrow();
  });

  it('rejects executables renamed to pdf', () => {
    const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(() => assertUploadBuffer(buffer, 'malware.pdf', 'document')).toThrow(
      BadRequestException,
    );
  });

  it('accepts plain text FIR uploads', () => {
    const buffer = Buffer.from('Sample FIR text', 'utf8');
    expect(() => assertUploadBuffer(buffer, 'fir.txt', 'firDocument')).not.toThrow();
  });
});
