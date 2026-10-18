FROM node:22.18.0-alpine

# Install bash and Docker CLI for running deployment scripts
RUN apk add --no-cache bash docker-cli

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application files
COPY . .

# Note: Running as root is required for webhook to:
# 1. Write to mounted docker-swarm directory
# 2. Execute Docker commands via socket
# 3. Run deployment scripts with proper permissions

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the webhook server
CMD ["node", "webhook-server-unified.js"]
