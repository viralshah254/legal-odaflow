#!/usr/bin/env bash
# Start Chrome once for JustDial scraping (CDP on port 9222).
# Leave this running; the scraper attaches via CDP and does not quit Chrome.
#
# Usage:
#   ./start_justdial_chrome.sh              # foreground, off-screen
#   ./start_justdial_chrome.sh --bg          # background, off-screen
#   ./start_justdial_chrome.sh --visible     # on-screen (use when JustDial shows blank pages)
#   ./start_justdial_chrome.sh --visible --bg
#
# Then in another terminal:
#   export JUSTDIAL_CDP_URL=http://127.0.0.1:9222
#   python run_justdial_india.py --cities delhi --pages-per-city 2 --limit 50

set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="${JUSTDIAL_USER_DATA_DIR:-$HOME/.justdial-scrape-chrome}"
PORT="${JUSTDIAL_CDP_PORT:-9222}"
BG=0
VISIBLE=0
for arg in "$@"; do
  case "$arg" in
    --bg) BG=1 ;;
    --visible) VISIBLE=1 ;;
  esac
done

if [[ ! -x "$CHROME" ]]; then
  echo "Google Chrome not found at: $CHROME" >&2
  exit 1
fi

mkdir -p "$PROFILE"

ARGS=(
  "--remote-debugging-port=${PORT}"
  "--user-data-dir=${PROFILE}"
  "--window-size=1280,800"
  "--no-first-run"
  "--no-default-browser-check"
)

if [[ "$VISIBLE" -eq 1 ]]; then
  ARGS+=("https://www.justdial.com/")
else
  ARGS+=("--window-position=-32000,-32000")
fi

if [[ "$BG" -eq 1 ]]; then
  nohup "$CHROME" "${ARGS[@]}" >/dev/null 2>&1 &
  echo "Chrome started in background (CDP port ${PORT}, profile ${PROFILE})"
  if [[ "$VISIBLE" -eq 1 ]]; then
    echo "  Visible window opened at https://www.justdial.com/"
    echo "  If pages are blank: browse normally, complete any captcha, then restart scrape."
  fi
  echo "  export JUSTDIAL_CDP_URL=http://127.0.0.1:${PORT}"
else
  echo "Starting Chrome. Press Ctrl+C to stop."
  echo "  export JUSTDIAL_CDP_URL=http://127.0.0.1:${PORT}"
  exec "$CHROME" "${ARGS[@]}"
fi
