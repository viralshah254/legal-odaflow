#!/bin/bash
# Deploy from Docker Hub - Zero downtime deployment
# Supports both prod (:latest) and dev (:dev) environments via IMAGE_TAG

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Preserve IMAGE_TAG passed by webhook/CI before sync-env loads deployment/.env (which defaults to latest)
PRESET_IMAGE_TAG="${IMAGE_TAG:-}"

# Sync .env to /etc/environment before anything else
if [ -f "$SCRIPT_DIR/sync-env.sh" ]; then
    source "$SCRIPT_DIR/sync-env.sh"
fi

# Webhook/CI may pass a commit SHA tag — do not let deployment/.env overwrite it
if [ -n "$PRESET_IMAGE_TAG" ]; then
    export IMAGE_TAG="$PRESET_IMAGE_TAG"
fi

# Configuration (reads IMAGE_TAG from env or .env via sync-env, or defaults to latest)
IMAGE_TAG="${IMAGE_TAG:-latest}"
STACK_NAME="legal-backend"
STACK_FILE="${STACK_FILE:-docker-stack.yml}"
if [ "$IMAGE_TAG" = "dev" ]; then
  STACK_FILE="docker-stack-dev.yml"
fi
# App + BullMQ worker share the same backend image on every deploy.
SERVICE_NAMES=(app worker)
FULL_IMAGE="ayienda/legal-byodaflow:${IMAGE_TAG}"
LOG_FILE="$SCRIPT_DIR/deploy-dockerhub.log"
# When run from webhook's docker:24-cli container, localhost is not the API host — use host network or explicit URL.
if [ -f /.dockerenv ] && [ "${API_URL:-}" = "http://localhost:4000" ]; then
  API_URL="http://127.0.0.1:4000"
fi
HEALTH_URL="${API_URL:-http://localhost:4000}/api/v1/health"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Error handling
set -e
trap 'log_error "Deployment failed at line $LINENO"' ERR

# Start logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log "🚀 Starting deployment from Docker Hub (tag: ${IMAGE_TAG})"

# Check if Docker Swarm is active
if ! docker info | grep -q "Swarm: active"; then
    log_error "Docker Swarm is not active"
    exit 1
fi

# Check if stack exists
if ! docker stack ls | grep -q "$STACK_NAME"; then
    log_error "Stack $STACK_NAME does not exist"
    exit 1
fi

# Login to Docker Hub (use DOCKER_HUB_TOKEN from .env / sync-env)
log "Logging into Docker Hub..."
echo "${DOCKER_HUB_TOKEN:-}" | docker login -u ayienda --password-stdin

if [ $? -ne 0 ]; then
    log_error "Failed to login to Docker Hub"
    exit 1
fi

log_success "Docker Hub login successful"

# Prevent disk-full pull failures without blocking deploy for many minutes on a full disk.
log "Pruning dangling Docker images before pull (max 120s)..."
if timeout 120 docker image prune -f >/dev/null 2>&1; then
  log_success "Dangling images pruned"
else
  log_warning "Image prune skipped, timed out, or failed (non-fatal)"
fi

# Pull latest image with retry logic
log "Pulling latest image from Docker Hub..."
MAX_PULL_ATTEMPTS=5
PULL_ATTEMPT=0

while [ $PULL_ATTEMPT -lt $MAX_PULL_ATTEMPTS ]; do
    PULL_ATTEMPT=$((PULL_ATTEMPT + 1))
    
    log "Pull attempt $PULL_ATTEMPT/$MAX_PULL_ATTEMPTS..."
    docker pull "$FULL_IMAGE"
    
    if [ $? -eq 0 ]; then
        log_success "Image pulled successfully"
        break
    fi
    
    if [ $PULL_ATTEMPT -eq $MAX_PULL_ATTEMPTS ]; then
        log_error "Failed to pull image from Docker Hub after $MAX_PULL_ATTEMPTS attempts"
        exit 1
    fi
    
    log_warning "Pull failed, retrying in 30 seconds..."
    sleep 30
done

# Apply pending database migrations before rolling out the new image
log "Applying database migrations..."
ENV_FILE="${HOST_PROJECT_ROOT:-/home/ubuntu/legal_backend}/.env"
if [ ! -f "$ENV_FILE" ]; then
  log_error "App .env not found at ${ENV_FILE} — set HOST_PROJECT_ROOT on the deploy runner"
  exit 1
fi
MIGRATE_NETWORK="${STACK_NAME}_legal-network"
if docker run --rm \
  --network "$MIGRATE_NETWORK" \
  -v "${ENV_FILE}:/usr/app/.env:ro" \
  "$FULL_IMAGE" \
  npx prisma migrate deploy; then
  log_success "Database migrations applied"
else
  log_error "Database migration failed — aborting deployment"
  exit 1
fi

