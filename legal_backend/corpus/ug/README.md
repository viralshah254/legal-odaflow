# Uganda (UG) legal corpus — best-effort / expansion track

Uganda is a **common-law** jurisdiction handled as **best-effort** today (not a deep tier like IN / US / KE / GB).

## Current product behaviour

- Analytical / doctrine mode activates when local RAG is thin.
- Live web search allowlists ULII, AfricanLII, BAILII, and related East African LII domains.
- Curated secondary pins (SCL Delay Protocol, ASCE delay guidance, FIDIC framework) support construction-delay queries.
- Research overlay encodes court hierarchy, common-law reception, and ULII-first source priority.

## Deepening plan (connector + ingest)

| Phase | Work | Status |
|-------|------|--------|
| 1 | Tavily / web allowlist for `ulii.org`, `africanlii.org`, `bailii.org` | Done |
| 2 | Seed statute manifest (contracts, arbitration, civil procedure, land, labour) | Seeds in `sources.manifest.json` |
| 3 | ULII live judgment/search connector (read-only HTTP + domain allowlist) | Planned |
| 4 | Bulk statute text ingest + embeddings for seed Acts | Planned |
| 5 | Promote UG to deep tier once connector + statute coverage meet IN/KE quality bar | Planned |

## Primary sources to prefer

1. [ULII](https://ulii.org) — Uganda Legal Information Institute (judgments + legislation discovery)
2. Official Uganda Gazette / legislation portals when available
3. AfricanLII / EACLI mirrors
4. BAILII / UK common-law materials as **persuasive** comparative authority only

## Construction / delay notes

Many Uganda infrastructure disputes use FIDIC or similar forms and argue methodology by reference to SCL Protocol and ASCE guidance. Until local primary coverage is deep, Umbrella should label such analysis as analytical guidance and confirm against the governing contract and ULII authorities.
