#!/usr/bin/env python3
"""Import law firms from Google Places into admin prospects."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.whatsapp_flag import enrich_whatsapp
from main import write_csv
from scrapers.google_places import SOURCE, scrape_google_places
from utils.checkpoint import clear_checkpoints
from utils.dedup import deduplicate


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Google Places law firms → CSV / admin import")
    p.add_argument("--city", default="Ahmedabad", help="Indian city name (default: Ahmedabad)")
    p.add_argument("--output", default=None, help="CSV output path")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--limit", type=int, default=2000)
    p.add_argument("--reset-checkpoints", action="store_true")
    p.add_argument("--import-db", action="store_true")
    p.add_argument("--api-url", default=None)
    p.add_argument("--batch-label", default=None)
    return p.parse_args()


async def main_async(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    city = args.city.strip()
    checkpoint_key = f"{SOURCE}_{city.lower()}"

    if args.reset_checkpoints:
        clear_checkpoints(data_dir, checkpoint_key)
        print(f"[info] cleared {checkpoint_key} checkpoint")

    records = await scrape_google_places(data_dir, limit=args.limit, city=city)
    for rec in records:
        enrich_whatsapp(rec)
    deduped = deduplicate(records)
    with_phone = sum(1 for r in deduped if r.phone)
    print(f"[scrape] {SOURCE}: {len(deduped)} records for {city} (phone={with_phone})")

    out = Path(args.output or f"data/google_places_{city.lower()}.csv")
    write_csv(out, deduped)
    print(f"[done] wrote {len(deduped)} rows → {out}")

    if args.import_db:
        from import_to_db import import_csv

        batch = args.batch_label or f"google-places-{city.lower()}"
        result = import_csv(out, batch_label=batch, api_url=args.api_url)
        print(f"[import] {result}")
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(main_async(parse_args())))


if __name__ == "__main__":
    main()
