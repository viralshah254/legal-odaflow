#!/bin/bash
# Initialize Docker Swarm and deploy the stack
# Usage: ./init-swarm.sh [stack-file]
#   stack-file: docker-stack.yml (default, prod) or docker-stack-dev.yml (dev)

SWARM_DIR="$(cd "$(dirname "$0")" && pwd)"

# Sync .env to /etc/environment before anything else
if [ -f "$SWARM_DIR/sync-env.sh" ]; then
    source "$SWARM_DIR/sync-env.sh"
fi

# Configuration (reads IMAGE_TAG from .env via sync-env, or defaults to latest)
STACK_FILE="${1:-docker-stack.yml}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
STACK_NAME="legal-backend"
FULL_IMAGE="ayienda/legal-byodaflow:${IMAGE_TAG}"
LOG_FILE="$SWARM_DIR/init-swarm.log"

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
trap 'log_error "Initialization failed at line $LINENO"' ERR

# Start logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log "🚀 Initializing Docker Swarm for Legal OdaFlow Backend (stack: ${STACK_FILE}, image tag: ${IMAGE_TAG})"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    log_error "Docker is not running"
    exit 1
fi

# Check if Docker Swarm is already initialized
if docker info | grep -q "Swarm: active"; then
    log_warning "Docker Swarm is already initialized"
else
    log "Initializing Docker Swarm..."
    
    # Get the primary IP address
    PRIMARY_IP=$(hostname -I | awk '{print $1}')
    log "Using IP address: $PRIMARY_IP"
    
    # Initialize Docker Swarm
    docker swarm init --advertise-addr "$PRIMARY_IP"
    
    if [ $? -eq 0 ]; then
        log_success "Docker Swarm initialized successfully"
    else
        log_error "Failed to initialize Docker Swarm"
        exit 1
    fi
fi

# Create overlay network if it doesn't exist
log "Creating overlay network..."
if ! docker network ls | grep -q "legal-backend_legal-network"; then
    docker network create --driver overlay --attachable legal-network
    log_success "Overlay network created"
else
    log "Overlay network already exists"
fi

# Check if Redis is available
log "Checking Redis availability..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        log_success "Redis is available"
    else
        log_warning "Redis is not running, but will be started with the stack"
    fi
else
    log_warning "Redis CLI not found, Redis will be started with the stack"
fi

# Login to Docker Hub (use DOCKER_HUB_TOKEN from .env / sync-env)
log "Logging into Docker Hub..."
echo "${DOCKER_HUB_TOKEN:-}" | docker login -u ayienda --password-stdin

if [ $? -ne 0 ]; then
    log_error "Failed to login to Docker Hub"
    exit 1
fi

log_success "Docker Hub login successful"

# Pull the application image from Docker Hub
log "Pulling application image from Docker Hub: $FULL_IMAGE"
docker pull "$FULL_IMAGE"

if [ $? -eq 0 ]; then
    log_success "Docker image pulled successfully"
else
    log_error "Failed to pull Docker image from Docker Hub"
    exit 1
fi

# Deploy the stack
log "Deploying stack: $STACK_NAME (using $STACK_FILE)"
docker stack deploy -c "$STACK_FILE" "$STACK_NAME"

if [ $? -eq 0 ]; then
    log_success "Stack deployed successfully"
else
    log_error "Failed to deploy stack"
    exit 1
fi

# Wait for services to be ready
log "Waiting for services to start..."
sleep 15

# Check service status
log "Checking service status..."
docker stack services "$STACK_NAME"

# Wait for health checks
log "Waiting for health checks to pass..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    # Check if all services are running
    RUNNING_SERVICES=$(docker stack services "$STACK_NAME" --format "{{.Replicas}}" | grep -c "1/1" || echo "0")
    TOTAL_SERVICES=$(docker stack services "$STACK_NAME" --format "{{.Name}}" | wc -l)
    
    if [ "$RUNNING_SERVICES" -eq "$TOTAL_SERVICES" ]; then
        log_success "All services are running"
        break
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log_error "Services failed to start after $MAX_ATTEMPTS attempts"
        log "Service status:"
        docker stack services "$STACK_NAME"
        exit 1
    fi
    
    log "Attempt $ATTEMPT/$MAX_ATTEMPTS: Waiting for services to start... ($RUNNING_SERVICES/$TOTAL_SERVICES running)"
    sleep 10
done

# Perform health checks
log "Performing health checks..."
HEALTH_CHECK_URL="http://localhost:4000/api/v1/health"
MAX_HEALTH_ATTEMPTS=20
HEALTH_ATTEMPT=0

while [ $HEALTH_ATTEMPT -lt $MAX_HEALTH_ATTEMPTS ]; do
    HEALTH_ATTEMPT=$((HEALTH_ATTEMPT + 1))
    
    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log_success "Health check passed"
        break
    fi
    
    if [ $HEALTH_ATTEMPT -eq $MAX_HEALTH_ATTEMPTS ]; then
        log_error "Health check failed after $MAX_HEALTH_ATTEMPTS attempts"
        log "Please check the service logs:"
        docker service logs "${STACK_NAME}_app"
        exit 1
    fi
    
    log "Health check attempt $HEALTH_ATTEMPT/$MAX_HEALTH_ATTEMPTS: Waiting for service to be healthy..."
    sleep 15
done

# Show final status
log "=== Initialization Complete ==="
log "Stack: $STACK_NAME"
log "Status: SUCCESS"

# Show service status
log "=== Service Status ==="
docker stack services "$STACK_NAME"

# Show useful URLs
log "=== Useful URLs ==="
log "API Health: http://localhost:4000/api/health"
log "Webhook Server: http://localhost:3000"
log "Webhook Dashboard: http://localhost:3000/dashboard"
log "Webhook Health: http://localhost:3000/health"
log "Deployments: http://localhost:3000/deployments"

# Show management commands
log "=== Management Commands ==="
log "View services: docker stack services $STACK_NAME"
log "View logs: docker service logs ${STACK_NAME}_app"
log "Scale service: docker service scale ${STACK_NAME}_app=3"
log "Update stack: docker stack deploy -c $STACK_FILE $STACK_NAME"
log "Remove stack: docker stack rm $STACK_NAME"

log_success "🎉 Docker Swarm initialization completed successfully!"

# Optional: Show join token for additional nodes
log "=== Adding Worker Nodes ==="
log "To add worker nodes to this swarm, run the following command on each worker:"
docker swarm join-token worker | grep "docker swarm join" || log_warning "Could not get join token"

exit 0
