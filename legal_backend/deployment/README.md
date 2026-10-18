# GitHub Webhook Deployment Server

This directory contains a mini API server that listens for GitHub webhook events and automatically triggers deployments when code is pushed to the main branch..

## 🚀 Features

- **Automatic Deployment**: Triggers deployment on pushes to main branch
- **Environment Detection**: Uses commit message prefixes to determine environment
- **Security**: Webhook signature verification (optional)
- **Logging**: Comprehensive deployment logs
- **Health Checks**: Built-in health check endpoint
- **Error Handling**: Robust error handling and reporting

## 📁 Structure


```
deployment/
├── webhook-server.js    # Express server for GitHub webhooks
├── deploy.sh           # Deployment script
├── package.json        # Dependencies for webhook server
├── deploy.log          # Deployment logs (created automatically)
└── README.md          # This file
```

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd deployment
npm install
```

### 2. Configure Environment

Update the `WORK_DIR` in `deploy.sh` to match your project path:

```bash
# In deploy.sh, line 5
WORK_DIR="/path/to/your/odaflow-backend"
```

### 3. Make Deploy Script Executable

```bash
chmod +x deploy.sh
```

### 4. Set Webhook Secret (Optional but Recommended)

```bash
export GITHUB_WEBHOOK_SECRET="your-secret-key"
```

## 🚀 Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Using PM2 (Recommended for Production)

```bash
npm run pm2:start    # Start with PM2
npm run pm2:stop     # Stop the server
npm run pm2:restart  # Restart the server
npm run pm2:logs     # View logs
```

## 🔗 GitHub Webhook Configuration

1. Go to your GitHub repository settings
2. Navigate to **Webhooks** section
3. Click **Add webhook**
4. Configure:
   - **Payload URL**: `http://your-server:3000/webhook`
   - **Content type**: `application/json`
   - **Secret**: Your webhook secret (if using)
   - **Events**: Select "Just the push event"

## 📋 API Endpoints

### POST /webhook

- **Purpose**: Receives GitHub webhook events
- **Triggers**: Deployment on pushes to main branch
- **Response**: Success/failure message

### GET /health

- **Purpose**: Health check endpoint
- **Response**: Server status and timestamp

### GET /

- **Purpose**: Server information
- **Response**: Available endpoints and configuration

## 🎯 Deployment Logic

### Environment Detection

- **Development**: Commit messages starting with "dev" → runs `npm run deploy`
- **Production**: All other commits → runs `npm run prod_deploy`

### Deployment Steps

1. **Verification**: Check if push is to main branch
2. **Git Operations**: Pull latest changes and compare commits
3. **Dependencies**: Install if package.json changed
4. **Testing**: Run test suite
5. **Building**: Build the project
6. **Deployment**: Execute appropriate deployment command

### Example Commit Messages

```bash
git commit -m "dev: add new feature"        # → Development deployment
git commit -m "fix: resolve bug in API"     # → Production deployment
git commit -m "feat: new user management"   # → Production deployment
```

## 📊 Logging

All deployment activities are logged to `deploy.log`:

```bash
# View recent logs
tail -f deployment/deploy.log

# View all logs
cat deployment/deploy.log
```

### Log Format

```
=== Deployment started at Mon Jan 15 10:30:00 UTC 2024 ===
Project: odaflow-backend
Working Directory: /path/to/project
Current commit: abc123...
Latest Commit Message: feat: add new API endpoint
Using production environment (default)
Environment set to: production
Running tests...
Building project...
Running deployment command: npm run prod_deploy
=== Deployment completed successfully at Mon Jan 15 10:32:15 UTC 2024 ===
```

## 🔧 Configuration

### Webhook Server (`webhook-server.js`)

- **Port**: 3000 (configurable)
- **Security**: Webhook signature verification
- **Branch Filter**: Only deploys main branch pushes

### Deploy Script (`deploy.sh`)

- **Working Directory**: Configurable project path
- **Environment Detection**: Based on commit message
- **Safety Checks**: Tests and build verification
- **Error Handling**: Exits on any failure

## 🚨 Troubleshooting

### Common Issues

1. **Permission Denied**

   ```bash
   chmod +x deploy.sh
   ```

2. **Wrong Working Directory**

   - Update `WORK_DIR` in `deploy.sh`

3. **Port Already in Use**

   - Change port in `webhook-server.js`
   - Check for existing processes: `lsof -i :3000`

4. **Webhook Not Triggering**
   - Verify GitHub webhook configuration
   - Check server logs
   - Test with curl:
   ```bash
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -d '{"ref":"refs/heads/main","repository":{"name":"test"}}'
   ```

### Debug Commands

```bash
# Test deployment script manually
cd deployment
bash deploy.sh

# Check webhook server status
curl http://localhost:3000/health

# View real-time logs
tail -f deploy.log
```

## 🔒 Security Considerations

1. **Webhook Secret**: Always use a webhook secret in production
2. **Firewall**: Restrict access to webhook endpoint
3. **HTTPS**: Use HTTPS in production
4. **User Permissions**: Run with appropriate user permissions
5. **Log Rotation**: Implement log rotation for deploy.log

## 📈 Monitoring

### Health Checks

```bash
# Check if server is running
curl http://localhost:3000/health

# Check with PM2
pm2 status odaflow-webhook
```

### Log Monitoring

