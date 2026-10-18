#!/usr/bin/env bash
# Enable prompt refinement on production (legal-api.odaflow.com).
# Usage: ./push-prompt-refinement-env.sh [ssh-host]
set -euo pipefail

HOST="${1:-legal-backend}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_ROOT="/home/ubuntu/legal_backend"
REMOTE_ENV="$REMOTE_ROOT/.env"
VAR_NAME="ENABLE_PROMPT_REFINEMENT"
VAR_VALUE="${ENABLE_PROMPT_REFINEMENT:-true}"

echo "→ Setting $VAR_NAME=$VAR_VALUE in $HOST:$REMOTE_ENV"
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
ENV_FILE="$REMOTE_ENV"

if [[ ! -f "\$ENV_FILE" ]]; then
  echo "Missing \$ENV_FILE on server"
  exit 1
fi

if grep -q "^${VAR_NAME}=" "\$ENV_FILE"; then
  sed -i "s|^${VAR_NAME}=.*|${VAR_NAME}=${VAR_VALUE}|" "\$ENV_FILE"
else
  printf '\n# Prompt refinement — restructure user prompts before research/drafting\n${VAR_NAME}=${VAR_VALUE}\n' >> "\$ENV_FILE"
fi

grep "^${VAR_NAME}=" "\$ENV_FILE"
REMOTE

echo "→ Rolling restart app + worker to pick up .env"
ssh "$HOST" "cd $REMOTE_ROOT/docker-swarm && docker service update --force legal-backend_app && docker service update --force legal-backend_worker"

echo "Done. Verify: curl -s https://legal-api.odaflow.com/api/v1/health"
