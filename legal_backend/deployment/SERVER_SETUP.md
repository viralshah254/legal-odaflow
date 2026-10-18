# ERP OdaFlow Backend — EC2 Server Setup

Domain: **erp-api.odaflow.com**  
App port: **4000**

## 1. Server Paths

On your EC2 instance, use these paths:

| Purpose | Path |
|--------|------|
| Project root | `/home/ubuntu/ERPbyodaflow-backend` |
| **Root .env** (API app: MongoDB, Firebase, CORS) | `/home/ubuntu/ERPbyodaflow-backend/.env` |
| **Deployment .env** (webhook, Docker Hub, deploy scripts) | `/home/ubuntu/ERPbyodaflow-backend/deployment/.env` |
| Firebase service account (erpbyodaflow — auth + FCM) | `/home/ubuntu/ERPbyodaflow-backend/firebase/erpbyodaflow.auth.service-account.json` |
| Docker Swarm config | `/home/ubuntu/ERPbyodaflow-backend/docker-swarm/` |

## 2. Firebase service accounts (secrets)

Real JSON files are **not** committed to git. Use the naming under `firebase/`:

| File | Project | Purpose |
|------|---------|---------|
| `firebase/erpbyodaflow.auth.service-account.json` | erpbyodaflow | Auth, JWT verify, FCM push |

1. Upload the file to the server:
   ```bash
   scp firebase/erpbyodaflow.auth.service-account.json ubuntu@your-ec2:/home/ubuntu/ERPbyodaflow-backend/firebase/
   ```

2. In **root .env**, set paths **inside the container** (stack mounts `firebase/` → `/usr/app/firebase/`). **Must start with `/`**:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_PATH=/usr/app/firebase/erpbyodaflow.auth.service-account.json
   FIREBASE_WEB_API_KEY=<erpbyodaflow web API key — same as ERPbyodaflow NEXT_PUBLIC_FIREBASE_API_KEY>
   ```

See `firebase/README.md` for download instructions from Firebase Console.

## 3. Two .env Files

### Root .env — API app

`/home/ubuntu/ERPbyodaflow-backend/.env` (mounted into the app container):

```bash
# Server
PORT=4000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb+srv://...

# Firebase (paths inside container — see firebase/README.md)
FIREBASE_SERVICE_ACCOUNT_PATH=/usr/app/firebase/erpbyodaflow.auth.service-account.json

# Web API key (Firebase Console → Project settings → General). Same as Next.js `NEXT_PUBLIC_FIREBASE_API_KEY`.
# **Required** for `POST /api/auth/login` (mobile / Flutter email+password). Without it, the API returns 503.
FIREBASE_WEB_API_KEY=<paste Web API Key from Firebase Console>

# Optional: Redis (stack uses redis:6379 internally)
REDIS_URI=redis://redis:6379

# CORS
CORS_ORIGIN=https://erp.odaflow.com,https://erp-api.odaflow.com
```

### Deployment .env — webhook & deploy scripts

`/home/ubuntu/ERPbyodaflow-backend/deployment/.env` (used by sync-env.sh, deploy scripts):

```bash
DOCKER_HUB_TOKEN=your-docker-hub-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret
DEV_WEBHOOK_SECRET=your-dev-webhook-secret
IMAGE_TAG=latest
SWARM_DIR=/home/ubuntu/ERPbyodaflow-backend/docker-swarm
REDIS_URL=redis://localhost:6379
API_URL=http://localhost:4000
```

## 4. Nginx

Copy `nginxconf.` to your Nginx sites-enabled and reload:

```bash
sudo cp /home/ubuntu/ERPbyodaflow-backend/nginxconf. /etc/nginx/sites-available/erp-api
sudo ln -sf /etc/nginx/sites-available/erp-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Then run Certbot for SSL:

```bash
sudo certbot --nginx -d erp-api.odaflow.com
```

## 5. Sync Environment and Deploy

```bash
cd /home/ubuntu/ERPbyodaflow-backend/docker-swarm
chmod +x *.sh
./sync-env.sh
./init-swarm.sh
```

## 6. GitHub Webhook

1. In GitHub repo → Settings → Webhooks → Add webhook
2. Payload URL: `https://erp-api.odaflow.com/webhook` (domain + /webhook)
3. Content type: `application/json`
4. Secret: same as `GITHUB_WEBHOOK_SECRET` in deployment/.env
5. Events: Just the push event

**GitHub Actions:** In repo Settings → Secrets → Actions, set `WEBHOOK_URL` = `https://erp-api.odaflow.com/webhook` so ci-swarm.yml can trigger deployments.

## 7. Verify

```bash
curl https://erp-api.odaflow.com/health
curl https://erp-api.odaflow.com/webhook/health
```
