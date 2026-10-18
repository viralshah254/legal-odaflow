# Lawyer Lead Scraper

Harvest 10,000+ lawyer / law-firm prospects from public directories, enrich contacts, and import into the Umbrella admin panel (`/admin/lawyer-prospects`).

## Setup

```bash
cd scripts/lawyer-leads
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Environment (optional)

| Variable | Purpose |
|---|---|
| `HUNTER_API_KEY` | Email finder API |
| `HTTP_PROXY` | Proxy for aiohttp / Playwright |
| `DATABASE_URL` | Direct CSV → Postgres import |
| `LEGAL_API_URL` | Backend base URL for API import |
| `ADMIN_ACCESS_TOKEN` | Bearer token for admin import endpoint |
| `GOOGLE_PLACES_API_KEY` | Google Places API for law firm discovery |
| `GOOGLE_PLACES_USE_NEW_API` | Set `true` (default) to use Places API (New) with phone/website in search; `false` for Legacy |

## Recommended hybrid pipeline (India — lowest cost)

For Indian cities, **bulk-import from free directories first**, then use Google Places only to fill gaps:

| Step | Source | When to use |
|---|---|---|
| 1 | **VakeelKhoj** / **JustDial** | Primary harvest — high legal density, phones often included |
| 2 | **Google Places (enrichment)** | Admin UI → **Enrichment only** — updates existing prospects missing phone/website |
| 3 | **Google Places (full)** | Net-new cities or when directory scrapers under-cover a market |

Dedupe is automatic via `dedupeKey` (name + organisation + city) in admin import.

### Example: Ahmedabad (hybrid)

```bash
cd scripts/lawyer-leads && source .venv/bin/activate

# 1) Bulk import from JustDial (phones, resumable)
python run_justdial_india.py \
  --cities ahmedabad \
  --pages-per-city 25 \
  --output data/justdial_ahmedabad.csv

export ADMIN_ACCESS_TOKEN=<super-admin-jwt>
python run_justdial_india.py \
  --skip-scrape --input data/justdial_ahmedabad.csv \
  --import-db \
  --api-url https://legal-api.odaflow.com \
  --batch-label justdial-ahmedabad

# 2) Optional: VakeelKhoj all-India list (filter city in admin after import)
python run_vakeelkhoj_india.py \
  --output data/vakeelkhoj_india.csv \
  --import-db \
  --api-url https://legal-api.odaflow.com \
  --batch-label vakeelkhoj-india

# 3) Google enrichment — Admin → Lawyer Prospects → Google Places
#    Select Ahmedabad, mode "Enrichment only" (text search only, no grid)
#    Or full discovery for firms not in directories
```

**Cost note:** Legacy Google Places bills one Place Details call per firm for phone/website. Places API (New) returns contact fields from search when enabled (`GOOGLE_PLACES_USE_NEW_API=true`), cutting billable calls ~40–60%. Use **Compare Legacy vs New** in the admin dialog to validate for your city.

---

## Google Places pipeline (admin UI or CLI)

Discover law firms via Google Maps and import into **Admin → Lawyer Prospects** (`source=google_places`).

**Admin UI:** Lawyer Prospects → **Google Places** button (requires `GOOGLE_PLACES_API_KEY`, Redis, and worker process).

**Modes:**
- **Full discovery** — 2 text queries + 2×2 area grid (6 search steps), then import in batches of 50
- **Enrichment only** — 2 text queries only; updates existing prospects missing phone/website (no new inserts)

**Server env:** `GOOGLE_PLACES_USE_NEW_API=true` (default) uses Places API (New). Enable **Places API (New)** in GCP. Restrict API key to server IP (not website referrer).

**CLI (Ahmedabad example):**

```bash
cd scripts/lawyer-leads && source .venv/bin/activate
export GOOGLE_PLACES_API_KEY=<your-key>

python run_google_places.py \
  --city Ahmedabad \
  --reset-checkpoints \
  --output data/google_places_ahmedabad.csv \
  --limit 2000

# Import to admin
export ADMIN_ACCESS_TOKEN=<super-admin-jwt>
python run_google_places.py \
  --city Ahmedabad \
  --import-db \
  --api-url https://legal-api.odaflow.com \
  --batch-label google-places-ahmedabad
