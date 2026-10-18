#!/usr/bin/env bash
# Upload Firebase Admin SDK JSON and update production .env (legal-api.odaflow.com).
# Usage: ./push-firebase-credentials.sh [ssh-host]
set -euo pipefail

HOST="${1:-legal-backend}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
JSON_NAME="umbrella-95da1-firebase-adminsdk-fbsvc-11e5b5d0f4.json"
JSON_LOCAL="$BACKEND_DIR/$JSON_NAME"
REMOTE_ROOT="/home/ubuntu/legal_backend"
REMOTE_ENV="$REMOTE_ROOT/.env"

if [[ ! -f "$JSON_LOCAL" ]]; then
  echo "Missing $JSON_LOCAL"
  exit 1
fi

echo "→ Uploading $JSON_NAME to $HOST:$REMOTE_ROOT/"
scp "$JSON_LOCAL" "$HOST:$REMOTE_ROOT/$JSON_NAME"
ssh "$HOST" "chmod 600 '$REMOTE_ROOT/$JSON_NAME'"

echo "→ Updating Firebase env vars in $REMOTE_ENV"
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
ENV_FILE=/home/ubuntu/legal_backend/.env
JSON_NAME=umbrella-95da1-firebase-adminsdk-fbsvc-11e5b5d0f4.json

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE on server"
  exit 1
fi

# Remove legacy inline credentials (file path is preferred).
sed -i '/^FIREBASE_CLIENT_EMAIL=/d' "$ENV_FILE"
sed -i '/^FIREBASE_PRIVATE_KEY=/d' "$ENV_FILE"

if grep -q '^FIREBASE_SERVICE_ACCOUNT_PATH=' "$ENV_FILE"; then
  sed -i "s|^FIREBASE_SERVICE_ACCOUNT_PATH=.*|FIREBASE_SERVICE_ACCOUNT_PATH=./$JSON_NAME|" "$ENV_FILE"
else
  printf '\nFIREBASE_SERVICE_ACCOUNT_PATH=./%s\n' "$JSON_NAME" >> "$ENV_FILE"
fi

if grep -q '^FIREBASE_PROJECT_ID=' "$ENV_FILE"; then
  sed -i 's|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=umbrella-95da1|' "$ENV_FILE"
else
  echo 'FIREBASE_PROJECT_ID=umbrella-95da1' >> "$ENV_FILE"
fi

grep -E '^FIREBASE_' "$ENV_FILE"
REMOTE

echo "→ Syncing docker-stack.yml (Firebase JSON volume mount)"
scp "$SCRIPT_DIR/docker-stack.yml" "$HOST:$REMOTE_ROOT/docker-swarm/docker-stack.yml"
scp "$SCRIPT_DIR/docker-stack-dev.yml" "$HOST:$REMOTE_ROOT/docker-swarm/docker-stack-dev.yml"

echo "→ Redeploying stack (rolling update)"
ssh "$HOST" "cd $REMOTE_ROOT/docker-swarm && docker stack deploy -c docker-stack.yml legal-backend"

echo "Done. Verify: curl -s https://legal-api.odaflow.com/api/v1/health"
