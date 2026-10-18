#!/bin/bash
# Reload webhook service so it picks up deployment/webhook-server-unified.js from the host mount.
# Run on the Swarm manager: bash docker-swarm/restart-webhook.sh
set -euo pipefail

HOST_PROJECT_ROOT="${HOST_PROJECT_ROOT:-/home/ubuntu/legal_backend}"
STACK_DIR="${HOST_PROJECT_ROOT}/docker-swarm"

cd "${HOST_PROJECT_ROOT}"
git pull origin main

# Load GITHUB_WEBHOOK_SECRET and other deploy vars into the current shell before
# running docker stack deploy — the stack file expands ${GITHUB_WEBHOOK_SECRET} from
# the environment at deploy time, so an empty env results in a crashed webhook container.
if [ -f "${STACK_DIR}/sync-env.sh" ]; then
  echo "Loading deployment env vars via sync-env.sh..."
  source "${STACK_DIR}/sync-env.sh"
else
  echo "WARNING: sync-env.sh not found at ${STACK_DIR}/sync-env.sh — GITHUB_WEBHOOK_SECRET must already be exported"
fi

cd "${STACK_DIR}"
docker stack deploy -c docker-stack.yml legal-backend
docker service update --force legal-backend_webhook

echo "Webhook service redeployed — confirm mount includes deployment/webhook-server-unified.js"
echo "Run: docker service ps legal-backend_webhook   to verify it is 1/1 Running"
