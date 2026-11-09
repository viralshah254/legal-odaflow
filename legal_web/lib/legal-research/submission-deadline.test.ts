import { afterEach, expect, it, vi } from 'vitest'
import { startLegalResearchJob, runLegalResearch } from '@/lib/api/ai'
const state = vi.hoisted(() => ({ signal: undefined as AbortSignal | undefined }))
vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn((_path: string, options: { signal: AbortSignal }) => {
  state.signal = options.signal
  // Models an auth/session lookup that stalls before fetch even begins.
  return new Promise(() => {})
}) }))
afterEach(() => vi.useRealTimers())
it('bounds async submission even when auth preparation never returns', async () => {
  vi.useFakeTimers()
  const result = startLegalResearchJob({ query: 'Public QA question', countryCode: 'IN', researchMode: 'DEEP' }, 'qa')
  const check = expect(result).rejects.toThrow('request limit')
  await vi.advanceTimersByTimeAsync(15001); await check
  expect(state.signal?.aborted).toBe(true)
})
it('bounds direct research even when auth preparation never returns', async () => {
  vi.useFakeTimers()
  const result = runLegalResearch({ query: 'Public QA question', countryCode: 'IN', researchMode: 'DEEP' }, 'qa')
  const check = expect(result).rejects.toThrow('request limit')
  await vi.advanceTimersByTimeAsync(90001); await check
  expect(state.signal?.aborted).toBe(true)
})
