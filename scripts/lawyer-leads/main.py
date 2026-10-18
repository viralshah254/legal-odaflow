#!/usr/bin/env python3
"""Orchestrate lawyer prospect scrapers, enrich, dedupe, export CSV."""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.email_finder import enrich_emails
from enrichment.phone_normalize import is_valid_india_mobile
from enrichment.whatsapp_flag import enrich_whatsapp, verify_whatsapp_batch
from models import ProspectRecord
from scrapers.avvo import scrape_avvo
from scrapers.chambers_india import scrape_chambers_india
from scrapers.iflr1000_india import scrape_iflr1000_india
from scrapers.india_bar_councils import scrape_india_bar_councils
from scrapers.india_dirs import scrape_india_dirs
from scrapers.india_premium import scrape_india_premium
from scrapers.sweden_embassy_india import scrape_sweden_embassy_india
from scrapers.vakeelkhoj_india import scrape_vakeelkhoj_india
from scrapers.google_places import scrape_google_places
from scrapers.justia import scrape_justia
from scrapers.law_asia import scrape_law_asia
from scrapers.legal500_india import scrape_legal500_india
from scrapers.osm import scrape_osm
from scrapers.probono_india import scrape_probono_advocates
from scrapers.state_bars import scrape_state_bars
from utils.checkpoint import clear_checkpoints
from utils.dedup import deduplicate

CSV_FIELDS = [
    "id",
    "full_name",
    "first_name",
    "last_name",
    "organisation",
    "practice_areas",
    "city",
    "state",
    "country",
    "phone",
    "alternate_phone",
    "whatsapp",
    "whatsapp_confidence",
    "email",
    "email_confidence",
    "website",
    "profile_url",
    "bar_enrollment_number",
    "bar_council_state",
    "lawyer_verified",
    "verified_at",
    "source",
    "scraped_at",
]

DEFAULT_SOURCES = ["osm"]

SCRAPERS = {
    "osm": scrape_osm,
    "justia": scrape_justia,
    "state_bars": scrape_state_bars,
    "avvo": scrape_avvo,
    "india": scrape_india_dirs,
    "chambers": scrape_chambers_india,
    "law_asia": scrape_law_asia,
    "legal500": scrape_legal500_india,
    "iflr1000": scrape_iflr1000_india,
    "india_bars": scrape_india_bar_councils,
    "probono": scrape_probono_advocates,
    "india_premium": scrape_india_premium,
    "sweden_embassy": scrape_sweden_embassy_india,
    "vakeelkhoj": scrape_vakeelkhoj_india,
    "google_places": scrape_google_places,
}


