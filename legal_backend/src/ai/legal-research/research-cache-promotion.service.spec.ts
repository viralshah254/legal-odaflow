import { CacheService } from '@/cache/cache.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ResearchCachePromotionService } from './research-cache-promotion.service';

describe('ResearchCachePromotionService', () => {
  it('promotes only the persisted approved/saved payload to the exact cache key', async () => {
    const prisma = {
      aIOutput: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'output-1',
          citations: {
            cachePromotion: { cacheKey: 'legal:ai:research:key', eligible: false },
            cachePayload: {
              outputMarkdown: 'Memo',
              taskProfile: { kind: 'CASE_SURVEY' },
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'output-1' }),
      },
    };
    const cache = { set: jest.fn().mockResolvedValue(undefined) };
    const service = new ResearchCachePromotionService(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
    );

    await expect(
      service.promote({
        aiOutputId: 'output-1',
        tenantId: 'tenant-1',
        reason: 'approval',
      }),
    ).resolves.toBe(true);

    expect(cache.set).toHaveBeenCalledWith('legal:ai:research:key', {
      outputMarkdown: 'Memo',
      taskProfile: { kind: 'CASE_SURVEY' },
    });
    expect(prisma.aIOutput.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          citations: expect.objectContaining({
            cachePromotion: expect.objectContaining({
              eligible: true,
              promotedBy: 'approval',
            }),
          }),
        },
      }),
    );
  });

  it('does not cache an audit row without promotion metadata', async () => {
    const prisma = {
      aIOutput: {
        findFirst: jest.fn().mockResolvedValue({ id: 'output-1', citations: {} }),
        update: jest.fn(),
      },
    };
    const cache = { set: jest.fn() };
    const service = new ResearchCachePromotionService(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
    );

    await expect(
      service.promote({
        aiOutputId: 'output-1',
        tenantId: 'tenant-1',
        reason: 'save',
      }),
    ).resolves.toBe(false);
    expect(cache.set).not.toHaveBeenCalled();
  });
});
