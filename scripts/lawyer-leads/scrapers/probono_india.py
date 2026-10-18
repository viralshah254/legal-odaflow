"""Scrape public pro bono / Nyaya Bandhu advocate listings (legal-aid outreach)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

import aiohttp

from enrichment.phone_normalize import normalize_india_phones
from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "probono_nalsa"

PROBONO_URLS: list[tuple[str, str]] = [
    ("Rajasthan", "https://rajasthan.nalsa.gov.in/list-of-plvs/"),
    ("Delhi", "https://delhi.nalsa.gov.in/list-of-plvs/"),
    ("Maharashtra", "https://maharashtra.nalsa.gov.in/list-of-plvs/"),
    ("Karnataka", "https://karnataka.nalsa.gov.in/list-of-plvs/"),
    ("Tamil Nadu", "https://tamilnadu.nalsa.gov.in/list-of-plvs/"),
    ("Gujarat", "https://gujarat.nalsa.gov.in/list-of-plvs/"),
    ("Uttar Pradesh", "https://up.nalsa.gov.in/list-of-plvs/"),
    ("West Bengal", "https://westbengal.nalsa.gov.in/list-of-plvs/"),
    ("Telangana", "https://telangana.nalsa.gov.in/list-of-plvs/"),
    ("Andhra Pradesh", "https://ap.nalsa.gov.in/list-of-plvs/"),
    ("Kerala", "https://kerala.nalsa.gov.in/list-of-plvs/"),
    ("Punjab", "https://punjab.nalsa.gov.in/list-of-plvs/"),
    ("Haryana", "https://haryana.nalsa.gov.in/list-of-plvs/"),
    ("Madhya Pradesh", "https://mp.nalsa.gov.in/list-of-plvs/"),
    ("Bihar", "https://bihar.nalsa.gov.in/list-of-plvs/"),
    ("Odisha", "https://odisha.nalsa.gov.in/list-of-plvs/"),
    ("Assam", "https://assam.nalsa.gov.in/list-of-plvs/"),
    ("Jharkhand", "https://jharkhand.nalsa.gov.in/list-of-plvs/"),
    ("Chhattisgarh", "https://chhattisgarh.nalsa.gov.in/list-of-plvs/"),
    ("Uttarakhand", "https://uttarakhand.nalsa.gov.in/list-of-plvs/"),
]

_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
_ENROLL = re.compile(
    r"(?:Enroll(?:ment)?\.?\s*(?:No\.?)?\s*[:.]?\s*)([A-Z]{2,4}[\s/\-]?\d+[\s/\-]?\d{2,4})",
    re.I,
)


def _parse_probono_page(html: str, state: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()
    now = datetime.now(timezone.utc).isoformat()

    for block in sp.select("table tr, li, p"):
        text = block.get_text(" ", strip=True)
        if len(text) < 10:
            continue
        if "pro bono" not in text.lower() and "probono" not in text.lower():
            if not _EMAIL.search(text):
                continue
        emails = _EMAIL.findall(text)
        phone_match = re.search(r"(?:\+91[\s-]?)?[6-9]\d{9}", text.replace(" ", ""))
        phone = None
        if phone_match:
            phone, _ = normalize_india_phones(phone_match.group(0))
        name = text.split("|")[0].strip()[:80]
        name = re.sub(r"\d{5,}.*", "", name).strip()
        if len(name) < 4:
            continue
        enroll = _ENROLL.search(text)
        key = (name + (emails[0] if emails else "")).lower()
        if key in seen:
            continue
        seen.add(key)
        rec = ProspectRecord(
            full_name=name,
            practice_areas="Pro bono / Nyaya Bandhu (legal aid)",
            state=state,
            country="IN",
            phone=phone,
            email=emails[0] if emails else None,
            email_confidence="scraped" if emails else None,
            source=SOURCE,
        )
        if enroll:
            rec.bar_enrollment_number = enroll.group(1).strip()
            rec.lawyer_verified = True
            rec.bar_council_state = state[:3].upper()
            rec.verified_at = now
        records.append(rec)
    return records


async def scrape_probono_advocates(data_dir: Path, limit: int = 5000) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        for state, url in PROBONO_URLS:
            if len(all_records) >= limit:
                break
            html = await fetch_html(session, limiter, url, allow_robots=False)
            if not html:
                continue
            for rec in _parse_probono_page(html, state):
                k = rec.dedupe_key
                if k not in seen:
                    seen.add(k)
                    all_records.append(rec)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
