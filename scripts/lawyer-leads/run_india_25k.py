#!/usr/bin/env python3
"""
25K verified India lawyer WhatsApp prospects pipeline.

Scrapes public directories → WhatsApp verify → Bar Council verify → export CSV → optional DB import.

Usage:
  cd scripts/lawyer-leads && source .venv/bin/activate
  python run_india_25k.py --reset-checkpoints --output data/india_25k_verified.csv
  python run_india_25k.py --skip-scrape --input data/india_raw.csv --output data/india_25k_verified.csv
  python run_india_25k.py --import-db --api-url http://localhost:3001
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.phone_normalize import is_valid_india_mobile
from enrichment.whatsapp_flag import enrich_whatsapp, verify_whatsapp_batch
from main import CSV_FIELDS, write_csv
from models import ProspectRecord
from scrapers.india_premium import scrape_india_premium
from utils.checkpoint import clear_checkpoints
from utils.dedup import deduplicate
from verification.bar_council_verify import verify_bar_council_batch

TARGET_ROWS = 25000

# Prefer bar-enrollment-rich sources when deduping by phone
SOURCE_PRIORITY = {
    "india_bar": 100,
    "probono_nalsa": 95,
    "advocatekhoj": 90,
    "lawrato": 80,
    "vakilsearch": 80,
    "chambers_lawyer": 70,
    "chambers_firm": 65,
    "osm": 50,
    "justdial": 40,
    "sulekha": 35,
}


def _source_score(rec: ProspectRecord) -> int:
    src = (rec.source or "").lower()
    for key, score in SOURCE_PRIORITY.items():
        if key in src:
            return score
    return 30


def dedupe_by_phone(records: list[ProspectRecord]) -> list[ProspectRecord]:
    """Keep best record per normalized phone (bar-verified sources win)."""
    by_phone: dict[str, ProspectRecord] = {}
    no_phone: list[ProspectRecord] = []

    for rec in records:
        phone = rec.phone or rec.whatsapp
        if not phone or not is_valid_india_mobile(phone):
            no_phone.append(rec)
            continue
        existing = by_phone.get(phone)
        if not existing:
            by_phone[phone] = rec
            continue
        rec_score = _source_score(rec) + (20 if rec.lawyer_verified else 0)
        exist_score = _source_score(existing) + (20 if existing.lawyer_verified else 0)
        if rec_score > exist_score:
            by_phone[phone] = rec

    return list(by_phone.values()) + no_phone


def filter_verified(records: list[ProspectRecord]) -> list[ProspectRecord]:
    return [
        r for r in records
        if r.lawyer_verified
        and r.whatsapp_confidence == "verified"
        and is_valid_india_mobile(r.phone)
        and (r.country or "").upper() in ("IN", "INDIA")
    ]


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
            "advocatekhoj",
            "justdial",
            "sulekha",
            "osm",
        ):
            clear_checkpoints(data_dir, src.split("+")[0])
        clear_checkpoints(data_dir, None)
        print("[info] cleared all checkpoints")

    if args.skip_scrape and args.input:
        from merge_and_clean import load_csv
        raw = load_csv(Path(args.input))
        print(f"[info] loaded {len(raw)} records from {args.input}")
    else:
        raw = await scrape_india_premium(
            data_dir,
            max_volume=True,
            include_directories=True,
            include_osm=not args.no_osm,
            include_biz_dirs=not args.no_biz_dirs,
        )

    for rec in raw:
        enrich_whatsapp(rec)

    if args.require_phone:
        raw = [
            r for r in raw
            if is_valid_india_mobile(r.phone)
            and (r.country or "").upper() in ("IN", "INDIA")
        ]
        print(f"[info] {len(raw)} records with valid +91 mobile")

    if not args.skip_whatsapp_verify:
        print("[info] WhatsApp verification (wa.me probe) …")
        raw = await verify_whatsapp_batch(
            raw,
            concurrency=args.wa_concurrency,
            delay_sec=args.wa_delay,
        )

    if not args.skip_bar_verify:
        print("[info] Bar Council verification …")
        raw = await verify_bar_council_batch(
            raw,
            concurrency=args.bar_concurrency,
            checkpoint_dir=data_dir / "checkpoints",
        )

    deduped = deduplicate(raw)
    print(f"[info] {len(raw)} raw → {len(deduped)} after name dedup")

    phone_deduped = dedupe_by_phone(deduped)
    print(f"[info] {len(phone_deduped)} after phone dedup")

    verified = filter_verified(phone_deduped)
    print(
        f"[stats] bar+WhatsApp verified: {len(verified)} / target {args.min_rows or TARGET_ROWS}"
    )

    min_rows = args.min_rows or TARGET_ROWS
    if len(verified) < min_rows and not args.allow_shortfall:
        # Write partial output for inspection
        partial = Path(args.output)
        write_csv(partial, verified)
        print(
            f"[error] target {min_rows} not met ({len(verified)} rows). "
            f"Partial CSV at {partial}. Re-run with wider scrape or --allow-shortfall.",
            file=sys.stderr,
        )
        return 1

    out = Path(args.output)
    write_csv(out, verified)
    print(f"[done] wrote {len(verified)} verified rows to {out}")

    if args.import_db:
        from import_to_db import import_csv
        result = import_csv(
            out,
            batch_label=args.batch_label,
            api_url=args.api_url,
        )
        print(f"[import] {result}")

    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="25K bar+WhatsApp verified India lawyer pipeline")
    p.add_argument("--output", default="data/india_25k_verified.csv")
    p.add_argument("--input", default=None, help="Skip scrape; load existing CSV")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--min-rows", type=int, default=TARGET_ROWS)
    p.add_argument("--allow-shortfall", action="store_true")
    p.add_argument("--reset-checkpoints", action="store_true")
    p.add_argument("--skip-scrape", action="store_true")
    p.add_argument("--skip-whatsapp-verify", action="store_true")
    p.add_argument("--skip-bar-verify", action="store_true")
    p.add_argument("--no-osm", action="store_true", help="Skip OSM (faster)")
    p.add_argument("--no-biz-dirs", action="store_true", help="Skip JustDial/Sulekha")
    p.add_argument("--require-phone", action="store_true", default=True)
    p.add_argument("--wa-concurrency", type=int, default=5)
    p.add_argument("--wa-delay", type=float, default=0.5)
    p.add_argument("--bar-concurrency", type=int, default=3)
    p.add_argument("--import-db", action="store_true")
    p.add_argument("--batch-label", default="india-25k-verified")
    p.add_argument("--api-url", default=None)
    return p.parse_args()


def main() -> None:
    raise SystemExit(asyncio.run(main_async(parse_args())))


if __name__ == "__main__":
    main()
