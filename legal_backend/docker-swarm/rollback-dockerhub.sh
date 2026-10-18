#!/bin/bash
# Rollback script for Docker Hub images
# Works for both prod and dev -- rolls back to previous Swarm revision

# Configuration
IMAGE_TAG="${IMAGE_TAG:-latest}"
STACK_NAME="legal-backend"
SERVICE_NAMES=(app worker)
LOG_FILE="$(dirname "$0")/rollback-dockerhub.log"

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
trap 'log_error "Rollback failed at line $LINENO"' ERR

# Start logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log "🔄 Starting rollback process (environment: ${IMAGE_TAG})"

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

# Perform rollback using Docker Swarm (app + worker share the same image)
SERVICE_NAMES=(app worker)
log "Executing Docker Swarm rollback..."
for SERVICE_NAME in "${SERVICE_NAMES[@]}"; do
  FULL_SERVICE="${STACK_NAME}_${SERVICE_NAME}"
  if docker service ls --format '{{.Name}}' | grep -qx "$FULL_SERVICE"; then
    log "Rolling back $FULL_SERVICE..."
    docker service rollback "$FULL_SERVICE"
  else
    log_warning "Service $FULL_SERVICE not found — skipping rollback"
  fi
done

log_success "Docker service rollback initiated"

# Wait for rollback to complete
log "Waiting for rollback to complete..."
sleep 10

# Check service health
log "Checking service health after rollback..."
MAX_ATTEMPTS=20
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    # Check if the service is running
    if docker service ls | grep -q "$STACK_NAME.*Running"; then
        log_success "Service is running after rollback"
        break
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log_error "Service failed to start after rollback"
        exit 1
    fi
    
    log "Attempt $ATTEMPT/$MAX_ATTEMPTS: Waiting for service to start..."
    sleep 10
done

# Perform health checks
log "Performing health checks after rollback..."
HEALTH_CHECK_URL="http://localhost:4000/api/v1/health"
MAX_HEALTH_ATTEMPTS=15
HEALTH_ATTEMPT=0

while [ $HEALTH_ATTEMPT -lt $MAX_HEALTH_ATTEMPTS ]; do
    HEALTH_ATTEMPT=$((HEALTH_ATTEMPT + 1))
    
    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log_success "Health check passed after rollback"
        break
    fi
    
    if [ $HEALTH_ATTEMPT -eq $MAX_HEALTH_ATTEMPTS ]; then
        log_error "Health check failed after rollback"
        exit 1
    fi
    
    log "Health check attempt $HEALTH_ATTEMPT/$MAX_HEALTH_ATTEMPTS: Waiting for service to be healthy..."
    sleep 15
done

# Show rollback summary
log "=== Rollback Summary ==="
log "Stack: $STACK_NAME"
log "Services: ${SERVICE_NAMES[*]}"
log "Status: SUCCESS"

# Show service status
log "=== Service Status ==="
docker service ls | grep "$STACK_NAME" || log_warning "No services found for stack $STACK_NAME"

log_success "🎉 Rollback completed successfully!"

exit 0
