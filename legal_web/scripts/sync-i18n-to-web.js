/**
 * Syncs shared/i18n locale files into legal_web/messages when the monorepo is present.
 * Vercel deploys legal_web only, so bundled messages/*.json must exist in-repo.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const repoSharedScript = path.join(__dirname, '../../shared/i18n/scripts/sync-to-web.js')
const localMessagesDir = path.join(__dirname, '../messages')

function hasBundledMessages() {
  if (!fs.existsSync(localMessagesDir)) return false
  return fs.readdirSync(localMessagesDir).some((name) => name.endsWith('.json'))
}

if (fs.existsSync(repoSharedScript)) {
  execSync(`node "${repoSharedScript}"`, {
    stdio: 'inherit',
    cwd: path.dirname(repoSharedScript),
  })
} else if (hasBundledMessages()) {
  console.log('[sync-i18n-to-web] Using bundled legal_web/messages/*.json')
} else {
  console.error(
    '[sync-i18n-to-web] Missing legal_web/messages — run i18n:sync from the monorepo root',
  )
  process.exit(1)
}
