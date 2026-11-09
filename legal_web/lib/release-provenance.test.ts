import { afterEach, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/release/route'
afterEach(() => vi.unstubAllEnvs())
it('exposes deployment identity and public origin without credentials or caching', async () => {
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'test-commit')
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.okaylegal.ai/api/v1')
  vi.stubEnv('DATABASE_URL', 'secret-database')
  const response = GET()
  expect(await response.json()).toEqual({ gitCommit: 'test-commit', backendOrigin: 'https://api.okaylegal.ai' })
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})