```

Or via orchestrator: `python main.py --sources google_places --cities Ahmedabad --limit 2000`

---

## 25K verified India pipeline (Bar Council + WhatsApp)

Targets **25,000** advocates with **bar enrollment verified** AND **WhatsApp verified** (`wa.me` probe).

```bash
cd /Users/v/Desktop/Apps/legal-by-odaflow/scripts/lawyer-leads
source .venv/bin/activate

# Full run (resumable checkpoints; may take 1–2 days unattended)
python run_india_25k.py \
  --reset-checkpoints \
  --output data/india_25k_verified.csv \
  --min-rows 25000

# Import to production admin
export ADMIN_ACCESS_TOKEN=<super-admin-jwt>
python run_india_25k.py \
  --skip-scrape --input data/india_25k_verified.csv \
  --skip-whatsapp-verify --skip-bar-verify \
  --allow-shortfall \
  --import-db \
  --api-url https://legal-api.odaflow.com \
  --batch-label india-25k-verified-june-2026
```

**Sources:** LawRato, VakilSearch, AdvocateKhoj, JustDial, Sulekha, OSM, NALSA panels, state bar councils.

**Compliance:** Public directories only; respect robots.txt and 1 req/s rate limits. WhatsApp outreach must comply with TRAI/DND — use `DO_NOT_CONTACT` outreach status for opt-outs. Bar verification = enrollment name match, not BCI product endorsement.

**Verification fields in CSV/admin:** `bar_enrollment_number`, `bar_council_state`, `lawyer_verified`, `verified_at`, `whatsapp_confidence=verified`.

---

## JustDial all-cities pipeline (phone + WhatsApp → admin prospects)

Scrapes [JustDial](https://www.justdial.com) lawyer listings across **~260 Indian city slugs** in `data/india_cities.py`, using the canonical category URL pattern (`/Delhi/Lawyers/nct-10296083`). Uses **Playwright** (JustDial blocks plain HTTP). Imports into **Admin → Lawyer Prospects** (`source=justdial`).

```bash
cd scripts/lawyer-leads && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Full sweep (resumable; writes data/raw/justdial.jsonl as it goes)
python run_justdial_india.py \
  --reset-checkpoints \
  --output data/justdial_india.csv \
  --pages-per-city 25 \
  --limit 50000

# Optional: verify WhatsApp numbers (slow; wa.me probe)
python run_justdial_india.py --skip-scrape --input data/justdial_india.csv --verify-whatsapp

# Import to admin (requires super-admin JWT)
export ADMIN_ACCESS_TOKEN=<super-admin-jwt>
python run_justdial_india.py \
  --skip-scrape --input data/justdial_india.csv \
  --import-db \
  --api-url https://legal-api.odaflow.com \
  --batch-label justdial-india-june-2026

# Or import directly via DATABASE_URL from legal_backend/.env (no JWT):
python import_to_db.py --csv data/justdial_india.csv --source-batch justdial-india-june-2026
```

**Resume:** If interrupted, re-run the same command **without** `--reset-checkpoints`; progress is stored in `data/checkpoints/justdial.progress.json`.

**CDP mode (recommended — one Chrome, background, no open/close per URL)**

Terminal 1 — start Chrome **once** (off-screen, stays running):

```bash
cd scripts/lawyer-leads
./start_justdial_chrome.sh --bg
# or foreground: ./start_justdial_chrome.sh
```

Terminal 2 — scrape (attaches to Chrome; parses listing pages for names + phones):

```bash
export JUSTDIAL_CDP_URL=http://127.0.0.1:9222
python run_justdial_india.py --reset-checkpoints --cities delhi --pages-per-city 2 --limit 50 --output data/justdial_india.csv
```

CDP mode loads listing URLs in your background Chrome and extracts data from the page (including `VNumber` phone fields). Chrome stays open between runs.

**Env:** `JUSTDIAL_CDP_URL`, `JUSTDIAL_KEEP_BROWSER=1`, `HTTP_PROXY` (if blocked).

**Troubleshooting 0 records**

| Symptom | Fix |
|---------|-----|
| `ERR_HTTP2_PROTOCOL_ERROR` | Use CDP mode (`start_justdial_chrome.sh`) |
| API returned no data | Fixed — CDP now uses HTML mode by default (don't set `JUSTDIAL_API_ONLY=1`) |
| Playwright missing | `playwright install chromium` |

**Note:** Unlike `run_india_25k.py`, this pipeline does **not** require bar verification — all scraped contacts with phones go to admin prospects for outreach.

---

Targets **Chambers**, **Law.asia**, **IFLR1000**, **LawRato/VakilSearch**, and public **bar/NALSA** panels.

```bash
cd /Users/v/Desktop/Apps/legal-by-odaflow/scripts/lawyer-leads
source .venv/bin/activate

