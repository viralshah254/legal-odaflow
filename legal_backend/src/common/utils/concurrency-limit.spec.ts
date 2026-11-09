import concurrencyLimit from './concurrency-limit';

describe('concurrencyLimit', () => {
  it('limits concurrent work and releases the queue after rejection', async () => {
    const limit = concurrencyLimit(2);
    let active = 0;
    let peak = 0;
    const started: number[] = [];
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => limit(async () => {
      started.push(index);
      peak = Math.max(peak, ++active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active--;
      if (index === 1) throw new Error('retrieval failed');
      return index;
    })));
    expect(peak).toBe(2);
    expect(active).toBe(0);
    expect(started).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(7);
    expect(results[1].status).toBe('rejected');
  });
});
