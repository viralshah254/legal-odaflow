import type { EmbeddingChunkSet } from '@/embeddings/embedding.service';
import {
  IndiaStatuteBackfillService,
  packEmbeddingChunkSets,
  partitionRegisteredManifestActs,
  selectEmbedActIds,
  selectParseActIds,
  StatuteActQuality,
} from './india-statute-backfill.service';

function quality(
  actId: string,
  headingOnlyRatio: number,
  pendingEmbeddings = 0,
): StatuteActQuality {
  return {
    actId,
    total: 100,
    headingOnly: Math.round(headingOnlyRatio * 100),
    headingOnlyRatio,
    pendingEmbeddings,
  };
}

function set(sourceId: string, count: number): EmbeddingChunkSet {
  return {
    sourceType: 'LEGAL_AUTHORITY',
    sourceId,
    chunks: Array.from({ length: count }, (_, chunkIndex) => ({
      sourceType: 'LEGAL_AUTHORITY',
      sourceId,
      chunkIndex,
      content: `${sourceId}-${chunkIndex}`,
      modelName: 'test-model',
    })),
  };
}

describe('Indian statute backfill planning', () => {
  it('reports and skips unregistered future manifest acts', () => {
    const registry = new Map([
      ['registered-manifest-act', 'registered-act'],
      ['alias-manifest-act', 'registered-act'],
    ]);
    const result = partitionRegisteredManifestActs(
      [
        'registered-manifest-act',
        'future-state-act',
        'alias-manifest-act',
        'another-future-act',
      ],
      (manifestActId) => registry.get(manifestActId),
    );

    expect([...result.manifestByRegistryId.entries()]).toEqual([
      ['registered-act', 'registered-manifest-act'],
    ]);
    expect(result.unregistered).toEqual([
      'future-state-act',
      'another-future-act',
    ]);
  });

  it('separates poor parse work from healthy pending embedding work on rerun', () => {
    const acts = [
      quality('poor', 0.25),
      quality('healthy', 0.02),
      quality('healthy-pending', 0.01, 3),
      { ...quality('missing', 0), total: 0 },
    ];
    expect(
      selectParseActIds(acts, 0.1),
    ).toEqual(['poor', 'missing']);
    expect(selectEmbedActIds(acts)).toEqual(['healthy-pending']);
  });

  it('honours explicit exclusions even for pending work', () => {
    expect(
      selectEmbedActIds(
        [quality('recently-completed', 0.5, 2)],
        new Set(['recently-completed']),
      ),
    ).toEqual([]);
  });

  it('is idempotent after text and embeddings become healthy', () => {
    const first = [quality('act', 0.4, 10)];
    const restarted = [quality('act', 0.02, 0)];
    expect(selectParseActIds(first, 0.1)).toEqual(['act']);
    expect(selectEmbedActIds(first)).toEqual(['act']);
    expect(selectParseActIds(restarted, 0.1)).toEqual([]);
    expect(selectEmbedActIds(restarted)).toEqual([]);
  });

  it('packs whole authority replacements without exceeding input limits', () => {
    const batches = packEmbeddingChunkSets(
      [set('a', 20), set('b', 30), set('c', 18)],
      48,
    );
    expect(
      batches.map((batch) => batch.flatMap((item) => item.chunks).length),
    ).toEqual([20, 48]);
    expect(batches.flat().map((item) => item.sourceId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a 60-chunk authority atomic while allowing 48-text requests', () => {
    const batches = packEmbeddingChunkSets(
      [set('small', 10), set('oversize', 60), set('after', 12)],
      48,
    );
    expect(
      batches.map((batch) => batch.flatMap((item) => item.chunks).length),
    ).toEqual([10, 60, 12]);
    expect(batches[1].map((item) => item.sourceId)).toEqual(['oversize']);
  });

  it('purges heading-only, section-zero, and case-title contaminated rows with their chunks', async () => {
    const deleted = {
      aICitation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      embeddingChunk: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
      contentHash: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      legalAuthority: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const prisma = {
      legalAuthority: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'statute-in-test-act-s1',
            title: 'Short title',
            fullText: '1. Short title.',
            isRepealed: false,
          },
          {
            id: 'statute-in-test-act-s0',
            title: 'Unknown section',
            fullText: 'Fallback text',
            isRepealed: false,
          },
          {
            id: 'statute-in-test-act-s2',
            title: 'Asha Devi v. State of India',
            fullText: 'IN THE SUPREME COURT OF INDIA\nCivil Appeal 10\nJudgment',
            isRepealed: false,
          },
          {
            id: 'statute-in-test-act-s3',
            title: 'Definitions',
            fullText: '3. In this Act, "record" means an electronic record.',
            isRepealed: false,
          },
        ]),
      },
      $transaction: jest.fn(
        async (callback: (tx: typeof deleted) => Promise<unknown>) => callback(deleted),
      ),
    };
    const service = new IndiaStatuteBackfillService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(service.purgeContaminated(['test-act'])).resolves.toEqual({
      authorities: 3,
      chunks: 3,
      contentHashes: 2,
      authorityIds: [
        'statute-in-test-act-s1',
        'statute-in-test-act-s0',
        'statute-in-test-act-s2',
      ],
    });
    expect(deleted.legalAuthority.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [
            'statute-in-test-act-s1',
            'statute-in-test-act-s0',
            'statute-in-test-act-s2',
          ],
        },
      },
    });
  });

  it('marks an authority failed rather than completed after embedding failure', async () => {
    const prisma = {
      legalAuthority: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'statute-in-arbitration-act-s86',
            title: 'Repeal',
            citation: 'Arbitration Act s.86',
            summary: 'Summary',
            fullText: 'Long provision',
            countryCode: 'IN',
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const embeddings = {
      getEmbeddingModel: jest.fn().mockReturnValue('test-model'),
      replaceChunkSets: jest.fn().mockRejectedValue(new Error('request 2 failed')),
    };
    const chunker = {
      chunkToStrings: jest
        .fn()
        .mockReturnValue(Array.from({ length: 60 }, (_, index) => `chunk-${index}`)),
    };
    const service = new IndiaStatuteBackfillService(
      prisma as never,
      embeddings as never,
      chunker as never,
    );

    const result = await service.embedPending(['arbitration-act'], {
      batchSize: 48,
      concurrency: 1,
    });

    expect(result.errors).toHaveLength(1);
    expect(embeddings.replaceChunkSets).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'statute-in-arbitration-act-s86',
          chunks: expect.arrayContaining([
            expect.objectContaining({ chunkIndex: 59 }),
          ]),
        }),
      ]),
      { maxTextsPerRequest: 48 },
    );
    expect(prisma.legalAuthority.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: { embeddingStatus: 'PROCESSING' } }),
    );
    expect(prisma.legalAuthority.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { embeddingStatus: 'FAILED' } }),
    );
    expect(prisma.legalAuthority.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { embeddingStatus: 'COMPLETED' } }),
    );
  });
});