# Ensure worker service exists (first deploy after stack change)
WORKER_SERVICE="${STACK_NAME}_worker"
if ! docker service ls --format '{{.Name}}' | grep -qx "$WORKER_SERVICE"; then
  log "Worker service missing — running stack deploy ($STACK_FILE)..."
  docker stack deploy -c "$SCRIPT_DIR/$STACK_FILE" "$STACK_NAME"
  sleep 10
fi

# Update app + worker with zero downtime using registry authentication
for SERVICE_NAME in "${SERVICE_NAMES[@]}"; do
  FULL_SERVICE="${STACK_NAME}_${SERVICE_NAME}"
  if ! docker service ls --format '{{.Name}}' | grep -qx "$FULL_SERVICE"; then
    log_warning "Service $FULL_SERVICE not found — skipping"
    continue
  fi
  log "Updating $FULL_SERVICE with zero downtime using registry auth..."
  docker service update --with-registry-auth --image "$FULL_IMAGE" "$FULL_SERVICE"
  log_success "$FULL_SERVICE update initiated"
done

# Wait for rollouts
log "Waiting for service updates to complete..."
sleep 10

wait_for_replicas() {
  local service="$1"
  local max_attempts="${2:-20}"
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    local replicas
    replicas=$(docker service ls --filter "name=$service" --format '{{.Replicas}}' | head -1)
    if echo "$replicas" | grep -q '^1/1$'; then
      log_success "$service is running ($replicas)"
      return 0
    fi
    if [ $attempt -eq $max_attempts ]; then
      log_error "$service failed to reach 1/1 (last status: $replicas)"
      return 1
    fi
    log "Attempt $attempt/$max_attempts: $service replicas=$replicas"
    sleep 10
  done
}

wait_for_replicas "${STACK_NAME}_app" 20
wait_for_replicas "${STACK_NAME}_worker" 20

# Probe /api/v1/health. The webhook runs this script inside docker:24-cli; without
# --network host, localhost/app hostnames are unreachable even when Swarm is healthy.
probe_api_health() {
  local url="$1"
  if curl -f -s "$url" > /dev/null 2>&1; then
    return 0
  fi

  if [ -f /.dockerenv ]; then
    local fallback="http://127.0.0.1:4000/api/v1/health"
    if curl -f -s "$fallback" > /dev/null 2>&1; then
      HEALTH_URL="$fallback"
      return 0
    fi

    local replicas
    replicas=$(docker service ls --filter "name=${STACK_NAME}_app" --format '{{.Replicas}}' | head -1)
    if echo "$replicas" | grep -q '^1/1$'; then
      log_warning "HTTP health probe unreachable from deploy container; Swarm replicas=$replicas — continuing"
      return 0
    fi
  fi

  return 1
}

log "Checking API health at ${HEALTH_URL}..."
MAX_ATTEMPTS=20
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  sleep 3

  if probe_api_health "$HEALTH_URL"; then
    log_success "API health check passed (${HEALTH_URL})"
    break
  fi

  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    log_error "API health check failed after $MAX_ATTEMPTS attempts"
    exit 1
  fi

  log "Attempt $ATTEMPT/$MAX_ATTEMPTS: waiting for API health..."
  sleep 10
done

# Show deployment summary
log "=== Deployment Summary ==="
log "Stack: $STACK_NAME"
log "Services: ${SERVICE_NAMES[*]}"
log "Image: $FULL_IMAGE"
log "Status: SUCCESS"

# Show service status
log "=== Service Status ==="
docker service ls | grep "$STACK_NAME" || log_warning "No services found for stack $STACK_NAME"

log_success "🎉 Deployment completed successfully!"
log "Dashboard available at: http://localhost:3001"
log "Health monitor available at: http://localhost:3002/health"

# Reload nginx when host config is present (issue-checker preview timeouts, etc.)
NGINX_SRC="${HOST_PROJECT_ROOT:-/home/ubuntu/legal_backend}/nginx.conf"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/legal-api}"
if [ -f "$NGINX_SRC" ] && [ ! -f /.dockerenv ] && command -v sudo >/dev/null 2>&1; then
  log "Reloading nginx from ${NGINX_SRC}..."
  if sudo cp "$NGINX_SRC" "$NGINX_SITE" && sudo nginx -t && sudo systemctl reload nginx; then
    log_success "nginx config reloaded"
  else
    log_warning "nginx reload failed (non-fatal)"
  fi
elif [ -f /.dockerenv ]; then
  log "Skipping nginx reload (deploy container — run on Swarm host after git pull)"
fi

# Reclaim disk: each deploy pulls a ~1GB+ image; drop stale commit tags.
log "Pruning old app images (keeping latest and ${IMAGE_TAG})..."
while IFS= read -r tag; do
  [ -z "$tag" ] || [ "$tag" = "<none>" ] && continue
  if [ "$tag" = "latest" ] || [ "$tag" = "$IMAGE_TAG" ]; then
    continue
  fi
  docker rmi "ayienda/legal-byodaflow:${tag}" 2>/dev/null || true
done < <(docker images ayienda/legal-byodaflow --format '{{.Tag}}')
docker image prune -f >/dev/null 2>&1 || true

exit 0
