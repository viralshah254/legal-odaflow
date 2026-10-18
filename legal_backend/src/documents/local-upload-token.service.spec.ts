import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { LocalUploadTokenService } from './local-upload-token.service';

describe('LocalUploadTokenService', () => {
  let service: LocalUploadTokenService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        LocalUploadTokenService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'JWT_SECRET' ? 'test-secret' : fallback,
          },
        },
      ],
    }).compile();

    service = module.get(LocalUploadTokenService);
    jwtService = module.get(JwtService);
  });

  it('signs and verifies PUT token for key', () => {
    const key = 'tenant/documents/2026/06/23/file.pdf';
    const token = service.signPutToken(key);
    expect(() => service.verifyToken(token, key, 'PUT')).not.toThrow();
  });

  it('rejects token for wrong key', () => {
    const token = service.signPutToken('tenant/a/file.pdf');
    expect(() => service.verifyToken(token, 'tenant/b/file.pdf', 'PUT')).toThrow();
  });

  it('rejects PUT token used for GET', () => {
    const token = service.signPutToken('tenant/a/file.pdf');
    expect(() => service.verifyToken(token, 'tenant/a/file.pdf', 'GET')).toThrow();
  });

  it('buildSignedUrl includes token query param', () => {
    const url = service.buildSignedUrl('http://localhost:4000/uploads', 'tenant/a/file.pdf', 'PUT');
    expect(url).toContain('http://localhost:4000/uploads/tenant/a/file.pdf?token=');
  });

  it('rejects expired token', () => {
    const expired = jwtService.sign(
      { type: 'LOCAL_UPLOAD', key: 'k', method: 'PUT' },
      { secret: 'test-secret', expiresIn: -1 },
    );
    expect(() => service.verifyToken(expired, 'k', 'PUT')).toThrow();
  });
});
