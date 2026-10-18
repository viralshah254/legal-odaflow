#!/usr/bin/env python3
"""
Scrape JustDial lawyer listings across all configured Indian cities and import
into admin Lawyer Prospects (/admin/lawyer-prospects).

Example:
  cd scripts/lawyer-leads && source .venv/bin/activate
  playwright install chromium

  python run_justdial_india.py \\
    --reset-checkpoints \\
    --output data/justdial_india.csv \\
    --pages-per-city 25

  export ADMIN_ACCESS_TOKEN=<super-admin-jwt>
  python run_justdial_india.py \\
    --skip-scrape --input data/justdial_india.csv \\
    --import-db \\
    --api-url https://legal-api.odaflow.com \\
    --batch-label justdial-india-june-2026
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.whatsapp_flag import enrich_whatsapp, verify_whatsapp_batch
from main import write_csv
from models import ProspectRecord
from scrapers.justdial_india import SOURCE, scrape_justdial_india
from utils.checkpoint import clear_checkpoints, load_records
from utils.dedup import deduplicate
from utils.justdial_progress import clear_progress


async def main_async(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    if args.reset_checkpoints:
        clear_checkpoints(data_dir, SOURCE)
        clear_progress(data_dir)
        print("[info] cleared justdial checkpoints and progress")

    if not args.skip_scrape and not args.no_playwright:
        import os

        if not os.environ.get("JUSTDIAL_CDP_URL"):
            print(
                "[hint] For background scraping (Chrome stays open, one tab reused):\n"
                "  ./start_justdial_chrome.sh --bg\n"
                "  export JUSTDIAL_CDP_URL=http://127.0.0.1:9222",
                file=sys.stderr,
            )

    if args.export_checkpoint:
        rows = load_records(data_dir, SOURCE)
        raw = [ProspectRecord.from_csv_row(r) for r in rows]
        for rec in raw:
            enrich_whatsapp(rec)
        deduped = deduplicate(raw)
        out = Path(args.output)
        write_csv(out, deduped)
        print(f"[export] {len(deduped)} rows from checkpoint → {out}")
        return 0

    if args.skip_scrape:
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"[error] input not found: {input_path}", file=sys.stderr)
            return 1
        import csv

        with input_path.open(encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        raw = [ProspectRecord.from_csv_row(r) for r in rows]
        print(f"[info] loaded {len(raw)} rows from {input_path}")
    else:
        cities = [c.strip() for c in args.cities.split(",") if c.strip()] if args.cities else None
        raw = await scrape_justdial_india(
            data_dir,
            limit=args.limit,
            cities=cities,
            pages_per_city=args.pages_per_city,
            resume=not args.no_resume,
            prefer_playwright=not args.no_playwright,
        )
        print(f"[scrape] justdial raw records: {len(raw)}")

    for rec in raw:
        enrich_whatsapp(rec)

    if args.verify_whatsapp:
        print("[info] verifying WhatsApp via wa.me …")
        raw = await verify_whatsapp_batch(raw)

    if args.require_phone:
        before = len(raw)
        import os

        if os.environ.get("JUSTDIAL_WA_ONLY", "1").lower() not in ("0", "false", "no"):
            raw = [r for r in raw if r.whatsapp]
            print(f"[filter] require WhatsApp (from wa link): {before} → {len(raw)}")
        else:
            raw = [r for r in raw if r.phone or r.whatsapp]
            print(f"[filter] require phone/whatsapp: {before} → {len(raw)}")

    deduped = deduplicate(raw)
    with_phone = sum(1 for r in deduped if r.phone)
    with_wa = sum(1 for r in deduped if r.whatsapp)
    print(
        f"[stats] deduped={len(deduped)} with_phone={with_phone} "
        f"with_whatsapp={with_wa} from_wa_link="
        f"{sum(1 for r in deduped if r.whatsapp_confidence == 'from_wa_link')} verified_wa="
        f"{sum(1 for r in deduped if r.whatsapp_confidence == 'verified')}"
    )

    out = Path(args.output)
    write_csv(out, deduped)
    print(f"[done] wrote {len(deduped)} rows → {out}")

    if args.import_db:
        from import_to_db import import_csv

        result = import_csv(out, batch_label=args.batch_label, api_url=args.api_url)
        print(f"[import] {result}")

    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="JustDial India lawyer scrape → admin lawyer prospects"
    )
    p.add_argument("--output", default="data/justdial_india.csv")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--limit", type=int, default=50000, help="Max records to collect")
    p.add_argument(
        "--pages-per-city",
        type=int,
        default=25,
        help="Max listing pages per city/category",
    )
    p.add_argument(
        "--cities",
        default=None,
        help="Comma-separated city slugs (default: all in data/india_cities.py)",
    )
    p.add_argument("--reset-checkpoints", action="store_true")
    p.add_argument("--no-resume", action="store_true", help="Ignore progress file")
    p.add_argument(
        "--no-playwright",
        action="store_true",
        help="HTTP-only (JustDial often blocks; Playwright recommended)",
    )
    p.add_argument("--verify-whatsapp", action="store_true")
    p.add_argument(
        "--require-phone",
        action="store_true",
        default=True,
        help="Drop rows without phone/whatsapp before CSV/import (default: on)",
    )
    p.add_argument(
        "--allow-no-phone",
        action="store_false",
        dest="require_phone",
        help="Keep listings even when phone was not extracted",
    )
    p.add_argument("--skip-scrape", action="store_true")
    p.add_argument(
        "--export-checkpoint",
        action="store_true",
        help="Write data/raw/justdial.jsonl → --output CSV and exit",
    )
    p.add_argument("--input", default="data/justdial_india.csv")
    p.add_argument("--import-db", action="store_true")
    p.add_argument("--batch-label", default="justdial-india")
    p.add_argument("--api-url", default=None)
    return p.parse_args()


def main() -> None:
    raise SystemExit(asyncio.run(main_async(parse_args())))


if __name__ == "__main__":
    main()
