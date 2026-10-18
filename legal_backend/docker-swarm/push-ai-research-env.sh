#!/usr/bin/env bash
# Push AI research/drafting env vars to production (legal-api.odaflow.com).
# Merges only the listed keys from local legal_backend/.env — does NOT replace
# the whole remote file (DATABASE_URL, CORS, etc. stay as on the server).
#
# Usage: ./push-ai-research-env.sh [ssh-host]
set -euo pipefail

HOST="${1:-legal-backend}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_ENV="$BACKEND_DIR/.env"
REMOTE_ROOT="/home/ubuntu/legal_backend"
REMOTE_ENV="$REMOTE_ROOT/.env"

VARS=(
  LEGAL_RESEARCH_FAST_PIPELINE_ENABLED
  LEGAL_SYNTHESIS_TIMEOUT_MS
  LEGAL_VERIFIED_SYNTHESIS_TIMEOUT_MS
  AZURE_OPENAI_DEPLOYMENT_MAP
)

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "Missing $LOCAL_ENV"
  exit 1
fi

PATCH=$(mktemp)
trap 'rm -f "$PATCH"' EXIT

for var in "${VARS[@]}"; do
  line=$(grep -m1 "^${var}=" "$LOCAL_ENV" || true)
  if [[ -z "$line" ]]; then
    echo "Missing ${var} in $LOCAL_ENV"
    exit 1
  fi
  printf '%s\n' "$line" >> "$PATCH"
done

echo "→ Uploading AI env patch to $HOST (keys: ${VARS[*]})"
scp "$PATCH" "$HOST:/tmp/legal-ai-env.patch"

ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
ENV_FILE="$REMOTE_ENV"
PATCH="/tmp/legal-ai-env.patch"

if [[ ! -f "\$ENV_FILE" ]]; then
  echo "Missing \$ENV_FILE on server"
  exit 1
fi

while IFS= read -r line || [[ -n "\$line" ]]; do
  [[ -z "\$line" || "\$line" =~ ^# ]] && continue
  key="\${line%%=*}"
  val="\${line#*=}"
  if grep -q "^\${key}=" "\$ENV_FILE"; then
    # Delimiter | avoids clashes with / in URLs and JSON.
    sed -i "s|^\${key}=.*|\${key}=\${val}|" "\$ENV_FILE"
  else
    printf '\n# AI research/drafting — pushed %s\n%s=%s\n' "\$(date -u +%Y-%m-%d)" "\$key" "\$val" >> "\$ENV_FILE"
  fi
  # Redact values in log output.
  if [[ \${#val} -gt 8 ]]; then
    echo "  \$key=***\${val: -8}"
  else
    echo "  \$key=***"
  fi
done < "\$PATCH"

rm -f "\$PATCH"
REMOTE

echo "→ Rolling restart app + worker to pick up .env"
ssh "$HOST" "cd $REMOTE_ROOT/docker-swarm && docker service update --force legal-backend_app && docker service update --force legal-backend_worker"

echo "Done. Verify: curl -s https://legal-api.odaflow.com/api/v1/health/ai | head -c 500"
