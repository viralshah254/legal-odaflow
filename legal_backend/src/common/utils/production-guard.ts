import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function assertProductionConfigured(
  configService: ConfigService,
  envKeys: string[],
  featureName: string,
): void {
  if (configService.get<string>('NODE_ENV') !== 'production') {
    return;
  }
  const missing = envKeys.filter((key) => !configService.get<string>(key));
  if (missing.length > 0) {
    throw new ServiceUnavailableException(
      `${featureName} requires production configuration: ${missing.join(', ')}`,
    );
  }
}

export function isMockPaymentId(id: string): boolean {
  return /_(mock|stub)_/i.test(id) || id.startsWith('pi_mock') || id.startsWith('cs_mock');
}
