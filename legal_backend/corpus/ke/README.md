# Kenya Legislation Corpus

Kenyan legal content is sourced from the official [Kenya Law](https://new.kenyalaw.org) platform.

| Content | Source URL | Count (approx.) |
|---------|-----------|-----------------|
| **Full legislation catalog** | [kenyalaw.org/legislation](https://kenyalaw.org/legislation/) | **499 rows** on site |
| **Primary Acts** | Same catalog | **258/258 indexed** (HTML first; SPA shells via `{url}/source.pdf`) |
| **Subsidiary legislation** | Same catalog (`--include-subsidiary`) | ~238 additional (~496 ingestable total; partial index OK) |
| **Case law (judgments)** | [Judgments](https://kenyalaw.org/judgments/) | ~325,000 |
| **Registry acts (Section Finder)** | [`ke.statutes.ts`](../../src/legal-search/statute-registry/ke.statutes.ts) | **21/21** indexed |

Acts and judgments use different catalogs on Kenya Law — the judgments page does not list acts.

## Prerequisites

- `OPENAI_API_KEY` set (for embeddings)
- `AI_ENABLE_RAG=true`
- Database migrated with pgvector

Optional (higher quality XML + easier catalog sync):

- `LAWS_AFRICA_API_TOKEN` — free at [platform.laws.africa/api-keys](https://platform.laws.africa/api-keys/)

Without the token, the manifest is built by scraping the public **Laws of Kenya** catalog at [kenyalaw.org/legislation](https://kenyalaw.org/legislation/) (same data as `new.kenyalaw.org/legislation/all`):

| Scope | Documents | Command |
|-------|-----------|---------|
| Primary acts only (default) | ~258 | `npm run build:ke-manifest` |
| Acts + subsidiary (legal notices, etc.) | ~496 | `npm run build:ke-manifest -- --include-subsidiary` |

All Kenya Law HTTP requests are paced at **800ms** by default (`--delay-ms=1200` to slow further).

## Strategy: acts vs case law

| Content | Approach | Why |
|---------|----------|-----|
| **Acts & Constitution** | **Bulk scrape + index** (~258 acts) | Act HTML is server-rendered with full section text. One-time job (~4–8 hours with embeddings). Essential for statute lookup and RAG. |
| **Case law (~325k)** | **Live search at query time** + optional daily feed sync | Judgment pages are JS-rendered (no full text in HTML). Bulk backfill would mean 325k PDF fetches + embeddings ($$$). The public search API (`/search/api/documents/`) is already wired into KE RAG — cheaper and always current. |

Optional: set `LAWS_AFRICA_API_TOKEN` for structured XML on both acts and judgments (Tausi API) if you later want deeper case-law backfill.

## Runbook — Acts

```bash
cd legal_backend

# 1. Curated priority sections (instant, no network)
npm run seed:statute-sections -- KE

# 2. Curated registry acts (21 actIds — Kenya Law HTML / Laws.Africa XML)
npm run sync:ke-registry -- --force-reindex --delay-ms=1500
# Or priority≤2 only:
npm run sync:legal-corpus -- KE

# 3. Build full catalog (primary + subsidiary recommended)
npm run build:ke-manifest -- --include-subsidiary --delay-ms=800

# 4. Ingest all legislation into LegalAuthority + embeddings
npm run ingest:ke-manifest -- --delay-ms=1200 --min-skip=5
# Subsidiary docs (legal notices) skip at 1 section; primary acts skip at 5.
# Slower crawl if throttled:
npm run ingest:ke-manifest -- --delay-ms=1500

# 5. Incremental change sync (new/updated @expressionDate only)
curl -X POST http://localhost:4000/legal-sources/kenya/ops/enable-ingest
curl -X POST http://localhost:4000/legal-sources/kenya/ops/enqueue/change-sync

# Or one-shot tier-1 + full corpus:
npm run sync:legal-corpus -- KE --all-acts
```

## Runbook — Case law

Kenya Law publishes ~325k judgments. Full bulk backfill requires the [Tausi API](https://tausi-dev.docs.laws.africa/api.html) (same Laws.Africa account). Without it, we ingest:

1. **Recent judgments** — Atom feed at `new.kenyalaw.org/feeds/judgments.xml` (updated daily)
2. **Topical search** — public search API (`/search/api/documents/?search=…&doc_type=judgment`)
3. **Live retrieval** — Kenya Law search is wired into RAG for KE queries (no pre-ingest required)

```bash
# Sync recent + topical Kenya judgments into the corpus
# (includes curated landmark seeds from judgment-seeds.json)
npm run sync:ke-case-law

# Seeds only (no Atom feed crawl)
npm run sync:ke-case-law -- --seeds-only

# Included automatically when syncing Kenya tier-1 corpus:
npm run sync:legal-corpus -- KE
```

## Continuous ops

```bash
# Weekly act change sync (expression-date diffs)
curl -X POST http://localhost:4000/legal-sources/kenya/ops/enqueue/change-sync

# Daily / weekly case-law sync
curl -X POST http://localhost:4000/legal-sources/kenya/ops/enqueue/case-law-sync

# Coverage + judgment metrics
curl http://localhost:4000/legal-sources/kenya/ops/status
```

## Verify

```bash
curl http://localhost:4000/legal-sources/ingest-status?countryCode=KE
# Or without the server running:
npm run verify:ke-ingest
```

`verify:ke-ingest` reports **primary-only** stats (`primaryWithSections` / `primaryMissing`) in addition to the mixed 496-entry catalog totals. Completeness for this corpus is judged on the **258 primary Acts/Constitution**, not subsidiary LNs.

## Primary Act completeness (evidence-first)

```bash
# Probe missing primaries against live Kenya Law (HTML + source.pdf evidence)
npm run audit:ke-primary -- --delay-ms=800

# Re-ingest html_ready / xml_ready / pdf_ready from the latest audit
npm run ingest:ke-manifest -- --from-audit-report --text-only --delay-ms=1200

# Or recover SPA shells listed in primary-unrecoverable.json via Kenya Law source.pdf
# (HTML empty → pdf-parse → Azure OCR / page-raster OCR for large scans)
npm run ingest:ke-manifest -- --from-unrecoverable --text-only --delay-ms=1200

# Index curated registry actIds (Section Finder / drafting)
npm run sync:ke-registry -- --force-reindex --defer-embeddings --delay-ms=1500

# After text recovery, re-embed PENDING KE authorities via ops API when the server is up:
# curl -X POST http://localhost:4000/legal-sources/kenya/ops/enqueue/reembed
```

Report path: [`primary-coverage-report.json`](./primary-coverage-report.json)

| Bucket | Meaning |
|--------|---------|
| `indexed` | DB `sectionCount > 0` |
| `html_ready` | Live Kenya Law HTML has parseable `akn-section` blocks — re-ingest |
| `xml_ready` | HTML empty but Laws.Africa AKN XML returned sections (optional token) |
| `pdf_ready` | HTML empty but `{publicUrl}/source.pdf` exists — recover with `--from-unrecoverable` |
| `unrecoverable` | HTML empty **and** source.pdf missing/failed — do not invent text |

**Definition of done:** every primary is indexed (`primaryWithSections === 258`) or listed under `unrecoverable` with measured evidence. No Laws.Africa subscription required — Kenya Law `source.pdf` covers SPA shells.

## Files

| File | Purpose |
|------|---------|
| `sources.manifest.json` | Generated act catalog (gitignored after first build) |
| `primary-coverage-report.json` | Measured primary coverage + recovery actIds |
| `primary-unrecoverable.json` | Slim evidence list for SPA/empty-HTML primary acts |
| `judgment-seeds.json` | Curated landmark judgment search queries |
| `README.md` | This runbook |

The manifest picks up consolidated point-in-time versions from Kenya Law (typically `@2022-12-31` or newer).
