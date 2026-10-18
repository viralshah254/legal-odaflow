#!/bin/bash
# Sync .env file to /etc/environment for persistent env vars across reboots
# Uses marker comments to safely replace only our entries without touching system vars
# If IMAGE_TAG=dev, swaps DEV_WEBHOOK_SECRET into GITHUB_WEBHOOK_SECRET automatically

SCRIPT_DIR="$(dirname "$0")"
# Deployment vars (webhook, Docker Hub, etc.) — use deployment/.env
# Root .env is for the API app only (MongoDB, Firebase, etc.)
ENV_FILE="${1:-$SCRIPT_DIR/../deployment/.env}"
SYSTEM_ENV="/etc/environment"
MARKER_START="# LEGAL_ODAFLOW_ENV_START"
MARKER_END="# LEGAL_ODAFLOW_ENV_END"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[sync-env]${NC} $1"; }
log_success() { echo -e "${GREEN}[sync-env]${NC} $1"; }
log_error() { echo -e "${RED}[sync-env]${NC} $1"; }

if [ ! -f "$ENV_FILE" ]; then
    log "No .env file found at $ENV_FILE -- skipping env sync"
    exit 0
fi

log "Syncing $ENV_FILE → $SYSTEM_ENV"

# Load all vars from .env into associative array
declare -A ENV_VARS
while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
        ENV_VARS["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
    fi
done < "$ENV_FILE"

# If IMAGE_TAG is dev, use DEV_WEBHOOK_SECRET as GITHUB_WEBHOOK_SECRET
if [[ "${ENV_VARS[IMAGE_TAG]}" == "dev" && -n "${ENV_VARS[DEV_WEBHOOK_SECRET]}" ]]; then
    log "IMAGE_TAG=dev detected → using DEV_WEBHOOK_SECRET as GITHUB_WEBHOOK_SECRET"
    ENV_VARS["GITHUB_WEBHOOK_SECRET"]="${ENV_VARS[DEV_WEBHOOK_SECRET]}"
fi

# Remove DEV_WEBHOOK_SECRET from output -- it's only used for the swap above
unset 'ENV_VARS[DEV_WEBHOOK_SECRET]'

# Only sync to /etc/environment when on host (not in container) and sudo is available
if [ ! -f /.dockerenv ] && command -v sudo >/dev/null 2>&1; then
    # Remove old ERP env block from /etc/environment
    if grep -q "$MARKER_START" "$SYSTEM_ENV" 2>/dev/null; then
        log "Removing previous Legal env block..."
        sudo sed -i "/$MARKER_START/,/$MARKER_END/d" "$SYSTEM_ENV"
    fi

    # Write new block to /etc/environment
    {
        echo "$MARKER_START"
        for KEY in "${!ENV_VARS[@]}"; do
            echo "$KEY=${ENV_VARS[$KEY]}"
        done
        echo "$MARKER_END"
    } | sudo tee -a "$SYSTEM_ENV" > /dev/null
else
    log "Skipping /etc/environment sync (container or no sudo)"
fi

# Export all vars into current shell
for KEY in "${!ENV_VARS[@]}"; do
    export "$KEY=${ENV_VARS[$KEY]}"
done

log_success "Environment synced. Current values:"
for KEY in "${!ENV_VARS[@]}"; do
    VALUE="${ENV_VARS[$KEY]}"
    if [[ ${#VALUE} -gt 8 ]]; then
        log "  $KEY = ***${VALUE: -8}"
    else
        log "  $KEY = $VALUE"
    fi
done