async def run_scrapers(
    data_dir: Path,
    limit: int,
    sources: list[str] | None,
    osm_geography: str | None = None,
    india_cities: list[str] | None = None,
) -> list[ProspectRecord]:
    active = sources or DEFAULT_SOURCES
    per_source = max(limit // max(len(active), 1), 500)
    all_records: list[ProspectRecord] = []

    tasks = []
    for name in active:
        fn = SCRAPERS.get(name)
        if not fn:
            continue
        if name == "osm":
            tasks.append(
                (name, fn(data_dir, limit=limit, geography=osm_geography))
            )
        elif name == "india":
            tasks.append((name, fn(data_dir, limit=per_source, cities=india_cities)))
        elif name == "chambers":
            tasks.append((name, fn(data_dir, firm_limit=per_source, lawyer_limit=per_source * 2)))
        elif name == "india_premium":
            tasks.append((name, fn(data_dir, firm_target=2500, lawyer_target=5000)))
        elif name == "sweden_embassy":
            tasks.append((name, asyncio.to_thread(fn, data_dir)))
        elif name == "google_places":
            city = india_cities[0] if india_cities and len(india_cities) == 1 else None
            tasks.append((name, fn(data_dir, limit=per_source, city=city)))
        else:
            tasks.append((name, fn(data_dir, limit=per_source)))

    results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
    for (name, _), result in zip(tasks, results):
        if isinstance(result, Exception):
            print(f"[warn] {name} failed: {result}", file=sys.stderr)
            continue
        print(f"[ok] {name}: {len(result)} records")
        all_records.extend(result)

    return all_records


def write_csv(path: Path, records: list[ProspectRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for rec in records:
            writer.writerow(rec.to_csv_row())


async def main_async(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    if args.reset_checkpoints:
        sources = (
            [s.strip() for s in args.sources.split(",")]
            if args.sources
            else None
        )
        clear_checkpoints(data_dir, sources[0] if sources and len(sources) == 1 else None)
        if sources and len(sources) > 1:
            for s in sources:
                clear_checkpoints(data_dir, s)
        print("[info] cleared checkpoints — scrapers will re-run")

    sources = [s.strip() for s in args.sources.split(",")] if args.sources else None
    india_cities = [c.strip() for c in args.cities.split(",")] if args.cities else None
    raw = await run_scrapers(
        data_dir, args.limit, sources,
        osm_geography=args.osm_geography,
        india_cities=india_cities,
    )

    # Normalize + enrich all records (sets phone, alternate_phone, whatsapp)
    for rec in raw:
        enrich_whatsapp(rec)

    # --require-phone: drop India records without a valid +91 mobile
    if args.require_phone:
        before = len(raw)
        raw = [
            r for r in raw
            if not (r.country or "").upper() in ("IN", "INDIA")
            or is_valid_india_mobile(r.phone)
        ]
        print(f"[filter] --require-phone: {before} -> {len(raw)} (dropped {before - len(raw)} without valid phone)")

    if args.enrich_email:
        print("[info] enriching emails...")
        raw = await enrich_emails(raw)

    if args.verify_whatsapp:
        print("[info] verifying WhatsApp numbers (slow — ~1 req/s)...")
        raw = await verify_whatsapp_batch(raw)

    deduped = deduplicate(raw)
    deduped = deduped[: args.limit]
    print(f"[info] {len(raw)} raw -> {len(deduped)} after dedup (limit {args.limit})")

    # --min-rows: fail if final count is too low
    if args.min_rows and len(deduped) < args.min_rows:
        print(
            f"[error] --min-rows {args.min_rows} not met: only {len(deduped)} rows produced. "
            "Widen geography or raise limits.",
            file=sys.stderr,
        )
        return 1

    out = Path(args.output)
    write_csv(out, deduped)
    print(f"[done] wrote {len(deduped)} rows to {out}")

    if args.import_db:
        from import_to_db import import_csv

        if not deduped:
            print("[warn] skipping DB import — no rows in CSV")
        else:
            result = import_csv(out, batch_label=args.batch_label, api_url=args.api_url)
            print(f"[import] {result}")

    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Lawyer prospect lead scraper")
    p.add_argument("--output", default="data/lawyers_leads.csv")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--limit", type=int, default=10000)
    p.add_argument(
        "--sources",
        help="Comma-separated sources (default: osm). Options: osm,justia,state_bars,avvo,india,chambers,law_asia,iflr1000,india_bars,probono,india_premium,vakeelkhoj,google_places",
    )
    p.add_argument(
        "--osm-geography",
        choices=["all", "us", "in"],
        default="all",
        help="Limit OSM scraper to US, India, or both (default: all)",
    )
    p.add_argument(
        "--reset-checkpoints",
        action="store_true",
        help="Clear cached .done flags and re-scrape (use after 0-record run)",
    )
    p.add_argument("--enrich-email", action="store_true", default=True)
    p.add_argument("--no-enrich-email", action="store_false", dest="enrich_email")
    p.add_argument(
        "--require-phone",
        action="store_true",
        default=False,
        help="Drop India rows that don't have a valid +91 mobile after normalization",
    )
    p.add_argument(
        "--min-rows",
        type=int,
        default=0,
        help="Fail the run if final deduped count is below this threshold",
    )
    p.add_argument(
        "--verify-whatsapp",
        action="store_true",
        default=False,
        help="Probe wa.me to confirm WhatsApp for India numbers (slow, ~1 req/s)",
    )
    p.add_argument(
        "--cities",
        default=None,
        help="Comma-separated cities for India directory scraper (default: all INDIAN_CITIES)",
    )
    p.add_argument("--import-db", action="store_true", help="Import CSV after scrape")
    p.add_argument("--batch-label", default="scrape-run")
    p.add_argument("--api-url", default=None, help="Backend URL for API import")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
