/** Public, credential-free post-deployment gate for both production domains. */
const frontend = process.env.EXPECTED_FRONTEND_SHA
const backend = process.env.EXPECTED_BACKEND_SHA
if (![frontend, backend].every(value => /^[a-f0-9]{40}$/.test(value ?? ''))) throw new Error('Provide full EXPECTED_FRONTEND_SHA and EXPECTED_BACKEND_SHA')
async function get(url) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Release check returned HTTP ${response.status}: ${new URL(url).pathname}`)
  return response.json()
}
for (const origin of ['https://umbrella.okaylegal.ai', 'https://legal.odaflow.com']) {
  const release = await get(`${origin}/api/release`)
  if (release.gitCommit !== frontend || release.backendOrigin !== 'https://api.okaylegal.ai') throw new Error(`Release/backend mismatch at ${origin}`)
}
const version = await get('https://api.okaylegal.ai/api/v1/health/version')
const readiness = await get('https://api.okaylegal.ai/api/v1/health/readiness')
if (version.gitCommit !== backend || readiness.status !== 'ok') throw new Error('Backend version/readiness mismatch')
console.log(JSON.stringify({ bothDomainsMatchExpectedRelease: true, correctBackend: true, backendReady: true, frontend, backend }))
