# Umbrella — Word Add-in (MVP)

Series A Prompt 32 deliverable: thin Office task pane for matter-aware drafting.

## Capabilities (MVP)

- Sign in with firm credentials (Bearer token)
- Select matter context
- **Review & Redline:** full-document AI review with native Word tracked changes
- **Playbook:** Lucio-style rulebook dashboard (Unacceptable / Fallback / Preferred)
- **Draft Library:** browse firm golden templates and open as a new document in one click
- **AI Drafting:** document-grounded clause amendments as tracked changes + comments
- Copilot chat with matter context
- Clause assist and legal research

## Setup (development)

**You do not need to edit `manifest.xml` by hand.** Use the pre-made dev manifest:

1. Copy env: `cp .env.example .env`
2. Install trusted HTTPS certs (Word requires HTTPS):
   ```bash
   npm run certs
   ```
   Approve the macOS keychain prompt if asked.
3. Terminal 1 — backend at `:4000` (add add-in origins to `CORS_ORIGINS` in `legal_backend/.env`):
   ```
   CORS_ORIGINS=http://localhost:3000,https://localhost:3001,https://127.0.0.1:3001
   ```
4. Terminal 2 — serve the **built** add-in (Word cannot use Vite dev mode):
   ```bash
   npm run dev
   ```
   This builds and serves `https://127.0.0.1:3001/src/taskpane/index.html` — confirm in **Safari**.
5. Sideload into Word:
   ```bash
   npm run sideload
   ```
   This copies `manifest.dev.xml` into Word's sideload folder and opens Word.
   Then choose **Home → Add-ins → Umbrella Legal AI (Dev)** on a blank document.

   Do **not** reopen the old `Word add-in a1b2c3d4-...` document — that file auto-opens a broken task pane.

### If Word shows “This add-in is no longer available”

1. **Cmd+Q** to quit Word completely.
2. Reset caches:
   ```bash
   npm run sideload:reset
   ```
3. Terminal 1: `npm run dev`
4. Confirm in **Safari** (not Cursor's browser): https://localhost:3001/src/taskpane/index.html
5. Terminal 2: `npm run sideload`
6. In Word, open a **new blank document**, then **Home → Add-ins → Umbrella Legal AI (Dev)**.

**Fallback:** **Insert → Add-ins → Upload My Add-in** → choose `manifest.dev.xml`.

If Safari shows a certificate warning, run `npm run certs` and approve the Keychain prompt.

To stop debugging: `npm run sideload:stop`

Production deploy: see [DEPLOY.md](DEPLOY.md). Manifest URLs use `https://addins.umbrella.okaylegal.ai`.

## API

- Auth: same JWT as web app
- Endpoint: `/ai/copilot/chat`
- Headers: `Authorization: Bearer <token>`, `X-Tenant-Id: <tenantId>`

## Roadmap

- Ribbon button “Draft with OdaFlow”
- Citation footnotes from copilot response
- Spellbook-class clause library integration
