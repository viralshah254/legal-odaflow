# Development Workflow

## Prerequisites

- Docker Desktop running
- Node.js 20+
- Flutter stable (for `legal_app`)

## Start infrastructure

```bash
docker compose up -d
docker compose ps   # postgres + redis should be "running"
```

## Backend

```bash
cd legal_backend
cp .env.example .env   # if needed
npm install
npx prisma migrate dev
npm run prisma:seed
npm run build          # first run or after clean — ensures dist/main.js exists
npm run start:dev      # http://localhost:4000/api/v1/health
```

### Backend troubleshooting

**`Cannot find module .../dist/main`** — Nest watch mode tried to start before `dist/main.js` was written. Fix:

```bash
cd legal_backend
npm run build
npm run start:dev
```

If the API port is stuck: `lsof -ti :4000 | xargs kill -9`

Optional worker process (OCR, embeddings, ingestion):

```bash
npm run start:worker
```

### Statute corpus ingest

| Jurisdiction | Command | Scope |
|--------------|---------|--------|
| India central | `npm run ingest:india-manifest -- --force-reindex` | All acts in `corpus/in/sources.manifest.json` (full PDF parse) |
| India audit | `npm run audit:india-corpus` | DB vs cache gaps per manifest act |
| US USC (federal) | `npm run ingest:us-usc` | All USC titles via OLRC USLM (`corpus/us/usc/` cache optional) |
| US CFR (federal) | `npm run ingest:us-cfr` | All CFR titles via eCFR full XML |
| US states | `npm run ingest:us-states` | Acts in `corpus/us/states/*.manifest.json` |
| US audit | `npm run audit:us-corpus` | Section counts per USC/CFR title and state act |
| Tier-1 + optional bulk | `npm run sync:legal-corpus -- --all-acts IN` or `US` | India manifest or US USC+CFR+states |

### Stripe billing (test mode)

1. Add keys and price IDs to `legal_backend/.env` (see `.env.example` lines 99–111).
2. One-time catalog setup (creates Products/Prices + portal config, writes `STRIPE_PRICE_*` to `.env`):

```bash
cd legal_backend
npm run stripe:setup
```

3. Forward webhooks locally (separate terminal; copy `whsec_...` into `STRIPE_WEBHOOK_SECRET` if it changes):

```bash
npm run stripe:listen
```

4. Restart the API after changing `.env` (`npm run start:dev`).

5. Smoke test: log in on `/pricing`, click **Upgrade** → should redirect to `checkout.stripe.com` (not `localhost/checkout/cs_mock_*`). Test card: `4242 4242 4242 4242`.

## Web

Use **one** dev server only (avoid ChunkLoadError):

```bash
# Kill duplicate servers if needed
lsof -ti :3000,:3001 | xargs kill -9 2>/dev/null

cd legal_web
cp .env.example .env   # single env file for local dev
rm -rf .next
npm install
npm run dev            # http://localhost:3000 — fine for email/password
```

**Google/Apple OAuth on localhost** — Firebase redirects to `https://localhost:3000/__/auth/handler`. Plain `npm run dev` is HTTP-only → `ERR_SSL_PROTOCOL_ERROR`. Use HTTPS dev instead:

```bash
npm run dev:https      # https://localhost:3000 (accept the self-signed cert once)
```

In `legal_web/.env` / `.env.local` set:

```env
NEXT_PUBLIC_APP_URL=https://localhost:3000
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost:3000
```

Add `https://localhost:3000/__/auth/handler` to Google Cloud → OAuth client → **Authorized redirect URIs** (see `firebase/OAUTH_SETUP.md`). Apple web sign-in still requires production (`umbrella.okaylegal.ai`).

If Brave cached bad HSTS for `localhost`, clear it once: `brave://net-internals/#hsts` → Delete domain `localhost`.

Do not run `npm run build` while `npm run dev` is active.

Set `NEXT_PUBLIC_USE_MOCK_DATA=false` in `.env.local` for real API wiring.

## Mobile

```bash
cd legal_app
flutter pub get
flutter run --dart-define=API_URL=http://localhost:4000/api/v1
```

## Smoke checks

| Check | URL / command |
|-------|----------------|
| API health | `curl http://localhost:4000/api/v1/health` |
| DB health | `curl http://localhost:4000/api/v1/health/db` |
| Redis health | `curl http://localhost:4000/api/v1/health/redis` |
| No-mock gate | `cd legal_backend && npm run check:no-mock` |
| Web build | `cd legal_web && npm run build` |
| Backend build | `cd legal_backend && npm run build` |
| Flutter analyze | `cd legal_app && flutter analyze` |
| Production API health | `curl https://legal-api.odaflow.com/api/v1/health` |
| Production smoke (set your web URL) | `API_URL=https://legal-api.odaflow.com WEB_URL=https://your-web-domain ./scripts/post-deploy-smoke.sh` |

## E2E smoke (Firebase signup + copilot)

Prerequisites: Docker (postgres + redis), backend `npm run start:dev`, worker `npm run start:worker`, web `npm run dev` with `NEXT_PUBLIC_USE_MOCK_DATA=false`.

1. **Register / login (Firebase or API)**  
   - Web: open `http://localhost:3000` and complete signup (Firebase Auth when configured), or POST `http://localhost:4000/api/v1/auth/register` with email/password from seed docs.  
   - Capture `accessToken` from login response or browser session.

2. **Tenant context**  
   - List tenants or use seed firm; send `X-Tenant-Id: <tenantId>` on lawyer routes.

3. **Copilot chat with tools**  
   ```bash
   curl -s -X POST http://localhost:4000/api/v1/ai/copilot/chat \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-Id: $TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{"message":"Summarize this matter","context":{"selectedMatterId":"'"$MATTER_ID"'"}}'
   ```  
   Expect `actionProposals` and `asyncJobs[].jobId` for async tools; `create task` returns an executed proposal when matter context is set.

4. **Notifications inbox**  
   ```bash
   curl -s http://localhost:4000/api/v1/notifications \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-Id: $TENANT_ID"
   ```

5. **Device token (FCM)**  
   ```bash
   curl -s -X POST http://localhost:4000/api/v1/notifications/devices/register \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-Id: $TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{"token":"dev-fcm-token","platform":"web"}'
   ```  
   Set `FIREBASE_*` in `legal_backend/.env` for real push delivery.

## Default admin (after seed)

- Email: `admin@odaflow.com`
- Password: `Admin123!ChangeMe`
