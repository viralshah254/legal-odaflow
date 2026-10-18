"""Sweden Embassy New Delhi lawyer referral list (public PDF)."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.request import urlretrieve

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.phone_normalize import normalize_india_phones
from models import ProspectRecord

SOURCE = "sweden_embassy_india"

PDF_URL = (
    "https://www.swedenabroad.se/globalassets/ambassader/"
    "indien-new-delhi/documents/list-of-lawyers-india.pdf"
)

CURATED_PATH = _ROOT / "data" / "sweden_embassy_india_entries.json"


def _download_pdf(dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urlretrieve(PDF_URL, dest)
    return dest


def _cache_pdf(data_dir: Path) -> Path:
    cache = data_dir / "raw" / "sweden_embassy_lawyers_india.pdf"
    if not cache.exists():
        _download_pdf(cache)
    return cache


def load_curated_entries() -> list[dict]:
    if not CURATED_PATH.exists():
        raise FileNotFoundError(f"Missing curated list: {CURATED_PATH}")
    return json.loads(CURATED_PATH.read_text(encoding="utf-8"))


def curated_to_records(rows: list[dict]) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    for row in rows:
        phone, alt_from_phone = normalize_india_phones(row.get("phone"))
        alt = row.get("alternate_phone")
        if alt:
            alt_norm, _ = normalize_india_phones(alt)
            alt = alt_norm or alt_from_phone
        else:
            alt = alt_from_phone if alt_from_phone != phone else None

        records.append(
            ProspectRecord(
                full_name=row["full_name"],
                organisation=row.get("organisation"),
                practice_areas=row.get("practice_areas"),
                city=row.get("city"),
                state=row.get("state"),
                country="IN",
                phone=phone,
                alternate_phone=alt,
                whatsapp=phone,
                email=row.get("email"),
                website=row.get("website"),
                profile_url=PDF_URL,
                source=SOURCE,
                lawyer_verified=True,
            )
        )
    return records


def scrape_sweden_embassy_india(
    data_dir: Path,
    *,
    pdf_path: Path | None = None,
) -> list[ProspectRecord]:
    """Load embassy lawyer list; caches PDF for provenance."""
    if pdf_path and pdf_path.exists():
        _cache_pdf(data_dir)
    else:
        try:
            _cache_pdf(data_dir)
        except Exception as exc:
            print(f"[warn] could not cache PDF: {exc}", file=sys.stderr)
    return curated_to_records(load_curated_entries())
