# Docker Swarm Deployment System

This directory contains the Docker Swarm deployment system for OdaFlow Backend, providing zero-downtime deployments with automatic rollback capabilities.

## 🚀 Features

- **Zero-downtime deployments** using Docker Swarm rolling updates
- **Automatic rollback** when health checks fail
- **Real-time monitoring** with health checks and dashboard
- **Manual rollback** capabilities via dashboard or CLI
- **Comprehensive logging** and deployment tracking
- **Redis-based** deployment history and status tracking

## 📁 Files

- `docker-stack.yml` - Docker Swarm stack configuration
- `docker-compose.override.yml` - Local development overrides
- `deploy-swarm.sh` - Main deployment script
- `rollback.sh` - Rollback script
- `init-swarm.sh` - Initialize Docker Swarm and deploy stack
- `README.md` - This documentation

## 🛠️ Setup

### 1. Initialize Docker Swarm

```bash
# Make scripts executable
chmod +x *.sh

# Initialize Docker Swarm and deploy the stack
./init-swarm.sh
```

### 2. Verify Deployment

```bash
# Check stack status
docker stack services odaflow-backend

# Check service health
curl http://localhost:8080/api/health

# Access dashboard
open http://localhost:3001
```

## 🔄 Deployment Process

### Automatic Deployment (via Webhook)

1. Push to `main` branch triggers webhook
2. Webhook server responds immediately to GitHub
3. Deployment runs in background using Docker Swarm
4. Health checks monitor the deployment
5. Automatic rollback if health checks fail

### Manual Deployment

```bash
# Deploy latest changes
./deploy-swarm.sh

# Deploy specific commit (if needed)
git checkout <commit-hash>
./deploy-swarm.sh
```

## 🔙 Rollback Process

### Automatic Rollback

- Triggered when health checks fail after deployment
- Occurs within 5 minutes of deployment
- Uses Docker Swarm's built-in rollback mechanism

### Manual Rollback

```bash
# Interactive rollback
./rollback.sh

# Rollback specific deployment
./rollback.sh --deployment-id deploy-1234567890-abc123

# List recent deployments
./rollback.sh --list
```

### Dashboard Rollback

1. Open dashboard at `http://localhost:3001`
2. Find the deployment to rollback
3. Click "Rollback" button
4. Confirm the rollback

## 📊 Monitoring

### Health Monitor

- **URL**: `http://localhost:3002/health`
- **Purpose**: Monitors service health and triggers rollbacks
- **Checks**: API health, Redis connectivity, response times

### Dashboard

- **URL**: `http://localhost:3001`
- **Purpose**: Visual interface for deployment management
- **Features**:
  - Real-time service status
  - Deployment history
  - Manual rollback controls
  - Health check results

### Service Status

```bash
# View all services
docker stack services odaflow-backend

# View service logs
docker service logs odaflow-backend_app

# Scale service
docker service scale odaflow-backend_app=3
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
NODE_ENV=production
REDIS_URL=redis://redis:6379

# Optional
GITHUB_WEBHOOK_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173,https://odaflow.com
```

### Docker Swarm Settings

The stack is configured with:

- **2 replicas** of the main application
- **Rolling updates** with 1 replica at a time
- **Health checks** every 30 seconds
- **Automatic rollback** on failure
- **Resource limits** and reservations

## 🚨 Troubleshooting

### Common Issues

1. **Service won't start**

   ```bash
   # Check service logs
   docker service logs odaflow-backend_app

   # Check service status
   docker service ps odaflow-backend_app
   ```

2. **Health checks failing**

   ```bash
   # Check API health directly
   curl http://localhost:8080/api/health

   # Check Redis connectivity
   redis-cli ping
   ```

3. **Rollback not working**

   ```bash
   # Check rollback script
   ./rollback.sh --list

   # Manual rollback
   docker service rollback odaflow-backend_app
   ```

### Logs

```bash
# View deployment logs
tail -f deploy-swarm.log

# View rollback logs
tail -f rollback.log

# View Docker logs
docker service logs odaflow-backend_app -f
```

## 🔄 Migration from Docker Compose

### 1. Stop existing services

```bash
cd /path/to/api
docker-compose down
```

### 2. Initialize Docker Swarm

```bash
cd /path/to/docker-swarm
./init-swarm.sh
```

### 3. Update webhook server

```bash
# Stop old webhook server
pkill -f webhook-server.js

# Start new webhook server
node webhook-server-swarm.js
```

### 4. Verify migration

```bash
# Check services
docker stack services odaflow-backend

# Test health
curl http://localhost:8080/api/health

# Access dashboard
open http://localhost:3001
```

## 📈 Performance Benefits

- **Zero downtime** during deployments
- **Automatic scaling** with Docker Swarm
- **Load balancing** across multiple replicas
- **Health monitoring** prevents bad deployments
- **Quick rollback** when issues are detected

## 🔐 Security

- **Webhook signature verification**
- **Container isolation** with Docker Swarm
- **Resource limits** prevent resource exhaustion
- **Health checks** prevent malicious deployments
- **Rollback protection** against bad code

## 📝 Best Practices

1. **Always test** deployments in development first
2. **Monitor** the dashboard during deployments
3. **Keep** deployment logs for debugging
4. **Use** meaningful commit messages
5. **Scale** services based on load
6. **Backup** important data before major deployments

## 🆘 Support

If you encounter issues:

1. Check the logs: `tail -f deploy-swarm.log`
2. Verify Docker Swarm: `docker info | grep Swarm`
3. Check service status: `docker stack services odaflow-backend`
4. Test health: `curl http://localhost:8080/api/health`
5. Review dashboard: `http://localhost:3001`

---

**Happy Deploying! 🚀**
