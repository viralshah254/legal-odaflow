# i18n — Shared Translation Catalog

Single source of truth for Umbrella platform translations (web, Flutter, backend reference).

## Locales (15)

| Code | Language | RTL |
|------|----------|-----|
| en | English | |
| fr | French | |
| de | German | |
| hi | Hindi | |
| bn | Bengali | |
| te | Telugu | |
| mr | Marathi | |
| ta | Tamil | |
| gu | Gujarati | |
| kn | Kannada | |
| ml | Malayalam | |
| ur | Urdu | ✓ |
| pa | Punjabi | |
| or | Odia | |
| as | Assamese | |

## Country → Language

- **India (IN):** all 13 codes (en + 12 Indian languages)
- **All other countries:** en, fr, de

## Namespaces

See [`scripts/namespaces.js`](scripts/namespaces.js) for the full list (17 namespaces).

## Scripts

```bash
# Full pipeline
node shared/i18n/scripts/sanitize-en-catalog.js
node shared/i18n/scripts/build-catalog-from-extraction.js
node shared/i18n/scripts/expand-locale-translations.js
node shared/i18n/scripts/generate-locales.js
node shared/i18n/scripts/sync-to-web.js
node shared/i18n/scripts/sync-to-flutter.js
node shared/i18n/scripts/check-parity.js
cd legal_app && flutter gen-l10n

# Auto-migrate (optional)
node shared/i18n/scripts/migrate-web-auto.js
node shared/i18n/scripts/migrate-flutter-auto.js

# Or from legal_web/
npm run i18n:generate && npm run i18n:sync && npm run i18n:check
npm run i18n:extract
npm run i18n:migrate-web
npm run i18n:audit
```

## Key convention

- **Web (next-intl):** `useTranslations('matters')` → `t('create.title')`
- **Flutter (gen-l10n):** `matters_createTitle`

**Never edit** `legal_web/messages/` or `legal_app/lib/l10n/` directly — always edit `shared/i18n/` and sync.
