#!/usr/bin/env bash
# Kill duplicate scrapers, ensure one Chrome CDP session, start a single scrape job.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

pkill -f 'run_justdial_india.py --pages-per-city' 2>/dev/null || true

if ! curl -sf "http://127.0.0.1:${JUSTDIAL_CDP_PORT:-9222}/json/version" >/dev/null 2>&1; then
  pkill -f 'justdial-scrape-chrome' 2>/dev/null || true
  pkill -f 'user-data-dir=.*/.justdial-scrape-chrome' 2>/dev/null || true
  sleep 2
  ./start_justdial_chrome.sh --visible --bg
  for _ in $(seq 1 30); do
    curl -sf "http://127.0.0.1:${JUSTDIAL_CDP_PORT:-9222}/json/version" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! curl -sf "http://127.0.0.1:${JUSTDIAL_CDP_PORT:-9222}/json/version" >/dev/null 2>&1; then
  echo "Chrome CDP not ready on port ${JUSTDIAL_CDP_PORT:-9222}" >&2
  exit 1
fi

export JUSTDIAL_CDP_URL="${JUSTDIAL_CDP_URL:-http://127.0.0.1:9222}"
export JUSTDIAL_WA_ONLY="${JUSTDIAL_WA_ONLY:-1}"
export JUSTDIAL_SCROLL_PASSES="${JUSTDIAL_SCROLL_PASSES:-10}"
export JUSTDIAL_SCROLL_DELAY="${JUSTDIAL_SCROLL_DELAY:-2}"
export JUSTDIAL_WA_CLICK_DELAY="${JUSTDIAL_WA_CLICK_DELAY:-2.5}"
export JUSTDIAL_WA_CLICKS_PER_PAGE="${JUSTDIAL_WA_CLICKS_PER_PAGE:-25}"
export JUSTDIAL_LISTING_QUERY="${JUSTDIAL_LISTING_QUERY:-trkid=21357-mumbai&term=lawy&cbflg=3}"
# Slower defaults — JustDial blocks after ~3–4 rapid listing pages.
export JUSTDIAL_CATEGORIES="${JUSTDIAL_CATEGORIES:-Lawyers,Advocates}"
export JUSTDIAL_PAGE_DELAY="${JUSTDIAL_PAGE_DELAY:-12}"
export JUSTDIAL_CITY_DELAY="${JUSTDIAL_CITY_DELAY:-45}"
export JUSTDIAL_RATE_SEC="${JUSTDIAL_RATE_SEC:-4}"
export JUSTDIAL_BLOCK_COOLDOWN="${JUSTDIAL_BLOCK_COOLDOWN:-180}"
export JUSTDIAL_MAX_BLOCKS="${JUSTDIAL_MAX_BLOCKS:-3}"
export JUSTDIAL_SESSION_PAUSE_SEC="${JUSTDIAL_SESSION_PAUSE_SEC:-1800}"

RESET_ARGS=()
if [ "${JUSTDIAL_FRESH:-0}" = "1" ]; then
  RESET_ARGS=(--reset-checkpoints --no-resume)
  echo "Fresh scrape: clearing checkpoints and raw JSONL"
fi

nohup .venv/bin/python run_justdial_india.py \
  "${RESET_ARGS[@]}" \
  --pages-per-city "${PAGES_PER_CITY:-8}" \
  --limit "${LIMIT:-50000}" \
  --output data/justdial_india.csv \
  > data/justdial_full.log 2>&1 &

echo "Scraper PID: $!"
echo "  categories: $JUSTDIAL_CATEGORIES | pages/city: ${PAGES_PER_CITY:-8}"
echo "  WhatsApp mode: clicks listing buttons → web.whatsapp.com/send?phone=91…"
echo "  Fresh restart: JUSTDIAL_FRESH=1 ./restart_justdial_scrape.sh"
echo "  tail -f data/justdial_full.log"
