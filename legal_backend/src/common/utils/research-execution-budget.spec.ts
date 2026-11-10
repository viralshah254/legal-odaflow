import { assertResearchBudgetActive, memoizeResearchRequest, researchRequestSignal, withinResearchBudget } from './research-execution-budget';
describe('request-scoped research deadlines', () => {
  afterEach(() => jest.useRealTimers());
  it('reuses exact work across nested stages but isolates requests and changed evidence', async () => {
    const verify = jest.fn(async () => ({ supported: true }));
    await withinResearchBudget(1000, async () => {
      const original = await memoizeResearchRequest('same-proof', verify);
      expect(await withinResearchBudget(500, () => memoizeResearchRequest('same-proof', verify))).toBe(original);
      await memoizeResearchRequest('changed-proof', verify);
      expect(verify).toHaveBeenCalledTimes(2);
    });
    await withinResearchBudget(1000, () => memoizeResearchRequest('same-proof', verify));
    expect(verify).toHaveBeenCalledTimes(3);
  });
  it('does not cache failed verification', async () => {
    const verify = jest.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ supported: true });
    await withinResearchBudget(1000, async () => {
      await expect(memoizeResearchRequest('proof', verify)).rejects.toThrow('unavailable');
      await expect(memoizeResearchRequest('proof', verify)).resolves.toEqual({ supported: true });
    });
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it('aborts a stalled provider and rejects the whole operation', async () => {
    jest.useFakeTimers(); let signal: AbortSignal | undefined;
    const run = withinResearchBudget(50, () => { signal = researchRequestSignal(); return new Promise(() => {}); });
    const check = expect(run).rejects.toThrow('deadline');
    await jest.advanceTimersByTimeAsync(51); await check;
    expect(signal?.aborted).toBe(true);
  });
  it('prevents late timed-out work from starting another call or publishing', async () => {
    jest.useFakeTimers(); let resume!: () => void; let published = false;
    const run = withinResearchBudget(50, async () => {
      await new Promise<void>(resolve => { resume = resolve; });
      assertResearchBudgetActive(); published = true;
    });
    const check = expect(run).rejects.toThrow('deadline');
    await jest.advanceTimersByTimeAsync(51); await check; resume();
    await Promise.resolve(); await Promise.resolve(); expect(published).toBe(false);
  });
  it('does not let nested stages extend the request deadline', async () => {
    jest.useFakeTimers();
    const run = withinResearchBudget(50, () => withinResearchBudget(1000, () => new Promise(() => {})));
    const check = expect(run).rejects.toThrow('deadline');
    await jest.advanceTimersByTimeAsync(51); await check;
  });
  it('releases timers and does not leak cancellation into other requests', async () => {
    jest.useFakeTimers();
    expect(await withinResearchBudget(50, async () => 'complete')).toBe('complete');
    expect(jest.getTimerCount()).toBe(0);
    expect(researchRequestSignal()).toBeUndefined();
    expect(() => assertResearchBudgetActive()).not.toThrow();
  });
});
