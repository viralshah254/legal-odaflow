"""Scrape AdvocateKhoj lawyer listings by state/city."""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path
from typing import Sequence

import aiohttp

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from data.india_cities import INDIAN_CITIES
from enrichment.phone_normalize import normalize_india_phones
from models import ProspectRecord
from scrapers.base import fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "advocatekhoj"

STATE_PAGES = [
    ("Maharashtra", "https://www.advocatekhoj.com/locate/lawyers/Maharashtra/"),
    ("Delhi", "https://www.advocatekhoj.com/locate/lawyers/Delhi/"),
    ("Karnataka", "https://www.advocatekhoj.com/locate/lawyers/Karnataka/"),
    ("Tamil Nadu", "https://www.advocatekhoj.com/locate/lawyers/Tamil%20Nadu/"),
    ("Gujarat", "https://www.advocatekhoj.com/locate/lawyers/Gujarat/"),
    ("Uttar Pradesh", "https://www.advocatekhoj.com/locate/lawyers/Uttar%20Pradesh/"),
    ("West Bengal", "https://www.advocatekhoj.com/locate/lawyers/West%20Bengal/"),
    ("Rajasthan", "https://www.advocatekhoj.com/locate/lawyers/Rajasthan/"),
    ("Telangana", "https://www.advocatekhoj.com/locate/lawyers/Telangana/"),
    ("Andhra Pradesh", "https://www.advocatekhoj.com/locate/lawyers/Andhra%20Pradesh/"),
    ("Kerala", "https://www.advocatekhoj.com/locate/lawyers/Kerala/"),
    ("Punjab", "https://www.advocatekhoj.com/locate/lawyers/Punjab/"),
    ("Haryana", "https://www.advocatekhoj.com/locate/lawyers/Haryana/"),
    ("Madhya Pradesh", "https://www.advocatekhoj.com/locate/lawyers/Madhya%20Pradesh/"),
    ("Bihar", "https://www.advocatekhoj.com/locate/lawyers/Bihar/"),
    ("Odisha", "https://www.advocatekhoj.com/locate/lawyers/Odisha/"),
    ("Assam", "https://www.advocatekhoj.com/locate/lawyers/Assam/"),
    ("Jharkhand", "https://www.advocatekhoj.com/locate/lawyers/Jharkhand/"),
    ("Chhattisgarh", "https://www.advocatekhoj.com/locate/lawyers/Chhattisgarh/"),
    ("Uttarakhand", "https://www.advocatekhoj.com/locate/lawyers/Uttarakhand/"),
]

_PHONE = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}")
_ENROLL = re.compile(
    r"(?:Enroll(?:ment)?\.?\s*(?:No\.?)?\s*[:.]?\s*)([A-Z]{2,4}[\s/\-]?\d+[\s/\-]?\d{2,4})",
    re.I,
)


def _extract_phones(el) -> tuple[str | None, str | None]:
    raw: list[str] = []
    for a in el.select('a[href^="tel:"]'):
        num = a.get("href", "").replace("tel:", "").strip()
        if num:
            raw.append(num)
    text = el.get_text(" ", strip=True)
    for m in _PHONE.findall(text.replace(" ", "")):
        raw.append(m)
    combined = " / ".join(raw) if raw else None
    return normalize_india_phones(combined)


def _parse_listing_page(html: str, state: str, city: str | None = None) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()

    for block in sp.select(
        ".lawyer-listing, .advocate-listing, .listing, tr, li, "
        ".profile, [class*=lawyer], [class*=advocate]"
    ):
        name_el = block.select_one("h2, h3, h4, a.name, .name, strong, b")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if len(name) < 4 or name.lower() in ("name", "advocate", "lawyer"):
            continue
        text = block.get_text(" ", strip=True)
        enroll_match = _ENROLL.search(text)
        primary, alternate = _extract_phones(block)
        href_el = block.select_one("a[href]")
        profile = None
        if href_el:
            h = href_el.get("href", "")
            if h.startswith("/"):
                profile = f"https://www.advocatekhoj.com{h}"
            elif h.startswith("http"):
                profile = h
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        rec = ProspectRecord(
            full_name=name,
            city=city.title() if city else None,
            state=state,
            country="IN",
            phone=primary,
            alternate_phone=alternate,
            profile_url=profile,
            source=SOURCE,
        )
        if enroll_match:
            rec.bar_enrollment_number = enroll_match.group(1).strip()
            rec.lawyer_verified = True
            rec.bar_council_state = state[:3].upper()
        records.append(rec)

    if not records:
        for a in sp.select('a[href*="/profile/"], a[href*="/advocate/"], a[href*="/lawyer/"]'):
            name = a.get_text(strip=True)
            if len(name) < 4:
                continue
            href = a.get("href", "")
            profile = href if href.startswith("http") else f"https://www.advocatekhoj.com{href}"
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            records.append(
                ProspectRecord(
                    full_name=name,
                    city=city.title() if city else None,
                    state=state,
                    country="IN",
                    profile_url=profile,
                    source=SOURCE,
                )
            )
    return records


async def scrape_advocatekhoj(
    data_dir: Path,
    limit: int = 15000,
    cities: Sequence[str] | None = None,
) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession() as session:
        for state, url in STATE_PAGES:
            if len(all_records) >= limit:
                break
            html = await fetch_html(session, limiter, url, allow_robots=False)
            if html:
                for rec in _parse_listing_page(html, state):
                    if rec.dedupe_key not in seen:
                        seen.add(rec.dedupe_key)
                        all_records.append(rec)

            sp = soup(html) if html else None
            if sp:
                for a in sp.select('a[href*="/locate/lawyers/"]'):
                    href = a.get("href", "")
                    city_name = a.get_text(strip=True)
                    if len(city_name) < 3 or city_name.lower() == state.lower():
                        continue
                    city_url = href if href.startswith("http") else f"https://www.advocatekhoj.com{href}"
                    city_html = await fetch_html(session, limiter, city_url, allow_robots=False)
                    if city_html:
                        slug = city_name.lower().replace(" ", "-")
                        for rec in _parse_listing_page(city_html, state, slug):
                            if rec.dedupe_key not in seen:
                                seen.add(rec.dedupe_key)
                                all_records.append(rec)
                    if len(all_records) >= limit:
                        break
                    await asyncio.sleep(0.3)

        city_list = list(cities or INDIAN_CITIES[:60])
        for city in city_list:
            if len(all_records) >= limit:
                break
            url = f"https://www.advocatekhoj.com/locate/lawyers/{city.replace('-', ' ').title()}/"
            html = await fetch_html(session, limiter, url, allow_robots=False)
            if html:
                for rec in _parse_listing_page(html, "", city):
                    if rec.dedupe_key not in seen:
                        seen.add(rec.dedupe_key)
                        all_records.append(rec)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
