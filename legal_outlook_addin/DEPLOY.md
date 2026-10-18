# Production deployment — Outlook add-in

Host static files from `dist/` at `https://addins.umbrella.okaylegal.ai` (or your `ADDIN_BASE_URL`).

## Build

```bash
npm run build
```

## Manifest

Production manifest is `manifest.xml`. Regenerate:

```bash
ADDIN_BASE_URL=https://addins.umbrella.okaylegal.ai npm run manifest:prod
```

## Deploy steps

1. **Build** — `npm run build`
2. **Upload** — Deploy `dist/` alongside Word add-in assets on the same origin
3. **CORS** — Include `https://addins.umbrella.okaylegal.ai` in backend `CORS_ORIGINS`
4. **Microsoft 365** — Upload `manifest.xml` for Outlook (read + compose)
5. **Validate** — Open Outlook → email → **Legal AI** ribbon button

## Features (production)

- Email-to-matter, link to matter, AI reply drafting
- **Narratives** — email activity → billable time suggestions (saved to Umbrella Time)

Support: https://umbrella.okaylegal.ai/support
