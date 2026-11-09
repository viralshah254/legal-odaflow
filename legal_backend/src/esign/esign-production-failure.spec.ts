import { ConfigService } from '@nestjs/config';
import { ESignService } from './esign.service';

describe('E-sign production failure', () => {
  it('does not persist a sent envelope when the provider is unavailable', async () => {
    const prisma = { eSignEnvelope: { create: jest.fn() } };
    const service = new ESignService(prisma as any, { get: (key: string, fallback?: unknown) => key === 'NODE_ENV' ? 'production' : fallback } as ConfigService);
    jest.spyOn(service as any, 'createRemoteEnvelope').mockRejectedValue(new Error('provider unavailable'));
    await expect(service.sendForSignature('tenant', 'user', { documentName: 'Test', subject: 'Test', signers: [] } as any)).rejects.toThrow('E-sign provider is not configured');
    expect(prisma.eSignEnvelope.create).not.toHaveBeenCalled();
  });
});
