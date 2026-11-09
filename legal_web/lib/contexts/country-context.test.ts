import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CountryProvider, useDetectedCountry } from './country-context'
const fixtures = vi.hoisted(() => ({ user: { id: 'traveller', countryCode: 'IN' }, ip: vi.fn() }))
vi.mock('@/lib/contexts/auth-context', () => ({ useAuth: () => ({ isAuthenticated: true, user: fixtures.user }) }))
vi.mock('@/lib/contexts/tenant-context', () => ({ useTenantOptional: () => ({ activeTenant: { tenant: { primaryCountry: 'IN' } } }) }))
vi.mock('@/lib/api/profile', () => ({ getMyProfile: async () => ({ countryCode: 'IN', jurisdiction: 'Maharashtra' }) }))
vi.mock('@/lib/geo/detect-country', async (original) => ({ ...await original<typeof import('@/lib/geo/detect-country')>(), detectIpLocation: fixtures.ip }))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
let root: Root | undefined
let container: HTMLDivElement
let country: ReturnType<typeof useDetectedCountry>
function Consumer() { country = useDetectedCountry(); return null }
beforeEach(() => { localStorage.clear(); fixtures.ip.mockResolvedValue({ countryCode: 'KE', region: 'Nairobi' }) })
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; container?.remove() })
async function mount() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(React.createElement(CountryProvider, null, React.createElement(Consumer))))
}
it('uses the traveller location and its region across the workspace while retaining profile metadata', async () => {
  await mount()
  expect(country!.countryCode).toBe('KE')
  expect(country!.detectedRegion).toBe('Nairobi')
  expect(country!.profileCountryCode).toBe('IN')
  expect(country!.hasJurisdictionMismatch).toBe(true)
})
it('a saved profile country does not pin a travelling user to that country', async () => {
  localStorage.setItem('odaflow_detected_country', 'GB')
  // Use the real persistence helper rather than duplicating its flag contract.
  const { persistCountrySelection } = await import('@/lib/geo/detect-country')
  persistCountrySelection('GB', { userConfirmed: true })
  await mount()
  expect(country!.countryCode).toBe('KE')
  expect(country!.detectedRegion).toBe('Nairobi')
})
it('falls back to the account when location is unavailable', async () => {
  fixtures.ip.mockResolvedValue(null); await mount()
  expect(country!.countryCode).toBe('IN')
  expect(country!.detectedRegion).toBe('Maharashtra')
})

it('an explicit current workspace selection remains in control', async () => {
  await mount()
  await act(async () => country!.setCountryCode('GB'))
  expect(country!.countryCode).toBe('GB')
  expect(country!.profileCountryCode).toBe('IN')
  expect(country!.detectedRegion).toBeNull()
})
