# Split into separate GitHub repos

Current monorepo: [viralshah254/legal-odaflow](https://github.com/viralshah254/legal-odaflow)

Target:

| GitHub repo (suggested) | Local folder | Stack |
|-------------------------|--------------|-------|
| `legal-backend` | `legal_backend/` | NestJS, Prisma |
| `legal-web` | `legal_web/` | Next.js |
| `legal-app` | `legal_app/` | Flutter |

Optional 4th repo **`legal-dev`** (or keep `legal-odaflow`) for `docker-compose.yml`, root docs, and local full-stack dev.

---

## Before you split — know the couplings

These break if you only copy folders without adjusting:

| Coupling | Fix in split |
|----------|----------------|
| Backend contract tests read `../legal_web` and `../legal_app` | Move tests to each repo, or keep cross-repo checks in meta CI only |
| Flutter CI runs `dart run ../shared/theme/generate_flutter_tokens.dart` | Copy `shared/theme/` into `legal_app/tool/theme/` (script does this) |
| Web `scripts/sync-theme-tokens.js` reads `../../shared/theme` | Web already bundles `lib/theme/tokens.json` — no monorepo path needed |
| Root `.github/workflows/ci.yml` | Each repo gets its own workflow at repo root |
| `DEV-WORKFLOW.md` / `docker-compose.yml` | Keep in meta repo or duplicate infra snippet per backend README |

---

## Step 1 — Create empty GitHub repos

On GitHub (same org/user as today):

1. **legal-backend** — Private or Public, **no** README / .gitignore (empty)
2. **legal-web** — empty
3. **legal-app** — empty

Note the SSH or HTTPS URLs, e.g.  
`git@github.com:viralshah254/legal-backend.git`

---

## Step 2 — Run the split script (local)

From the monorepo root:

```bash
chmod +x scripts/split-to-separate-repos.sh
./scripts/split-to-separate-repos.sh
```

This creates sibling directories:

```
../legal-backend/   # only backend, history preserved (filter-repo) or fresh copy
../legal-web/
../legal-app/
```

---

## Step 3 — Push each repo

```bash
cd ../legal-backend
git remote add origin git@github.com:viralshah254/legal-backend.git
git push -u origin main

cd ../legal-web
git remote add origin git@github.com:viralshah254/legal-web.git
git push -u origin main

cd ../legal-app
git remote add origin git@github.com:viralshah254/legal-app.git
git push -u origin main
```

Use HTTPS if you prefer: `https://github.com/viralshah254/legal-backend.git`

---

## Step 4 — Per-repo CI

Each split repo includes `.github/workflows/ci.yml` at **repo root** (no `legal_backend/` prefix in `working-directory`).

After push, confirm Actions run green on each repo.

---

## Step 5 — What to do with `legal-odaflow`

**Option A — Archive monorepo**  
Add README note: “Split into legal-backend, legal-web, legal-app.” Archive on GitHub.

**Option B — Meta / dev repo (recommended)**  
Keep `legal-odaflow` for:

- `docker-compose.yml`
- `DEV-WORKFLOW.md`, `DEPLOYMENT.md`
- Git submodules pointing at the three repos

```bash
cd legal-by-odaflow
git submodule add git@github.com:viralshah254/legal-backend.git legal_backend
git submodule add git@github.com:viralshah254/legal-web.git legal_web
git submodule add git@github.com:viralshah254/legal-app.git legal_app
```

Then `git submodule update --init --recursive` for clones.

---

## Step 6 — Secrets & deploy

| Repo | Secrets (examples) |
|------|---------------------|
| **legal-backend** | `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_*`, Firebase admin |
| **legal-web** | `NEXT_PUBLIC_API_URL`, PostHog, Stripe publishable, Firebase client |
| **legal-app** | Signing keys via CI secrets; `API_URL` dart-define in build |

Point Vercel at **legal-web** repo root.  
Point API host (Railway/Fly/ECS) at **legal-backend** repo root.

---

## Quick split without history (simplest)

If you do not need git history per folder:

```bash
# Backend
cp -R legal_backend ../legal-backend-new
cd ../legal-backend-new && git init && git add . && git commit -m "Initial import from monorepo"

# Repeat for legal_web → ../legal-web-new, legal_app → ../legal-app-new
```

Then push to the three new GitHub repos.

---

## Install git-filter-repo (optional, for clean history)

```bash
brew install git-filter-repo   # macOS
```

The split script uses it when available; otherwise it falls back to a fresh copy.
