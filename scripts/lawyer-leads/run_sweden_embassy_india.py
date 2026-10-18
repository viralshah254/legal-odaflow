#!/usr/bin/env python3
"""Import Sweden Embassy (New Delhi) India lawyer referral PDF into admin prospects."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from main import write_csv
from models import ProspectRecord
from scrapers.sweden_embassy_india import PDF_URL, SOURCE, scrape_sweden_embassy_india
from utils.dedup import deduplicate


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Sweden Embassy India lawyer list → CSV / admin import")
    p.add_argument("--output", default="data/sweden_embassy_india.csv")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--pdf", default=None, help="Local PDF path (default: download/cache)")
    p.add_argument("--import-db", action="store_true")
    p.add_argument("--api-url", default=None)
    p.add_argument("--batch-label", default="sweden-embassy-india-june-2026")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    pdf_path = Path(args.pdf) if args.pdf else None
    records = scrape_sweden_embassy_india(data_dir, pdf_path=pdf_path)
    deduped = deduplicate(records)
    with_phone = sum(1 for r in deduped if r.phone)
    with_email = sum(1 for r in deduped if r.email)
    print(f"[scrape] {SOURCE}: {len(deduped)} records (phone={with_phone}, email={with_email})")
    print(f"[source] {PDF_URL}")

    out = Path(args.output)
    write_csv(out, deduped)
    print(f"[done] wrote {len(deduped)} rows → {out}")

    if args.import_db:
        from import_to_db import import_csv

        result = import_csv(out, batch_label=args.batch_label, api_url=args.api_url)
        print(f"[import] {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
