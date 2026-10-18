#!/usr/bin/env bash
# Reset a burned JustDial Chrome profile and open visible browser for manual unblock.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PROFILE="${JUSTDIAL_USER_DATA_DIR:-$HOME/.justdial-scrape-chrome}"

pkill -f 'run_justdial_india.py --pages-per-city' 2>/dev/null || true
pkill -f 'justdial-scrape-chrome' 2>/dev/null || true
pkill -f "user-data-dir=${PROFILE}" 2>/dev/null || true
sleep 2

if [[ -d "$PROFILE" ]]; then
  backup="${PROFILE}.bak.$(date +%Y%m%d-%H%M%S)"
  mv "$PROFILE" "$backup"
  echo "Backed up old profile → $backup"
fi

./start_justdial_chrome.sh --visible --bg

for _ in $(seq 1 20); do
  curl -sf "http://127.0.0.1:${JUSTDIAL_CDP_PORT:-9222}/json/version" >/dev/null 2>&1 && break
  sleep 1
done

cat <<'EOF'

JustDial is showing blank pages because your scrape session is blocked.

In the Chrome window that just opened:
  1. Go to https://www.justdial.com/ (should already be open)
  2. Search "Lawyers in Delhi" and open a listing — confirm you see results
  3. Complete any captcha / "verify you are human" prompt

When listings load normally, run:
  ./restart_justdial_scrape.sh

EOF
