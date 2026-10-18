# United States Legal Corpus

Federal (USC, CFR, named acts) and state statute sources for RAG ingestion and US Section Finder.

## Layout

| Path | Contents |
|------|----------|
| `usc/` | Offline OLRC USLM XML cache (`title-1.xml` … `title-54.xml`, skip 53) |
| `states/*.manifest.json` | Per-state act manifests (FindLaw / Cornell LII URLs) |

See also [`usc/README.md`](usc/README.md) for downloading USLM title files.

## Prerequisites

- `OPENAI_API_KEY` set (for `text-embedding-3-small` embeddings)
- `AI_ENABLE_RAG=true`
- `ENABLE_LEGAL_CONNECTORS=true`
- Database migrated with pgvector (`EmbeddingChunk` table)
- Outbound network to `uscode.house.gov`, `ecfr.gov`, Cornell LII, FindLaw — unless USC XML is cached locally
- Optional: `COURTLISTENER_API_TOKEN` for US case-law sync
- Optional: `USLM_RELEASE_PATH=119/99` (or current OLRC release)
- Optional: `REDIS_URL` for queue-based ingest via API/worker

## Ingest runbook (local)

```bash
cd legal_backend
npm install

# 1. Priority federal sections (10 hand-curated) + embeddings
npm run seed:statute-sections -- US

# 2. Curated US Section Finder profiles (~150+ high-traffic sections)
npm run seed:section-profiles -- US

# 3. Full federal bulk (USC all titles + CFR all titles) — may take hours
npm run ingest:us-usc
npm run ingest:us-cfr

# 4. State manifest acts (index-level by default)
npm run ingest:us-states

# 4b. Pilot states with full per-section text (CA, NY, TX)
npm run ingest:us-states -- --section-depth=full --states=CA,NY,TX

# Alternative one-shot (tier-1 + federal bulk + states + CourtListener if configured):
npm run sync:legal-corpus -- US --all-acts

# 5. Verify coverage
npm run audit:us-corpus
npm run audit:us-section-finder
```

## Production / staging

1. **Back up the database** before bulk ingest (USC+CFR can add tens of thousands of rows).
2. Run the same command sequence on the target environment with production env vars.
3. Prefer running during a maintenance window — embedding API calls are rate-limited and costly.
4. Pre-cache USC XML under `corpus/us/usc/` if production egress to `uscode.house.gov` is restricted.
5. Trigger via API (requires Redis worker):

```bash
curl -X POST "https://<api-host>/legal-sources/ingest-all-statutes?countryCode=US"
```

This enqueues full US federal (USC + CFR) **and** state manifest ingest.

6. Record row counts from `npm run audit:us-corpus` in your deploy log.

## Verify ingestion

```bash
# DB section counts per USC/CFR title and state act
npm run audit:us-corpus

# Section Finder smoke tests
npm run test:integration -- section-finder-us

# Golden statute lookup (includes US samples when corpus present)
npm run test:integration -- statute-lookup
```

## Interpreting `audit:us-corpus`

The audit script reports per-act `dbSectionCount` vs thresholds:

| Category | `ok` threshold | Meaning |
|----------|----------------|---------|
| USC title | ≥ 10 sections | Title ingested with substance |
| CFR title | ≥ 5 sections | CFR title ingested |
| State act | ≥ 3 sections | Manifest act has index/section rows |

Acts marked `empty` or `low` need re-ingest (`--force-reindex`) or connector troubleshooting.

## `--force-reindex`

Pass to any ingest script to skip the “already has N sections” short-circuit and re-upsert all sections (re-embeds changed text).

## Known gaps

- **State depth:** Default state ingest uses FindLaw index pages (titles/summaries). Use `--section-depth=full` for CA/NY/TX pilots.
- **Curated vs bulk:** Section Finder profiles cover high-traffic sections; bulk USC/CFR covers the long tail.
- **No IPC→BNS equivalent:** US has no statutory crosswalk transition layer (unlike India).

## Local run log (2026-06-21)

| Step | Command | Result |
|------|---------|--------|
| Priority sections | `npm run seed:statute-sections -- US` | 10 sections upserted |
| Curated profiles | `npm run seed:section-profiles -- US` | 169 profiles upserted |
| Section Finder audit | `npm run audit:us-section-finder` | PASSED (169 curated entries) |
| State full-text pilot | `npm run ingest:us-states -- --section-depth=full --states=CA,NY,TX` | 5 sections (FindLaw 403 on many acts) |
| Tier-1 sync | `npm run sync:legal-corpus -- US` | Priority USC titles 0 sections (network); CourtListener +5 authorities; 183 US rows in DB |
| USC title 29 | `npm run ingest:us-usc -- --title=29` | 0 sections — `uscode.house.gov` unreachable; pre-cache XML under `corpus/us/usc/` |
| Full bulk ingest | `npm run sync:legal-corpus -- US --all-acts` | **Aborted ~3h** — tier-1 named acts ~260 sections OK; USC 0 (network); CFR bulk stalled; state ingest not reached |

**Connector notes:** FindLaw returns HTTP 403 to automated fetchers. Use official state portals (TX `statutes.capitol.texas.gov`, CA `leginfo.legislature.ca.gov`, NY Senate legislation) or Cornell LII mirrors where stable. Pre-cache USC USLM XML for offline federal ingest.

## Production run log

Record staging/prod results here after each deploy:

| Date | Environment | Command | USC ok | CFR ok | State ok | Notes |
|------|-------------|---------|--------|--------|----------|-------|
| _pending_ | staging | `POST /legal-sources/ingest-all-statutes?countryCode=US` | — | — | — | DB backup required before run |

## Ongoing updates

- `npm run sync:legal-corpus -- US` — tier-1 priority acts (≤50 sections each unless bulk)
- `npm run sync:legal-corpus -- US --all-acts` — full federal + state refresh
- Unchanged sections are skipped via content-hash comparison in `StatuteIngestService`
