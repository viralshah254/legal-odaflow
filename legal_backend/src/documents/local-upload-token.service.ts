import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type LocalUploadMethod = 'PUT' | 'GET';

interface LocalUploadPayload {
  type: 'LOCAL_UPLOAD';
  key: string;
  method: LocalUploadMethod;
}

const PUT_TTL_SECONDS = 15 * 60;
const GET_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class LocalUploadTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signPutToken(key: string): string {
    return this.signToken(key, 'PUT', PUT_TTL_SECONDS);
  }

  signGetToken(key: string): string {
    return this.signToken(key, 'GET', GET_TTL_SECONDS);
  }

  buildSignedUrl(baseUrl: string, key: string, method: LocalUploadMethod): string {
    const token = method === 'PUT' ? this.signPutToken(key) : this.signGetToken(key);
    const normalizedBase = baseUrl.replace(/\/$/, '');
    return `${normalizedBase}/${key}?token=${encodeURIComponent(token)}`;
  }

  verifyToken(token: string, key: string, method: LocalUploadMethod): void {
    let payload: LocalUploadPayload;
    try {
      payload = this.jwtService.verify<LocalUploadPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid upload token');
    }

    if (
      payload.type !== 'LOCAL_UPLOAD' ||
      payload.key !== key ||
      payload.method !== method
    ) {
      throw new UnauthorizedException('Invalid upload token');
    }
  }

  private signToken(key: string, method: LocalUploadMethod, expiresInSeconds: number): string {
    return this.jwtService.sign(
      {
        type: 'LOCAL_UPLOAD',
        key,
        method,
      } satisfies LocalUploadPayload,
      {
        secret: this.configService.get<string>('JWT_SECRET', 'change_me_dev_secret'),
        expiresIn: expiresInSeconds,
      },
    );
  }
}
