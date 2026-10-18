import { Test } from '@nestjs/testing';
import { KycService } from './kyc.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAccessService } from '@/access/matter-access.service';

describe('KycService country-aware required docs', () => {
  let service: KycService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: {} },
        { provide: MatterAccessService, useValue: {} },
      ],
    }).compile();

    service = module.get(KycService);
  });

  it('returns India individual docs', () => {
    expect(service.getRequiredDocTypes('IN', 'INDIVIDUAL')).toEqual([
      'AADHAAR',
      'PAN_CARD',
      'PROOF_OF_ADDRESS',
    ]);
  });

  it('returns Kenya company docs', () => {
    expect(service.getRequiredDocTypes('KE', 'COMPANY')).toEqual([
      'COMPANY_REGISTRATION',
      'CR12',
      'DIRECTOR_IDS',
      'KRA_PIN',
    ]);
  });

  it('falls back to generic docs for unknown country', () => {
    expect(service.getRequiredDocTypes('US', 'INDIVIDUAL')).toEqual([
      'ID_PASSPORT',
      'PROOF_OF_ADDRESS',
    ]);
  });
});
