#!/usr/bin/env python3
"""
Maximum-volume India scrape: all sources, no row caps, keep every record.

Usage:
  cd scripts/lawyer-leads && source .venv/bin/activate
  python run_india_max.py --reset-checkpoints --output data/india_max.csv
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.email_finder import enrich_emails
from enrichment.firm_websites import enrich_firm_websites
from enrichment.whatsapp_flag import enrich_whatsapp
from main import write_csv
from scrapers.india_premium import scrape_india_premium, _is_firm
from utils.checkpoint import clear_checkpoints
from utils.dedup import deduplicate


async def main_async(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    if args.reset_checkpoints:
        for src in (
            "chambers_firms+chambers_lawyers",
            "law_asia",
            "legal500",
            "iflr1000",
            "india_bar",
            "probono_nalsa",
            "india_dirs",
            "justdial",
            "osm",
        ):
            clear_checkpoints(data_dir, src.split("+")[0])
        clear_checkpoints(data_dir, None)
        from utils.justdial_progress import clear_progress

        clear_progress(data_dir)
        print("[info] cleared all checkpoints")

    raw = await scrape_india_premium(
        data_dir,
        firm_target=args.firm_target,
        lawyer_target=args.lawyer_target,
        include_directories=True,
        include_osm=True,
        max_volume=True,
    )

    for rec in raw:
        enrich_whatsapp(rec)
    enrich_firm_websites(raw)

    if args.enrich_email:
        print(f"[info] enriching emails for {len(raw)} records...")
        raw = await enrich_emails(raw)

    deduped = deduplicate(raw)
    print(f"[info] {len(raw)} raw -> {len(deduped)} after dedup")

    firms = [r for r in deduped if _is_firm(r)]
    lawyers = [r for r in deduped if not _is_firm(r)]
    with_phone = sum(1 for r in deduped if r.phone)
    with_email = sum(1 for r in deduped if r.email)
    print(
        f"[stats] total={len(deduped)} firms={len(firms)} lawyers={len(lawyers)} "
        f"phone={with_phone} email={with_email}"
    )

    out = Path(args.output)
    write_csv(out, deduped)
    print(f"[done] wrote {len(deduped)} rows to {out}")

    if args.import_db:
        from import_to_db import import_csv
        result = import_csv(out, batch_label=args.batch_label, api_url=args.api_url)
        print(f"[import] {result}")

    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Max-volume India lawyer/firm scrape")
    p.add_argument("--output", default="data/india_max.csv")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--firm-target", type=int, default=2500)
    p.add_argument("--lawyer-target", type=int, default=5000)
    p.add_argument("--reset-checkpoints", action="store_true")
    p.add_argument("--enrich-email", action="store_true", default=True)
    p.add_argument("--no-enrich-email", action="store_false", dest="enrich_email")
    p.add_argument("--import-db", action="store_true")
    p.add_argument("--batch-label", default="india-max")
    p.add_argument("--api-url", default=None)
    return p.parse_args()


def main() -> None:
    raise SystemExit(asyncio.run(main_async(parse_args())))


if __name__ == "__main__":
    main()
