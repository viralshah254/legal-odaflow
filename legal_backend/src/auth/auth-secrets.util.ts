import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertProductionConfigured } from '@/common/utils/production-guard';

const INSECURE_JWT_SECRETS = new Set([
  '',
  'change_me_dev_secret',
  'change_me_jwt_secret',
]);

const INSECURE_REFRESH_PEPPERS = new Set(['', 'change_me_refresh_secret']);

export function resolveJwtSecret(configService: ConfigService): string {
  return configService.get<string>('JWT_SECRET', 'change_me_dev_secret');
}

export function resolveRefreshTokenPepper(configService: ConfigService): string {
  return configService.get<string>(
    'REFRESH_TOKEN_SECRET',
    'change_me_refresh_secret',
  );
}

export function assertAuthSecretsConfigured(configService: ConfigService): void {
  if (configService.get<string>('NODE_ENV') !== 'production') {
    return;
  }

  assertProductionConfigured(
    configService,
    ['JWT_SECRET', 'REFRESH_TOKEN_SECRET'],
    'Auth tokens',
  );

  const jwtSecret = resolveJwtSecret(configService);
  if (INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new ServiceUnavailableException(
      'JWT_SECRET must not use a default placeholder in production',
    );
  }

  const refreshPepper = resolveRefreshTokenPepper(configService);
  if (INSECURE_REFRESH_PEPPERS.has(refreshPepper)) {
    throw new ServiceUnavailableException(
      'REFRESH_TOKEN_SECRET must not use a default placeholder in production',
    );
  }
}
