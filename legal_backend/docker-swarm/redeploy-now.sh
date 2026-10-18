#!/bin/bash
# Force production redeploy from Docker Hub (run on the Swarm host via SSH).
# Usage:
#   ./redeploy-now.sh                  # deploy ayienda/legal-byodaflow:latest
#   ./redeploy-now.sh c3ba7d9c8f8...  # deploy a specific commit SHA tag
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export IMAGE_TAG="${1:-latest}"
export HOST_PROJECT_ROOT="${HOST_PROJECT_ROOT:-/home/ubuntu/legal_backend}"

echo "Redeploying ayienda/legal-byodaflow:${IMAGE_TAG} ..."
exec bash "${SCRIPT_DIR}/deploy-from-dockerhub.sh"
