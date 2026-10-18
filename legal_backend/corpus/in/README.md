# Indian Bare Act PDF Corpus

Place source PDF files here for one-time RAG ingestion. PDFs are gitignored; this README documents sources and run commands.

## Expected files

| Filename | Act ID | Source |
|----------|--------|--------|
| `dowry-prohibition-act-1961.pdf` | `dowry-prohibition` | Dowry Prohibition Act, 1961 |
| `domestic-violence-act-2005.pdf` | `domestic-violence` | Protection of Women from Domestic Violence Act, 2005 |
| `family-courts-act-1984.pdf` | `family-courts` | Family Courts Act, 1984 |
| `special-marriage-act-1954.pdf` | `special-marriage` | [India Code](https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf) |
| `income-tax-act-1961.pdf` | `income-tax` | Income-tax Act, 1961 (priority sections only) |

### Technology & IP (bundled under `india-code/`)

| Filename | Act ID |
|----------|--------|
| `it-act.pdf` | `it-act` |
| `dpdp.pdf` | `dpdp` |
| `patents-act-1970.pdf` | `patents-act` |
| `copyright-act-1957.pdf` | `copyright-act` |
| `trademarks-act-1999.pdf` | `trademarks-act` |
| `designs-act.pdf` | `designs-act` |
| `gi-act.pdf` | `gi-act` |
| `ppvfr-act.pdf` | `ppvfr-act` |
| `semiconductor-layout-design-act.pdf` | `semiconductor-layout-design-act` |
| `biological-diversity-act.pdf` | `biological-diversity-act` |
| `cinematograph-act.pdf` | `cinematograph-act` |
| `cable-television-networks-act.pdf` | `cable-television-networks-act` |
| `telecommunications-act-2023.pdf` | `telecommunications-act-2023` |

## State act manifests

State-specific acts are listed in per-state manifest files for incremental ingest:

| Manifest | State |
|----------|-------|
| `states/mh.manifest.json` | Maharashtra |
| `states/gj.manifest.json` | Gujarat |

Run state ingest via `npm run ingest:india-state-manifest -- GJ` (when configured).

## Prerequisites

- `OPENAI_API_KEY` set (for `text-embedding-3-small` embeddings)
- `AI_ENABLE_RAG=true`
- Database migrated with pgvector (`EmbeddingChunk` table)

## Ingest runbook

```bash
cd legal_backend
npm install

# 1. Seed curated priority sections (instant, no PDF required)
npm run seed:statute-sections -- IN

# 2. Full family acts from PDFs
npm run ingest:bare-act-pdf -- --actId dowry-prohibition --pdf corpus/in/dowry-prohibition-act-1961.pdf
npm run ingest:bare-act-pdf -- --actId domestic-violence --pdf corpus/in/domestic-violence-act-2005.pdf
npm run ingest:bare-act-pdf -- --actId family-courts --pdf corpus/in/family-courts-act-1984.pdf
npm run ingest:bare-act-pdf -- --actId special-marriage --pdf corpus/in/special-marriage-act-1954.pdf

# 3. Income-tax: priority sections only (~70 high-use sections)
npm run ingest:bare-act-pdf -- --actId income-tax --pdf corpus/in/income-tax-act-1961.pdf --priority-only

# 4. Optional: sync all tier-1 IN acts via India Code connector (ongoing updates)
npm run sync:legal-corpus -- IN
```

## Verify ingestion

```bash
# Check section counts in DB
curl http://localhost:3000/legal-sources/ingest-status?countryCode=IN

# Browse India court/tribunal/statute abbreviations (LawVidhi + standard bar glossary)
curl http://localhost:3000/legal-sources/india-abbreviations

# Run golden query tests
npm run test:integration -- statute-lookup
```

## Ongoing updates

Scheduled `STATUTE_ACT_INGEST` jobs and `npm run sync:legal-corpus` use the India Code connector (`externalId` on each statute registry entry) to refresh section text incrementally. Unchanged sections are skipped via content-hash comparison.
