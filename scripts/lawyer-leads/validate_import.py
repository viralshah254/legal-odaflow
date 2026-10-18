#!/usr/bin/env python3
"""Validate import path and print LawyerProspect stats (no scraping)."""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from import_to_db import import_csv, load_backend_env


def write_sample_csv(path: Path, count: int = 5) -> None:
    """Write minimal bar+WhatsApp verified sample rows for import smoke test."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "id", "full_name", "first_name", "last_name", "organisation",
        "practice_areas", "city", "state", "country", "phone", "alternate_phone",
        "whatsapp", "whatsapp_confidence", "email", "email_confidence",
        "website", "profile_url", "bar_enrollment_number", "bar_council_state",
        "lawyer_verified", "verified_at", "source", "scraped_at",
    ]
    now = datetime.now(timezone.utc).isoformat()
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for i in range(count):
            mobile = f"+9198765{40000 + i:05d}"[-13:]  # +91987654xxxx
            writer.writerow({
                "id": "",
                "full_name": f"Sample Advocate {i + 1}",
                "first_name": "Sample",
                "last_name": f"Advocate{i + 1}",
                "organisation": "",
                "practice_areas": "Criminal Law",
                "city": "Mumbai",
                "state": "Maharashtra",
                "country": "IN",
                "phone": mobile,
                "alternate_phone": "",
                "whatsapp": mobile,
                "whatsapp_confidence": "verified",
                "email": "",
                "email_confidence": "",
                "website": "",
                "profile_url": "",
                "bar_enrollment_number": f"MAH/{1000 + i}/2020",
                "bar_council_state": "MAH",
                "lawyer_verified": "true",
                "verified_at": now,
                "source": "import_smoke_test",
                "scraped_at": now,
            })


def main() -> int:
    p = argparse.ArgumentParser(description="Validate lawyer prospect import")
    p.add_argument("--sample-csv", default="data/import_smoke_test.csv")
    p.add_argument("--sample-rows", type=int, default=5)
    p.add_argument("--import", action="store_true", dest="do_import")
    p.add_argument("--batch-label", default="import-smoke-test")
    args = p.parse_args()

    csv_path = Path(args.sample_csv)
    write_sample_csv(csv_path, args.sample_rows)
    print(f"[ok] wrote {args.sample_rows} sample rows to {csv_path}")

    if args.do_import:
        load_backend_env()
        result = import_csv(csv_path, batch_label=args.batch_label)
        print(f"[import] {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
