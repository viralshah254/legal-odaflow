"""Scrape Sulekha lawyer/advocate listings across Indian cities."""

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

SOURCE = "sulekha"

LEGAL_KEYWORDS = re.compile(
    r"\b(lawyer|advocate|attorney|legal|law\s*firm|vakil)\b",
    re.I,
)

_PAGES_PER_CITY = 5


def _is_legal_listing(name: str, category: str | None = None) -> bool:
    return bool(LEGAL_KEYWORDS.search(f"{name} {category or ''}"))


def _extract_phone(el) -> str | None:
    raw: list[str] = []
    for a in el.select('a[href^="tel:"], .phone, .contact, [class*=phone]'):
        if a.name == "a":
            num = a.get("href", "").replace("tel:", "").strip()
            if num:
                raw.append(num)
        else:
            digits = re.findall(r"[6-9]\d{9}", a.get_text(" ", strip=True).replace(" ", ""))
            raw.extend(digits)
    combined = " / ".join(raw) if raw else None
    primary, _ = normalize_india_phones(combined)
    return primary


def _parse_sulekha(html: str, city: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()

    for card in sp.select(
        ".listing-card, .provider-card, .business-listing, "
        "[class*=listing], [class*=provider], li[class*=item]"
    ):
        name_el = card.select_one("h2, h3, h4, .title, .name, a[title]")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if len(name) < 3:
            continue
        cat_el = card.select_one(".category, .service, .tag")
        category = cat_el.get_text(strip=True) if cat_el else "Legal Services"
        if not _is_legal_listing(name, category):
            continue
        phone = _extract_phone(card)
        href_el = card.select_one("a[href]")
        profile = None
        if href_el:
            h = href_el.get("href", "")
            profile = h if h.startswith("http") else f"https://www.sulekha.com{h}"
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(
            ProspectRecord(
                full_name=name,
                practice_areas=category,
                city=city.replace("-", " ").title(),
                country="IN",
                phone=phone,
                profile_url=profile,
                source=SOURCE,
            )
        )
    return records


async def scrape_sulekha_india(
    data_dir: Path,
    limit: int = 20000,
    cities: Sequence[str] | None = None,
) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    city_list = [c.lower() for c in cities] if cities else INDIAN_CITIES
    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession() as session:
        for city in city_list:
            if len(all_records) >= limit:
                break
            for page in range(1, _PAGES_PER_CITY + 1):
                if len(all_records) >= limit:
                    break
                slug = city.replace(" ", "-")
                url = (
                    f"https://www.sulekha.com/lawyers/{slug}"
                    if page == 1
                    else f"https://www.sulekha.com/lawyers/{slug}?page={page}"
                )
                html = await fetch_html(session, limiter, url, allow_robots=False)
                if not html:
                    break
                parsed = _parse_sulekha(html, city)
                if not parsed:
                    break
                for rec in parsed:
                    if rec.dedupe_key not in seen:
                        seen.add(rec.dedupe_key)
                        all_records.append(rec)
                await asyncio.sleep(0.4)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
