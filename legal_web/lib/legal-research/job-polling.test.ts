import { afterEach, describe, expect, it, vi } from 'vitest'
import { pollResearchUntilDone } from './job-polling'
afterEach(() => vi.useRealTimers())
describe('bounded research polling', () => {
  it('bounds a stalled status request and aborts its network signal', async () => {
    vi.useFakeTimers(); let signal: AbortSignal | undefined
    const result = pollResearchUntilDone(s => { signal = s; return new Promise(() => {}) }, { timeoutMs: 100 })
    const check = expect(result).rejects.toThrow('Check research history before retrying')
    await vi.advanceTimersByTimeAsync(101); await check
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('waits for a poll before scheduling another instead of overlapping requests', async () => {
    vi.useFakeTimers(); let complete!: (value: string | undefined) => void
    const poll = vi.fn(() => new Promise<string | undefined>(resolve => { complete = resolve }))
    const result = pollResearchUntilDone(poll, { timeoutMs: 10000, intervalMs: 20 })
    await vi.advanceTimersByTimeAsync(100); expect(poll).toHaveBeenCalledTimes(1)
    complete(undefined); await vi.advanceTimersByTimeAsync(21); expect(poll).toHaveBeenCalledTimes(2)
    complete('answer'); await expect(result).resolves.toBe('answer')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not schedule more polls when an expired request eventually returns', async () => {
    vi.useFakeTimers(); let complete!: (value: undefined) => void
    const poll = vi.fn(() => new Promise<undefined>(resolve => { complete = resolve }))
    const result = pollResearchUntilDone(poll, { timeoutMs: 100, intervalMs: 20 })
    const check = expect(result).rejects.toThrow('request limit')
    await vi.advanceTimersByTimeAsync(101); await check; complete(undefined)
    await vi.advanceTimersByTimeAsync(500); expect(poll).toHaveBeenCalledTimes(1)
  })
})
