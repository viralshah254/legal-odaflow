import { EmbeddingChunkSet, EmbeddingService } from './embedding.service';

function chunkSet(
  count: number,
  sourceId = 'statute-in-arbitration-act-s86',
): EmbeddingChunkSet {
  return {
    sourceType: 'LEGAL_AUTHORITY',
    sourceId,
    chunks: Array.from({ length: count }, (_, chunkIndex) => ({
      sourceType: 'LEGAL_AUTHORITY',
      sourceId,
      chunkIndex,
      content: `chunk-${chunkIndex}`,
      countryCode: 'IN',
      modelName: 'test-model',
    })),
  };
}

describe('EmbeddingService atomic chunk replacement', () => {
  function config() {
    return {
      get: jest.fn((key: string, fallback: string) =>
        key === 'AI_ENABLE_RAG' ? 'true' : fallback,
      ),
    };
  }

  it('uses three bulk DB operations for 60 vector replacements', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockResolvedValue([60, 60, 0]),
    };
    const service = new EmbeddingService(prisma as never, config() as never);
    const embed = jest
      .spyOn(service, 'embedTexts')
      .mockResolvedValueOnce(Array.from({ length: 48 }, () => [0.1]))
      .mockResolvedValueOnce(Array.from({ length: 12 }, () => [0.2]));

    await expect(
      service.replaceChunkSets([chunkSet(60)], { maxTextsPerRequest: 48 }),
    ).resolves.toEqual({ stored: 60 });

    expect(embed.mock.calls.map(([texts]) => texts.length)).toEqual([48, 12]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);

    const queries = prisma.$executeRaw.mock.calls.map(
      ([query]) => query as { strings: string[]; values: unknown[] },
    );
    const sql = queries.map((query) => query.strings.join('?'));
    expect(sql[0]).toMatch(/INSERT INTO "ContentHash"[\s\S]*ON CONFLICT \("hash"\) DO NOTHING/);
    expect(sql[1]).toMatch(
      /INSERT INTO "EmbeddingChunk"[\s\S]*"embedding"[\s\S]*DO UPDATE SET/,
    );
    expect(queries[1].values).toContain('[0.1]');
    expect(queries[1].values).toContain('[0.2]');
    expect(sql[2]).toMatch(/DELETE FROM "EmbeddingChunk"[\s\S]*"chunkIndex" >=/);
    expect(queries[2].values).toContain(60);
  });

  it('preserves old chunks when a later bounded embedding request fails', async () => {
    const prisma = {
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    const service = new EmbeddingService(prisma as never, config() as never);
    const embed = jest
      .spyOn(service, 'embedTexts')
      .mockResolvedValueOnce(Array.from({ length: 48 }, () => [0.1]))
      .mockResolvedValueOnce(Array.from({ length: 12 }, () => []));

    await expect(
      service.replaceChunkSets([chunkSet(60)], { maxTextsPerRequest: 48 }),
    ).rejects.toThrow(/request 2/);

    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed.mock.calls.map(([texts]) => texts.length)).toEqual([48, 12]);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('submits all bulk writes in one transaction so DB failure rolls back', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest
        .fn()
        .mockRejectedValue(new Error('bulk embedding upsert failed')),
    };
    const service = new EmbeddingService(prisma as never, config() as never);
    jest
      .spyOn(service, 'embedTexts')
      .mockResolvedValue(Array.from({ length: 60 }, () => [0.1]));

    await expect(
      service.replaceChunkSets([chunkSet(60)], { maxTextsPerRequest: 128 }),
    ).rejects.toThrow('bulk embedding upsert failed');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
  });

  it('cleans trailing chunks for every replaced source in one statement', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockResolvedValue([5, 5, 2]),
    };
    const service = new EmbeddingService(prisma as never, config() as never);
    jest
      .spyOn(service, 'embedTexts')
      .mockResolvedValue(Array.from({ length: 5 }, () => [0.1]));

    await service.replaceChunkSets(
      [chunkSet(2, 'statute-in-a-s1'), chunkSet(3, 'statute-in-b-s2')],
      { maxTextsPerRequest: 128 },
    );

    const deleteQuery = prisma.$executeRaw.mock.calls[2][0] as {
      strings: string[];
      values: unknown[];
    };
    expect(deleteQuery.strings.join('?')).toMatch(
      /DELETE FROM "EmbeddingChunk"[\s\S]* OR /,
    );
    expect(deleteQuery.values).toEqual(
      expect.arrayContaining(['statute-in-a-s1', 2, 'statute-in-b-s2', 3]),
    );
  });

  it('bounds requests by both provider input and estimated token limits', async () => {
    const set = chunkSet(4);
    set.chunks.forEach((chunk) => {
      chunk.content = 'x'.repeat(100);
    });
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockResolvedValue([4, 4, 0]),
    };
    const service = new EmbeddingService(prisma as never, config() as never);
    const embed = jest
      .spyOn(service, 'embedTexts')
      .mockImplementation(async (texts) => texts.map(() => [0.1]));

    await service.replaceChunkSets([set], {
      maxTextsPerRequest: 128,
      maxEstimatedTokensPerRequest: 100,
    });

    expect(embed.mock.calls.map(([texts]) => texts.length)).toEqual([2, 2]);
  });
});
