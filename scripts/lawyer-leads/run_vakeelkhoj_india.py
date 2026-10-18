#!/usr/bin/env python3
"""Import Vakeel Khoj All India Lawyers list into admin prospects."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from main import write_csv
from scrapers.vakeelkhoj_india import LIST_URL, SOURCE, scrape_vakeelkhoj_india
from utils.checkpoint import clear_checkpoints
from utils.dedup import deduplicate


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Vakeel Khoj All India Lawyers → CSV / admin import")
    p.add_argument("--output", default="data/vakeelkhoj_india.csv")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--reset-checkpoints", action="store_true")
    p.add_argument("--import-db", action="store_true")
    p.add_argument("--api-url", default=None)
    p.add_argument("--batch-label", default="vakeelkhoj-india-june-2026")
    return p.parse_args()


async def main_async(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    if args.reset_checkpoints:
        clear_checkpoints(data_dir, SOURCE)
        print(f"[info] cleared {SOURCE} checkpoint")

    records = await scrape_vakeelkhoj_india(data_dir)
    deduped = deduplicate(records)
    with_phone = sum(1 for r in deduped if r.phone)
    with_email = sum(1 for r in deduped if r.email)
    print(f"[scrape] {SOURCE}: {len(deduped)} records (phone={with_phone}, email={with_email})")
    print(f"[source] {LIST_URL}")

    out = Path(args.output)
    write_csv(out, deduped)
    print(f"[done] wrote {len(deduped)} rows → {out}")

    if args.import_db:
        from import_to_db import import_csv

        result = import_csv(out, batch_label=args.batch_label, api_url=args.api_url)
        print(f"[import] {result}")
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(main_async(parse_args())))


if __name__ == "__main__":
    main()