# Recommended: single premium run (email OR phone required by default)
python run_india_premium.py \
  --output data/india_premium.csv \
  --firm-target 2500 \
  --lawyer-target 5000 \
  --min-rows 7500

# With email enrichment (set HUNTER_API_KEY for best results)
export HUNTER_API_KEY=your_key
python run_india_premium.py --output data/india_premium.csv

# Import to production
export ADMIN_ACCESS_TOKEN=<super-admin-jwt>
python import_to_db.py --csv data/india_premium.csv \
  --source-batch india-premium-june-2026 \
  --api-url https://legal-api.odaflow.com
```

**Sources bundled in `run_india_premium.py`:**

| Source | Type | Notes |
|--------|------|-------|
| Chambers India | Firms + ranked lawyers | 20 practice areas, Band 1–5 |
| Law.asia directory | Firms | IBLJ / Asia Business Law Journal listings |
| IFLR1000 India | Banking / capital markets firms | Transactional firms |
| LawRato / VakilSearch | Independent lawyers | Phones + profiles |
| NALSA / bar panels | Advocates | Pro bono lists — use for legal-aid only |

**Note:** Chambers/IFLR pages rarely list direct emails; `HUNTER_API_KEY` + firm websites (`data/india_firm_domains.json`) fill gaps.

## Scrape

```bash
python main.py --output data/lawyers_leads.csv --limit 10000

# Re-run after a failed 0-record scrape (clears stale checkpoints)
python main.py --reset-checkpoints --output data/lawyers_leads.csv --limit 10000

# OSM only (default) — US + India, 100+ metros + statewide grids (~900 tiles, ~25 min)
python main.py --reset-checkpoints --limit 10000 --output data/lawyers_leads.csv

# US only or India only
python main.py --reset-checkpoints --osm-geography us --limit 10000
python main.py --reset-checkpoints --osm-geography in --limit 10000

# Scrape + import to DB
python main.py --output data/lawyers_leads.csv --limit 10000 --import-db --batch-label june-2026
```

**Default source:** `osm` only (OpenStreetMap — no API key). Covers 70+ US metros, 35+ US state grids, 45+ India cities, 20+ India state grids. Optional extras: `justia`, `state_bars`, `avvo`, `india`.

Checkpoints are stored under `data/raw/` and `data/checkpoints/` so runs can resume.

## Import only

```bash
# Auto-loads DATABASE_URL from legal_backend/.env
pip install psycopg2-binary
python import_to_db.py --csv data/lawyers_leads.csv --source-batch june-2026

# Via admin API
export ADMIN_ACCESS_TOKEN=<super_admin_jwt>
python import_to_db.py --csv data/lawyers_leads.csv --api-url http://localhost:3001
```

## Admin panel

After import, open **Admin → Lawyer Prospects** at `/admin/lawyer-prospects` to search, filter, export CSV, upload new batches, and track outreach status.

## Compliance

- Use only public directory data; respect `robots.txt` and rate limits (1–2 req/s per domain).
- Outreach must comply with applicable laws (CAN-SPAM, TRAI, GDPR lawful basis).
- Export and import are restricted to `SUPER_ADMIN` users.

## CSV schema

`id`, `full_name`, `first_name`, `last_name`, `organisation`, `practice_areas`, `city`, `state`, `country`, `phone`, `alternate_phone`, `whatsapp`, `whatsapp_confidence`, `email`, `email_confidence`, `website`, `profile_url`, `bar_enrollment_number`, `bar_council_state`, `lawyer_verified`, `verified_at`, `source`, `scraped_at`
