import { assertResearchBudgetActive, researchRequestSignal, withinResearchBudget } from './research-execution-budget';
describe('request-scoped research deadlines', () => {
  afterEach(() => jest.useRealTimers());
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
