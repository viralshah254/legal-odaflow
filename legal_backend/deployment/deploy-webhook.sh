#!/bin/bash
# Deploy webhook service to Docker Swarm
# Uses sync-env.sh for environment management

# Configuration
STACK_NAME="legal-backend"
WEBHOOK_SERVICE="${STACK_NAME}_webhook"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SWARM_DIR="$(dirname "$SCRIPT_DIR")/docker-swarm"

# Sync .env to /etc/environment and load vars
if [ -f "$SWARM_DIR/sync-env.sh" ]; then
    source "$SWARM_DIR/sync-env.sh"
fi

IMAGE_TAG="${IMAGE_TAG:-latest}"

# Pick stack file based on environment
if [ "$IMAGE_TAG" = "dev" ]; then
    STACK_FILE="docker-stack-dev.yml"
else
    STACK_FILE="docker-stack.yml"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"; }
log_success() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"; }
log_warning() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"; }

cd "$SWARM_DIR"

log "🐳 Deploying to Docker Swarm (env: ${IMAGE_TAG}, stack: ${STACK_FILE})"

# Validate webhook secret
if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
    log_error "GITHUB_WEBHOOK_SECRET is not set"
    log "Create deployment/.env with your secrets (see deployment/.env.example)"
    exit 1
fi

log "📋 Configuration:"
log "   GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET:0:8}... (masked)"
log "   IMAGE_TAG: ${IMAGE_TAG}"
log "   STACK_FILE: ${STACK_FILE}"

# Check if Docker Swarm is initialized
if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
    log "Swarm not active. Initializing..."
    PRIMARY_IP=$(hostname -I | awk '{print $1}')
    docker swarm init --advertise-addr "$PRIMARY_IP"
    log_success "Docker Swarm initialized"
fi

# Login to Docker Hub (use DOCKER_HUB_TOKEN from .env / sync-env)
log "Logging into Docker Hub..."
echo "${DOCKER_HUB_TOKEN:-}" | docker login -u ayienda --password-stdin
log_success "Docker Hub login successful"

# Pull webhook image
log "Pulling webhook image..."
docker pull ayienda/legal-byodaflow-webhook:latest
log_success "Webhook image pulled"

# Deploy the stack (redis + webhook + portainer start immediately, app starts when image exists)
log "🚀 Deploying stack: ${STACK_NAME} (using ${STACK_FILE})"
if docker stack deploy -c "$STACK_FILE" --with-registry-auth "$STACK_NAME"; then
    log_success "Stack deployed successfully"
else
    log_error "Failed to deploy stack"
    exit 1
fi

# Wait for webhook service to be ready
log "Waiting for webhook service..."
sleep 15

# Check webhook service status
log "Webhook service status:"
docker service ps "${WEBHOOK_SERVICE}" --format "table {{.ID}}\t{{.Name}}\t{{.Image}}\t{{.CurrentState}}" 2>/dev/null || log_warning "Webhook service not found yet"

# Test webhook health
log "Testing webhook health..."
MAX_ATTEMPTS=10
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Webhook is healthy and responding"
        break
    fi
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log_warning "Webhook health check not passing yet -- may still be starting"
        log "Check logs: docker service logs ${WEBHOOK_SERVICE}"
    fi
    sleep 5
done

# Show status of all services
log "=== All Services ==="
docker stack services "$STACK_NAME" 2>/dev/null

APP_IMAGE="ayienda/legal-byodaflow:${IMAGE_TAG}"
if docker pull "$APP_IMAGE" > /dev/null 2>&1; then
    log_success "App image ($APP_IMAGE) exists -- app service will start"
else
    log_warning "App image ($APP_IMAGE) not on DockerHub yet"
    log "   App service will keep retrying until you push to the '$([ "$IMAGE_TAG" = "dev" ] && echo "liveness" || echo "main")' branch"
    log "   Webhook + Redis + Portainer are running and ready"
fi

log_success "🎉 Deployment complete!"
log ""
log "Webhook: http://localhost:3000/health"
log "Portainer: http://localhost:9000"
