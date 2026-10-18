#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Starting background job workers (BullMQ)…"
exec npx ts-node -r tsconfig-paths/register src/jobs/workers/worker.main.ts