```bash
# Monitor deployment logs
tail -f deploy.log

# Monitor webhook server logs (if using PM2)
pm2 logs odaflow-webhook
```

## 🔄 Integration with Main Project

Add these scripts to your main `package.json`:

```json
{
  "scripts": {
    "deploy": "docker-compose down && docker-compose up -d --build",
    "prod_deploy": "git pull && docker-compose down && docker-compose up -d --build"
  }
}
```

## 🎯 Next Steps

1. **SSL/TLS**: Configure HTTPS for production
2. **Monitoring**: Add monitoring and alerting
3. **Rollback**: Implement rollback functionality
4. **Multi-Environment**: Support for staging environments
5. **Notifications**: Add Slack/Discord notifications

---

**Happy Deploying! 🚀**

# Deployment System

This directory contains the automated deployment system for the odaflow-backend project.

## Files

- `webhook-server.js` - Express server that listens for GitHub webhooks
- `deploy.sh` - Bash script that handles the actual deployment process
- `package.json` - Dependencies for the webhook server

## How It Works

### 🚀 **GitHub Timeout Solution**

GitHub webhooks have a **10-second timeout**. Since our deployment process (tests, build, Docker) takes much longer, the webhook server now:

1. **Responds immediately** to GitHub (within milliseconds)
2. **Runs deployment in background** using `spawn()` with `detached: true`
3. **Logs deployment progress** in real-time to server console
4. **No more GitHub timeout errors!** ✅

### Webhook Flow

1. GitHub sends webhook on push to `main` branch
2. Webhook server **immediately responds** with success status
3. Deployment starts in background (detached process)
4. Deployment logs are captured and displayed in server console
5. Process completes independently without blocking webhook response

### Deployment Process

1. **Environment Detection**: Based on commit message

   - Commits starting with "dev" → development environment
   - All other commits → production environment

2. **Git Operations**: Pull latest changes and compare commits

3. **Dependency Check**: Install dependencies if `package.json` changed

4. **Testing**: Run test suite before deployment

5. **Build Verification**: Ensure build completes successfully

6. **Deployment**: Execute appropriate deployment command
   - Development: `npm run deploy`
   - Production: `npm run prod_deploy`

## Setup Instructions

### 1. Install Dependencies

```bash
cd deployment
npm install
```

### 2. Set Environment Variables

```bash
# Generate a secure webhook secret
openssl rand -hex 32

# Set the secret in your environment
export GITHUB_WEBHOOK_SECRET="your-generated-secret"
```

### 3. Configure GitHub Webhook

1. Go to your GitHub repository → Settings → Webhooks
2. Add webhook with:
   - **Payload URL**: `https://erp-api.odaflow.com/webhook`
   - **Content type**: `application/json`
   - **Secret**: Use the secret you generated above
   - **Events**: Just the push event
   - **Active**: ✅ Checked

### 4. Start the Webhook Server

```bash
# Development
npm start

# Production (with PM2)
npm run prod
```

## Endpoints

- `POST /webhook` - GitHub webhook endpoint
- `GET /health` - Health check endpoint
- `GET /status` - Server status and deployment info
- `GET /` - Basic server info

## Nginx Configuration

Add these location blocks to your existing Nginx config:

```nginx
# GitHub Webhook
location /webhook {
    proxy_pass http://localhost:3000/webhook;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # GitHub-specific headers
    proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
    proxy_set_header X-GitHub-Event $http_x_github_event;
    proxy_set_header X-GitHub-Delivery $http_x_github_delivery;

    # Quick timeout since we respond immediately
    proxy_connect_timeout 5s;
    proxy_send_timeout 5s;
    proxy_read_timeout 5s;
}

# Webhook health check
location /webhook/health {
    proxy_pass http://localhost:3000/health;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Monitoring

### Real-time Deployment Logs

```bash
# View webhook server logs
pm2 logs webhook-server

# View deployment logs
tail -f /path/to/deployment/deploy.log
```

### Check Deployment Status

```bash
# Check webhook server status
curl https://erp-erp-api.odaflow.com/webhook/health

# Get detailed status
curl https://erp-api.odaflow.com/status
```

## Troubleshooting

### GitHub Webhook Delivery Issues

1. **Check webhook deliveries** in GitHub repository settings
2. **Verify webhook secret** matches server environment variable
3. **Check Nginx logs** for proxy errors
4. **Test webhook endpoint** manually:

```bash
curl -X POST https://erp-api.odaflow.com/webhook/health
```

### Deployment Failures

1. **Check deployment logs**: `tail -f deploy.log`
2. **Verify server permissions**: Ensure deploy script is executable
3. **Test deployment manually**: Run `bash deploy.sh` directly
4. **Check Docker status**: `docker ps` and `docker logs nodejs-app`

### Background Process Issues

1. **Check if deployment is running**: `ps aux | grep deploy`
2. **Monitor webhook server**: `pm2 status webhook-server`
3. **View real-time logs**: `pm2 logs webhook-server --lines 50`

## Security Notes

- Webhook secret verification prevents unauthorized deployments
- Server only responds to pushes on `main` branch
- Deployment runs with limited permissions
- All webhook deliveries are logged for audit trail

## Performance Benefits

- ⚡ **Instant GitHub response** (< 100ms)
- 🔄 **No webhook timeouts**
- 📊 **Real-time deployment monitoring**
- 🚀 **Non-blocking background deployment**
- 💾 **Memory efficient** with process cleanup
