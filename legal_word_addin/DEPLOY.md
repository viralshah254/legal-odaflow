# Production deployment — Word add-in

Host static files from `dist/` at `https://addins.umbrella.okaylegal.ai` (or your `ADDIN_BASE_URL`).

## Build

```bash
npm run build
```

Output: `dist/` (task pane, auth bridge, assets).

## Manifest

Production manifest is `manifest.xml` (URLs point to `addins.umbrella.okaylegal.ai`).

Regenerate from a custom base URL:

```bash
ADDIN_BASE_URL=https://addins.umbrella.okaylegal.ai npm run manifest:prod
```

This writes `manifest.production.xml` for upload to Microsoft 365 admin center.

## Deploy steps

1. **Build** — `npm run build`
2. **Upload** — Deploy `dist/` to your CDN/static host (S3 + CloudFront, Vercel static, etc.)
3. **CORS** — Add add-in origin to `CORS_ORIGINS` in `legal_backend/.env`:
   ```
   CORS_ORIGINS=...,https://addins.umbrella.okaylegal.ai
   ```
4. **Microsoft 365** — Upload `manifest.xml` via **Integrated apps** or **Centralized Deployment**
5. **Validate** — Open Word → **Home → Add-ins → Umbrella Legal AI**

## Features (production)

- Review & redline, playbooks, copilot, clause assist, research
- **Draft Library** — firm templates one-click into Word

Support: https://umbrella.okaylegal.ai/support
