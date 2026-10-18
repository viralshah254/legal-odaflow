/**
 * Keeps legal_web/lib/theme/tokens.json in sync with the monorepo source when present.
 * Vercel deploys legal_web only, so the bundled copy must exist in-repo.
 */
const fs = require("fs")
const path = require("path")

const repoShared = path.join(__dirname, "../../shared/theme/tokens.json")
const localTokens = path.join(__dirname, "../lib/theme/tokens.json")

if (fs.existsSync(repoShared)) {
  fs.mkdirSync(path.dirname(localTokens), { recursive: true })
  fs.copyFileSync(repoShared, localTokens)
  console.log("[sync-theme-tokens] Copied shared/theme/tokens.json → lib/theme/tokens.json")
} else if (fs.existsSync(localTokens)) {
  console.log("[sync-theme-tokens] Using bundled lib/theme/tokens.json")
} else {
  console.error("[sync-theme-tokens] Missing lib/theme/tokens.json")
  process.exit(1)
}
