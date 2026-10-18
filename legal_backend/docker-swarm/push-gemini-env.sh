#!/usr/bin/env bash
# Merge Gemini / Vertex env vars from local legal_backend/.env onto production.
# Does NOT replace the remote file — only updates listed keys.
#
# Usage: ./push-gemini-env.sh [ssh-host]
set -euo pipefail

HOST="${1:-legal-backend}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_ENV="$BACKEND_DIR/.env"
REMOTE_ROOT="/home/ubuntu/legal_backend"
REMOTE_ENV="$REMOTE_ROOT/.env"

VARS=(
  AI_ALLOWED_PROVIDERS
  AI_PROVIDER
  AI_DEFAULT_PROVIDER
  GOOGLE_CLOUD_PROJECT
  GOOGLE_APPLICATION_CREDENTIALS
  VERTEX_LOCATION
  GOOGLE_CLOUD_LOCATION
  GEMINI_MODEL
  GEMINI_FAST_MODEL
  GEMINI_REASONING_MODEL
  GEMINI_VERIFIER_MODEL
  GEMINI_EMBEDDING_MODEL
  DOCUMENT_AI_LOCATION
  DOCUMENT_AI_PROCESSOR_ID
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
    continue
  fi
  if [[ "$var" == "GOOGLE_APPLICATION_CREDENTIALS" ]]; then
    echo "GOOGLE_APPLICATION_CREDENTIALS=/usr/app/odaflow-50999d5f681a.json" >> "$PATCH"
  else
    printf '%s\n' "$line" >> "$PATCH"
  fi
done

echo "→ Merging Gemini env keys on $HOST"
scp "$PATCH" "$HOST:/tmp/gemini-env.patch"
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
ENV_FILE="$REMOTE_ENV"
PATCH="/tmp/gemini-env.patch"
cp "\$ENV_FILE" "\${ENV_FILE}.bak.\$(date -u +%Y%m%dT%H%M%SZ)"
while IFS= read -r line || [[ -n "\$line" ]]; do
  [[ -z "\$line" || "\$line" =~ ^# ]] && continue
  key="\${line%%=*}"
  val="\${line#*=}"
  if grep -q "^\${key}=" "\$ENV_FILE"; then
    sed -i "s|^\${key}=.*|\${key}=\${val}|" "\$ENV_FILE"
  else
    printf '\n%s=%s\n' "\$key" "\$val" >> "\$ENV_FILE"
  fi
done < "\$PATCH"
rm -f "\$PATCH"
REMOTE

echo "→ Rolling restart app + worker"
ssh "$HOST" "cd $REMOTE_ROOT/docker-swarm && docker service update --force legal-backend_app && docker service update --force legal-backend_worker"
echo "Done."
