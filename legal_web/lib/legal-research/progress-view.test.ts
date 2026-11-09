import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { LegalResearchProgress } from '@/components/legal-research/legal-research-progress'
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
let root: Root | undefined, container: HTMLDivElement | undefined
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
afterEach(async () => { if (root) await act(async () => root!.unmount()); container?.remove(); root = undefined; vi.useRealTimers() })
async function mount(phase?: 'retrieving' | 'generating') {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(React.createElement(LegalResearchProgress, { active: true, researchMode: 'DEEP', phase })))
}
it('elapsed time never invents completion or advances beyond the reported retrieval stage', async () => {
  vi.useFakeTimers(); await mount('retrieving')
  expect(container!.querySelector('p.font-medium')?.textContent).toBe('stepRetrieveLabel')
  await act(async () => { await vi.advanceTimersByTimeAsync(400000) })
  expect(container!.querySelector('p.font-medium')?.textContent).toBe('stepRetrieveLabel')
  expect(container!.textContent).not.toContain('almostThere')
  expect(container!.textContent).not.toContain('under 45')
})
it('unknown server progress stays waiting rather than simulating research stages', async () => {
  vi.useFakeTimers(); await mount()
  await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
  expect(container!.querySelector('p.font-medium')?.textContent).toBe('stepParseLabel')
  expect(container!.textContent).toContain('waitingForServer')
})
