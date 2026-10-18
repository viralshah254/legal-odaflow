#!/bin/bash
# Build and push webhook Docker image to Docker Hub

# Configuration
IMAGE_NAME="ayienda/legal-byodaflow-webhook"
DOCKERFILE_PATH="./Dockerfile"
CONTEXT_PATH="."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Change to deployment directory
cd "$(dirname "$0")"

log "🏗️  Building webhook Docker image..."

# Get git commit hash for tagging
if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    COMMIT_HASH=$(git rev-parse HEAD)
    SHORT_COMMIT=${COMMIT_HASH:0:12}
    IMAGE_TAG="${IMAGE_NAME}:${SHORT_COMMIT}"
    LATEST_TAG="${IMAGE_NAME}:latest"
    
    log "📝 Git commit: ${SHORT_COMMIT}"
else
    log_warning "⚠️  Git not available, using timestamp tag"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    IMAGE_TAG="${IMAGE_NAME}:${TIMESTAMP}"
    LATEST_TAG="${IMAGE_NAME}:latest"
fi

# Build the Docker image
log "🔨 Building image: ${IMAGE_TAG}"
if docker build -t "${IMAGE_TAG}" -t "${LATEST_TAG}" -f "${DOCKERFILE_PATH}" "${CONTEXT_PATH}"; then
    log_success "✅ Docker image built successfully"
else
    log_error "❌ Failed to build Docker image"
    exit 1
fi

# Check if Docker is logged in
log "🔐 Checking Docker Hub authentication..."
if ! docker info | grep -q "Username:"; then
    log_warning "⚠️  Not logged in to Docker Hub. Please run: docker login"
    read -p "Do you want to login now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker login
    else
        log_error "❌ Cannot push without Docker Hub authentication"
        exit 1
    fi
fi

# Push the images
log "🚀 Pushing images to Docker Hub..."

log "📤 Pushing tagged image: ${IMAGE_TAG}"
if docker push "${IMAGE_TAG}"; then
    log_success "✅ Tagged image pushed successfully"
else
    log_error "❌ Failed to push tagged image"
    exit 1
fi

log "📤 Pushing latest image: ${LATEST_TAG}"
if docker push "${LATEST_TAG}"; then
    log_success "✅ Latest image pushed successfully"
else
    log_error "❌ Failed to push latest image"
    exit 1
fi

log_success "🎉 Webhook Docker image build and push completed!"
log "📋 Summary:"
log "   • Image: ${IMAGE_NAME}"
log "   • Tags: latest, ${SHORT_COMMIT:-$TIMESTAMP}"
log "   • Registry: Docker Hub"

log ""
log "🔄 Next steps:"
log "   1. Update your Docker Swarm stack with the new image"
log "   2. Deploy the updated stack"
log "   3. Verify the webhook service is running"
