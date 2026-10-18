# Deployment Guide

## Production docker-compose

Use this as a baseline production stack (copy to `docker-compose.prod.yml` and adapt secrets):

```yaml
version: "3.9"
services:
  legal_backend:
    image: ghcr.io/odaflow/legal-backend:latest
    env_file:
      - ./legal_backend/.env
    ports:
      - "4000:4000"
    depends_on:
      - postgres
      - redis

  legal_web:
    image: ghcr.io/odaflow/legal-web:latest
    env_file:
      - ./legal_web/.env.production
    ports:
      - "3000:3000"
    depends_on:
      - legal_backend

  worker:
    image: ghcr.io/odaflow/legal-backend:latest
    env_file:
      - ./legal_backend/.env
    command: ["npm", "run", "worker:start"]
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: legal
      POSTGRES_USER: legal
      POSTGRES_PASSWORD: change-me
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

## Worker runbook

- **Start worker**: `npm run worker:start` from `legal_backend`
- **Smoke-check queues**: verify Redis connectivity and process logs for `automation`, `research`, `summary`, `notify`.
- **Backlog check**: inspect `AgentJob` rows with `status = QUEUED` and stale `updatedAt`.
- **Failure triage**:
  - Look for `error` field on `AgentJob`
  - Requeue by creating a new job payload through the backend service
  - Verify dependent keys (`OPENAI_API_KEY`, Firebase, payment provider vars)
- **Rollback**: deploy previous container tag for backend and worker together (same schema/app version expected).

## Deploy order

1. Run DB migration
2. Deploy backend
3. Deploy worker
4. Deploy web
5. Run post-deploy smoke: `./scripts/post-deploy-smoke.sh` (set `API_URL`, `WEB_URL`)

---

## API URL and environment variables

Production API: **https://legal-api.odaflow.com** (health: `/api/v1/health`).

### Web — Vercel

In the Vercel project for `legal_web`, set **Production** (and Preview if previews should use prod API):

| Variable | Value | Notes |
|----------|--------|--------|
| `API_URL` | `https://legal-api.odaflow.com` | Required — no trailing slash, no `/api/v1` suffix. Powers the Next.js rewrite proxy. |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `false` | Use real API |

**Do NOT set** these on Vercel (unset or absent = correct):

| Variable | Why |
|----------|-----|
| `NEXT_PUBLIC_USE_DIRECT_API` | If set to `true`, the browser calls the API directly cross-origin and triggers CORS. Only needed for the Electron desktop build. |
| `NEXT_PUBLIC_API_URL` | Same reason as above — causes browser to bypass the rewrite proxy. |

Redeploy after changing env vars (env changes do not apply to existing builds). The browser will call same-origin `/api/v1/...`; Next.js rewrites that to `API_URL/api/v1/...` server-side — no CORS required.

### Web — Docker

Copy [`legal_web/.env.production.example`](legal_web/.env.production.example) to `legal_web/.env.production` on the host (gitignored). See [`docker-compose.prod.yml`](docker-compose.prod.yml).

### Backend server (EC2 / Swarm)

On the host `.env` mounted into the app container:

| Variable | Production value |
|----------|------------------|
| `API_URL` | `https://legal-api.odaflow.com` |
| `CORS_ORIGINS` | Comma-separated web origins (e.g. `https://legal-web-bice.vercel.app`, `https://legal-three-red.vercel.app`, your custom domain, `http://localhost:3000`) |

The Swarm **webhook** service keeps `API_URL=http://app:4000` for in-cluster health checks.

### Post-deploy smoke

```bash
API_URL=https://legal-api.odaflow.com WEB_URL=https://your-web-domain ./scripts/post-deploy-smoke.sh
```

---

## Mobile app (`legal_app`)

### Build prerequisites

- Flutter stable (same channel as CI)
- Regenerate theme tokens after editing `shared/theme/tokens.json`:
  ```bash
  dart run shared/theme/generate_flutter_tokens.dart
  ```
- Copy `legal_app/.env.example` values into `--dart-define` flags for release builds.

### Release build commands

**Android (APK / Play Store AAB)**

```bash
cd legal_app
dart run ../shared/theme/generate_flutter_tokens.dart
flutter pub get
flutter test
flutter analyze

# Internal APK
flutter build apk --release \
  --dart-define=API_URL=https://legal-api.odaflow.com/api/v1 \
  --dart-define=APP_ENV=production \
  --dart-define=DEFAULT_COUNTRY=IN \
  --dart-define=SENTRY_DSN=https://your-sentry-dsn

# Play Store bundle (requires android/key.properties — see APP-STORE-RELEASE.md)
flutter build appbundle --release \
  --dart-define=API_URL=https://legal-api.odaflow.com/api/v1 \
  --dart-define=APP_ENV=production
```

**iOS (TestFlight / App Store)**

```bash
cd legal_app
flutter build ipa --release \
  --dart-define=API_URL=https://legal-api.odaflow.com/api/v1 \
  --dart-define=APP_ENV=production
```

- Set `aps-environment` to `production` in `ios/Runner/Runner.entitlements` before App Store submission.
- Upload APNs Auth Key (.p8) in Firebase Console for production push.

### Feature flags (`--dart-define`)

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_CONSUMER_APP` | true | Consumer dashboard and flows |
| `ENABLE_LAWYER_MODE` | true | Lawyer shell and routes |
| `ENABLE_LAWYER_APP` | true | Lawyer-specific screens |
| `ENABLE_DOCUMENT_UPLOAD` | true | Document upload screen |
| `ENABLE_LAWYER_REVIEW` | true | Lawyer review + payment flow |
| `ENABLE_SUBSCRIPTIONS` | true | Subscription plans + checkout |
| `ENABLE_PUSH_NOTIFICATIONS` | true | FCM registration |
| `SENTRY_DSN` | (empty) | Enables Sentry crash reporting when set |

### Mobile deploy order

1. Deploy backend + worker (API must match mobile `API_URL`).
2. Confirm Firebase project has iOS + Android apps with correct bundle IDs.
3. Run CI mobile job locally (`flutter test`, `flutter build apk`).
4. Ship TestFlight / internal testing track first.
5. Run post-deploy smoke checklist in `QA-MATRIX.md` (mobile section).

See also: [`APP-STORE-RELEASE.md`](APP-STORE-RELEASE.md) for signing, store assets, and push setup.

## Database backups

Schedule nightly logical backups on the Postgres host (adjust connection vars and retention):

```bash
# /etc/cron.d/legal-odaflow-pg-backup (example: daily at 02:15 UTC)
15 2 * * * postgres pg_dump -Fc "$DATABASE_URL" -f /var/backups/legal/legal_$(date +\%F).dump && find /var/backups/legal -name '*.dump' -mtime +14 -delete
```

- Store dumps off-box (S3/object storage or separate volume).
- Test restore quarterly: `pg_restore -d legal_restore /var/backups/legal/legal_YYYY-MM-DD.dump`.
- Take a manual dump before major migrations: `pg_dump -Fc "$DATABASE_URL" -f pre-migrate.dump`.
