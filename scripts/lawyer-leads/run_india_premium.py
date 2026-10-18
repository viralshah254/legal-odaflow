#!/usr/bin/env python3
"""
Premium India pipeline: 2,500 top law firms + 5,000 lawyers with contacts.

Sources:
  - Chambers Asia-Pacific / India rankings (firms + partners)
  - Law.asia / IBLJ firm directory
  - IFLR1000 India (banking, capital markets, M&A)
  - LawRato / VakilSearch (independent advocates)
  - State bar / NALSA public panels (pro bono — tag carefully)

Usage:
  cd scripts/lawyer-leads && source .venv/bin/activate
  python run_india_premium.py --output data/india_premium.csv
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
from enrichment.phone_normalize import is_valid_india_mobile
from enrichment.whatsapp_flag import enrich_whatsapp, verify_whatsapp_batch
from main import CSV_FIELDS, write_csv
from models import ProspectRecord
from scrapers.india_premium import scrape_india_premium, _is_firm
from utils.dedup import deduplicate


async def main_async(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    raw = await scrape_india_premium(
        data_dir,
        firm_target=args.firm_target,
        lawyer_target=args.lawyer_target,
        include_directories=not args.no_directories,
        include_osm=not args.no_osm,
        max_volume=args.max_volume,
    )

    for rec in raw:
        enrich_whatsapp(rec)

    enrich_firm_websites(raw)

    if args.enrich_email:
        print("[info] enriching emails (Hunter + domain patterns)...")
        raw = await enrich_emails(raw)

    if args.email_or_phone:
        before = len(raw)
        raw = [
            r for r in raw
            if is_valid_india_mobile(r.phone) or bool(r.email)
        ]
        print(f"[filter] --email-or-phone: {before} -> {len(raw)}")
    elif args.require_phone:
        before = len(raw)
        raw = [r for r in raw if is_valid_india_mobile(r.phone)]
        print(f"[filter] --require-phone: {before} -> {len(raw)}")

    if args.verify_whatsapp:
        print("[info] verifying WhatsApp (slow)...")
        raw = await verify_whatsapp_batch(raw)

    deduped = deduplicate(raw)
    print(f"[info] {len(raw)} -> {len(deduped)} after global dedup")

    firms = [r for r in deduped if _is_firm(r)]
    lawyers = [r for r in deduped if not _is_firm(r)]
    print(f"[info] firms={len(firms)}, lawyers={len(lawyers)}")

    min_total = args.firm_target + args.lawyer_target
    if args.min_rows and len(deduped) < args.min_rows:
        print(
            f"[warn] only {len(deduped)} rows (target {min_total}). "
            "Add HUNTER_API_KEY, widen sources, or run india_dirs/OSM pass.",
            file=sys.stderr,
        )
        if args.strict_min_rows:
            return 1

    out = Path(args.output)
    write_csv(out, deduped)
    print(f"[done] wrote {len(deduped)} rows to {out}")

    if args.import_db:
        from import_to_db import import_csv
        result = import_csv(out, batch_label=args.batch_label, api_url=args.api_url)
        print(f"[import] {result}")

    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Premium India firms + lawyers pipeline")
    p.add_argument("--output", default="data/india_premium.csv")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--firm-target", type=int, default=2500)
    p.add_argument("--lawyer-target", type=int, default=5000)
    p.add_argument("--min-rows", type=int, default=7500)
    p.add_argument("--strict-min-rows", action="store_true")
    p.add_argument("--no-directories", action="store_true", help="Skip LawRato/VakilSearch")
    p.add_argument("--no-osm", action="store_true", help="Skip OSM India scrape")
    p.add_argument("--max-volume", action="store_true", help="No firm/lawyer caps — scrape everything")
    p.add_argument("--reset-checkpoints", action="store_true")
    p.add_argument(
        "--email-or-phone",
        action="store_true",
        default=False,
        help="Keep rows with email OR valid +91 phone (runs after email enrichment)",
    )
    p.add_argument("--require-phone", action="store_true")
    p.add_argument("--no-email-or-phone", action="store_false", dest="email_or_phone")
    p.add_argument("--enrich-email", action="store_true", default=True)
    p.add_argument("--no-enrich-email", action="store_false", dest="enrich_email")
    p.add_argument("--verify-whatsapp", action="store_true")
    p.add_argument("--import-db", action="store_true")
    p.add_argument("--batch-label", default="india-premium")
    p.add_argument("--api-url", default=None)
    return p.parse_args()


def main() -> None:
    raise SystemExit(asyncio.run(main_async(parse_args())))


if __name__ == "__main__":
    main()
