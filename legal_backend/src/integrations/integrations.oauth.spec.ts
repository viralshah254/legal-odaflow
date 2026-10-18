import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivacyControlsService } from '@/country-compliance/privacy-controls.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/security/encryption.service';
import { IntegrationSyncService } from './integration-sync.service';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService OAuth callback', () => {
  const prisma = {
    integrationConnection: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    integrationSyncLog: {
      create: jest.fn(),
    },
    matter: {
      findFirst: jest.fn(),
    },
  };
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'NODE_ENV') return 'development';
      return defaultValue;
    }),
  };
  const encryption = {
    encryptJson: jest.fn().mockReturnValue({ encrypted: true }),
  };
  const integrationSync = {};
  const privacyControls = {
    assertTenantProcessingAllowed: jest.fn().mockResolvedValue(undefined),
  };

  const service = new IntegrationsService(
    prisma as unknown as PrismaService,
    configService as unknown as ConfigService,
    encryption as unknown as EncryptionService,
    integrationSync as unknown as IntegrationSyncService,
    privacyControls as unknown as PrivacyControlsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.integrationConnection.upsert.mockResolvedValue({
      provider: 'google_calendar',
      status: 'CONNECTED',
      config: {},
    });
  });

  it('rejects raw token payloads and requires an authorization code', async () => {
    await expect(
      service.completeOAuth('tenant_1', 'gmail', {
        code: '',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.completeOAuth('tenant_1', 'gmail', {
        code: 'real_provider_code',
      }),
    ).rejects.toThrow('Authorization code is required; OAuth tokens cannot be supplied directly');
  });

  it('issues server-side dev stub tokens for non-production OAuth stubs', async () => {
    const result = await service.completeOAuth('tenant_1', 'google_calendar', {
      code: 'dev_stub',
      state: 'state_tenant_1_123',
    });

    expect(result.status).toBe('CONNECTED');
    expect(encryption.encryptJson).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: expect.stringMatching(/^dev_stub_access_/),
        refreshToken: expect.stringMatching(/^dev_stub_refresh_/),
      }),
      'integration:tenant_1:google_calendar:tokens',
    );
  });
});
