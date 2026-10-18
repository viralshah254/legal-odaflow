# Webhook secrets — manual follow-up

Automated setup (already done in repo):

- `deployment/.env.example` — template for server env vars
- `scripts/generate-webhook-secrets.js` — generates secrets into gitignored `deployment/.env`
- Run locally: `npm run secrets:webhook` from `legal_backend/`

**Do not commit `deployment/.env`.** It contains live secrets.

---

## What you must do yourself

### 1. Generate secrets on your machine (if not done yet)

```bash
cd legal_backend
npm run secrets:webhook
```

Open `legal_backend/deployment/.env` and copy the two values:

- `GITHUB_WEBHOOK_SECRET` — production webhook server
- `DEV_WEBHOOK_SECRET` — dev/staging (used when `IMAGE_TAG=dev`)

---

### 2. Production server — set env and redeploy

SSH to your deploy host and create or update:

**`/home/ubuntu/legal_backend/deployment/.env`**

Paste the same `GITHUB_WEBHOOK_SECRET` (and `DEV_WEBHOOK_SECRET` if you run a dev stack). Include your other deployment vars (`DOCKER_HUB_TOKEN`, etc.) from `.env.example`.

Then on the server:

```bash
cd /home/ubuntu/legal_backend/docker-swarm
./sync-env.sh
./deploy-webhook.sh   # or your usual stack deploy
```

Confirm the webhook container starts (it **exits** if the secret is missing or still a placeholder).

---

### 3. GitHub — repository webhook (push events)

1. GitHub repo → **Settings** → **Webhooks** → **Add webhook** (or edit existing)
2. **Payload URL:** your public webhook URL, e.g. `https://<your-api-domain>/webhook`
3. **Content type:** `application/json`
4. **Secret:** paste **`GITHUB_WEBHOOK_SECRET`** (exact match with server)
5. **Events:** Just the push event (or your current policy)
6. Save — GitHub should show recent deliveries as **200** after deploy

For a separate dev server, add another webhook (or use branch filters) with **`DEV_WEBHOOK_SECRET`** on that server’s `.env`.

---

### 4. GitHub — Actions secrets (CI deploy triggers)

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret name | Value |
|-------------|--------|
| `WEBHOOK_URL` | Prod webhook URL, e.g. `https://<prod-domain>/webhook` |
| `WEBHOOK_SECRET` | Same as **`GITHUB_WEBHOOK_SECRET`** |
| `DEV_WEBHOOK_URL` | Dev webhook URL (if using `ci-dev.yml`) |
| `DEV_WEBHOOK_SECRET` | Same as **`DEV_WEBHOOK_SECRET`** in deployment `.env` |

Used by `.github/workflows/ci-swarm.yml` and `ci-dev.yml` to POST signed deploy payloads.

---

### 5. Verify

**Health (no auth):**

```bash
curl https://<your-domain>/health
```

**Unsigned webhook (must fail 401):**

```bash
curl -X POST https://<your-domain>/webhook \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main"}'
```

**From GitHub:** Webhook → Recent Deliveries → latest push should succeed after secret is aligned.

---

## Checklist

- [ ] Ran `npm run secrets:webhook` locally
- [ ] Copied `deployment/.env` secrets to production server
- [ ] Ran `sync-env.sh` + redeployed webhook service on server
- [ ] Set GitHub **Webhooks** secret = `GITHUB_WEBHOOK_SECRET`
- [ ] Set Actions secrets: `WEBHOOK_URL`, `WEBHOOK_SECRET` (+ dev pair if applicable)
- [ ] Confirmed unsigned POST returns **401**
- [ ] Confirmed GitHub webhook delivery **200** on test push

---

## If something breaks

| Symptom | Likely cause |
|---------|----------------|
| Webhook server won’t start | Secret missing or still `your-webhook-secret` |
| GitHub delivery **401** | Webhook **Secret** in GitHub ≠ `GITHUB_WEBHOOK_SECRET` on server |
| CI deploy step **401** | Actions `WEBHOOK_SECRET` ≠ server secret |
| Dev deploy wrong env | `IMAGE_TAG=dev` but `DEV_WEBHOOK_SECRET` not set; `sync-env.sh` swaps it into `GITHUB_WEBHOOK_SECRET` for dev stack |

See also: [SERVER_SETUP.md](./SERVER_SETUP.md) section 6.
