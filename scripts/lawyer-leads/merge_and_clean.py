#!/usr/bin/env python3
"""
Merge multiple prospect CSVs, re-normalize phones, deduplicate,
optionally verify WhatsApp, and write a clean combined CSV.

Usage:
  python merge_and_clean.py \
    --inputs data/india_osm_clean.csv data/india_dirs_clean.csv \
    --output data/india_merged_clean.csv \
    --min-rows 10000 \
    --verify-whatsapp
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.phone_normalize import is_valid_india_mobile
from enrichment.whatsapp_flag import enrich_whatsapp, verify_whatsapp_batch
from models import ProspectRecord
from utils.dedup import deduplicate
from verification.bar_council_verify import verify_bar_council_batch

CSV_FIELDS = [
    "id", "full_name", "first_name", "last_name", "organisation",
    "practice_areas", "city", "state", "country", "phone", "alternate_phone",
    "whatsapp", "whatsapp_confidence", "email", "email_confidence",
    "website", "profile_url", "bar_enrollment_number", "bar_council_state",
    "lawyer_verified", "verified_at", "source", "scraped_at",
]


def load_csv(path: Path) -> list[ProspectRecord]:
    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        records = []
        for row in reader:
            try:
                records.append(ProspectRecord.from_csv_row(row))
            except Exception:
                continue
    return records


def write_csv(path: Path, records: list[ProspectRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for rec in records:
            writer.writerow(rec.to_csv_row())


async def main_async(args: argparse.Namespace) -> int:
    inputs = [Path(p) for p in args.inputs]
    for p in inputs:
        if not p.exists():
            print(f"[error] Input file not found: {p}", file=sys.stderr)
            return 1

    all_records: list[ProspectRecord] = []
    for p in inputs:
        loaded = load_csv(p)
        print(f"[load] {p.name}: {len(loaded)} records")
        all_records.extend(loaded)

    print(f"[info] {len(all_records)} total before dedup")

    # Re-normalize phones (in case CSVs have raw values) and re-enrich
    for rec in all_records:
        enrich_whatsapp(rec)

    # Deduplicate by dedupe_key
    deduped = deduplicate(all_records)
    print(f"[info] {len(deduped)} after dedup")

    # Filter to India records with valid +91 mobile
    if args.require_phone:
        before = len(deduped)
        deduped = [
            r for r in deduped
            if not (r.country or "").upper() in ("IN", "INDIA")
            or is_valid_india_mobile(r.phone)
        ]
        dropped = before - len(deduped)
        print(f"[filter] --require-phone: dropped {dropped} without valid +91 mobile → {len(deduped)} remain")

    if args.verify_whatsapp:
        print("[info] probing wa.me (slow — ~1 req/s) …")
        deduped = await verify_whatsapp_batch(deduped)

    if args.verify_bar:
        print("[info] bar council name lookup …")
        deduped = await verify_bar_council_batch(deduped)

    if args.require_bar_verified:
        before = len(deduped)
        deduped = [r for r in deduped if r.lawyer_verified]
        print(f"[filter] --require-bar-verified: dropped {before - len(deduped)} → {len(deduped)} remain")

    if args.require_whatsapp_verified:
        before = len(deduped)
        deduped = [r for r in deduped if r.whatsapp_confidence == "verified"]
        print(f"[filter] --require-whatsapp-verified: dropped {before - len(deduped)} → {len(deduped)} remain")

    if args.min_rows and len(deduped) < args.min_rows:
        print(
            f"[error] --min-rows {args.min_rows} not met: only {len(deduped)} rows. "
            "Run scrapers with wider geography or raise limits.",
            file=sys.stderr,
        )
        return 1

    out = Path(args.output)
    write_csv(out, deduped)
    verified = sum(1 for r in deduped if r.whatsapp_confidence == "verified")
    bar_verified = sum(1 for r in deduped if r.lawyer_verified)
    with_phone = sum(1 for r in deduped if r.phone)
    print(
        f"[done] {len(deduped)} rows → {out}\n"
        f"       with phone: {with_phone} | WhatsApp verified: {verified} | Bar verified: {bar_verified}"
    )
    return 0


def main() -> None:
    p = argparse.ArgumentParser(description="Merge, re-normalize, dedupe prospect CSVs")
    p.add_argument("--inputs", nargs="+", required=True, help="Input CSV paths")
    p.add_argument("--output", required=True, help="Output CSV path")
    p.add_argument("--min-rows", type=int, default=0, help="Fail if fewer rows than this")
    p.add_argument(
        "--require-phone", action="store_true", default=False,
        help="Drop India rows without a valid +91 mobile",
    )
    p.add_argument(
        "--verify-whatsapp", action="store_true", default=False,
        help="Probe wa.me to confirm WhatsApp (slow)",
    )
    p.add_argument(
        "--verify-bar", action="store_true", default=False,
        help="Bar Council name lookup for unverified records",
    )
    p.add_argument(
        "--require-bar-verified", action="store_true", default=False,
        help="Keep only bar-verified records",
    )
    p.add_argument(
        "--require-whatsapp-verified", action="store_true", default=False,
        help="Keep only WhatsApp-verified records",
    )
    args = p.parse_args()
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
