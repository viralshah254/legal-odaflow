#!/usr/bin/env bash
# Monitor Neon DB + US corpus sync progress. Run from legal_backend/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="/tmp/sync-us-corpus.log"
INTERVAL="${1:-120}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

wait_for_db() {
  log "Waiting for database…"
  until npx prisma migrate status >/dev/null 2>&1; do
    sleep "$INTERVAL"
  done
  log "Database reachable."
}

apply_migrations() {
  log "Applying pending migrations…"
  npx prisma migrate deploy
}

db_title_counts() {
  node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const p = new PrismaClient({ datasources: { db: { url } } });
(async () => {
  for (const t of [2,42]) {
    const n = await p.legalAuthority.count({ where: { countryCode: 'US', id: { startsWith: 'statute-us-usc-title-'+t+'-' } } });
    console.log('  usc-title-'+t+': '+n+' sections');
  }
  await p.\$disconnect();
})().catch(e => { console.error('count failed:', e.message); process.exit(1); });
"
}

if ! pgrep -f 'run-legal-corpus-sync.ts US --all-acts' >/dev/null 2>&1; then
  wait_for_db
  apply_migrations
  log "Starting US corpus sync (all acts)…"
  npm run sync:legal-corpus -- US --all-acts 2>&1 | tee -a "$LOG" &
else
  log "Sync already running."
fi

while true; do
  if pgrep -f 'run-legal-corpus-sync.ts US --all-acts' >/dev/null 2>&1; then
    log "Sync running. DB section counts:"
    db_title_counts 2>/dev/null || log "  (DB query failed — Neon may be sleeping)"
    tail -3 "$LOG" 2>/dev/null | sed 's/^/  /' || true
  else
    if grep -q 'Statute section counts by country' "$LOG" 2>/dev/null; then
      log "Sync COMPLETE."
      tail -20 "$LOG"
      exit 0
    fi
    log "Sync not running and not complete — check $LOG"
    exit 1
  fi
  sleep "$INTERVAL"
done
