"""Scrape Indian lawyer directories: LawRato, VakilSearch (pagination + profile deep-scrape)."""

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

SOURCE = "india_dirs"

PAGES_PER_CITY = 30
PROFILE_DEEP_SCRAPE_LIMIT = 5000

_PHONE_TEXT = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}")


def _extract_phones(el) -> tuple[str | None, str | None]:
    raw_phones: list[str] = []
    for a in el.select('a[href^="tel:"]'):
        num = a.get("href", "").replace("tel:", "").strip()
        if num:
            raw_phones.append(num)
    for a in el.select('a[href*="wa.me"], a[href*="whatsapp"]'):
        href = a.get("href", "")
        digits_match = "".join(c for c in href if c.isdigit())
        if digits_match:
            raw_phones.append(digits_match)
    text = el.get_text(" ", strip=True)
    for m in _PHONE_TEXT.findall(text.replace(" ", "")):
        raw_phones.append(m)
    combined = " / ".join(raw_phones) if raw_phones else None
    return normalize_india_phones(combined)


def _extract_phones_from_html(html: str) -> tuple[str | None, str | None]:
    sp = soup(html)
    return _extract_phones(sp.body or sp)


def _parse_lawrato(html: str, city: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    s = soup(html)
    for card in s.select(
        ".lawyer-card, .lawyer-list-item, article.lawyer, .profile-card, "
        ".advocate-card, .attorney-card, [class*=lawyer], [class*=advocate]"
    ):
        name_el = card.select_one("h2 a, h3 a, h4 a, .lawyer-name, .advocate-name, a.name")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if len(name) < 3:
            continue
        href = name_el.get("href", "")
        profile = href if href.startswith("http") else f"https://lawrato.com{href}"
        spec_el = card.select_one(".specialization, .practice-area, .expertise, .tags")
        practice = spec_el.get_text(strip=True) if spec_el else None
        primary, alternate = _extract_phones(card)
        email_el = card.select_one('a[href^="mailto:"]')
        email = email_el.get("href", "").replace("mailto:", "").split("?")[0] if email_el else None
        records.append(
            ProspectRecord(
                full_name=name,
                practice_areas=practice,
                city=city.title(),
                country="IN",
                phone=primary,
                alternate_phone=alternate,
                email=email,
                email_confidence="scraped" if email else None,
                profile_url=profile,
                source="lawrato",
            )
        )
    if not records:
        for a in s.select('a[href*="/lawyers/"], a[href*="/advocate/"]'):
            name = a.get_text(strip=True)
            if len(name) < 4:
                continue
            href = a.get("href", "")
            profile = href if href.startswith("http") else f"https://lawrato.com{href}"
            records.append(
                ProspectRecord(
                    full_name=name,
                    city=city.title(),
                    country="IN",
                    profile_url=profile,
                    source="lawrato",
                )
            )
    return records


def _parse_vakilsearch(html: str, city: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    s = soup(html)
    for card in s.select(
        ".lawyer-profile, .expert-card, .listing-item, "
        ".lawyer-card, [class*=profile-card], [class*=lawyer]"
    ):
        name_el = card.select_one("h2, h3, h4, .name, [class*=name]")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if len(name) < 3:
            continue
        spec_el = card.select_one(".practice-area, .specialty, [class*=practice], [class*=special]")
        practice = spec_el.get_text(strip=True) if spec_el else None
        primary, alternate = _extract_phones(card)
        email_el = card.select_one('a[href^="mailto:"]')
        email = email_el.get("href", "").replace("mailto:", "").split("?")[0] if email_el else None
        href_el = card.select_one("a[href]")
        profile = None
        if href_el:
            h = href_el.get("href", "")
            profile = h if h.startswith("http") else f"https://vakilsearch.com{h}"
        records.append(
            ProspectRecord(
                full_name=name,
                practice_areas=practice,
                city=city.title(),
                country="IN",
                phone=primary,
                alternate_phone=alternate,
                email=email,
                email_confidence="scraped" if email else None,
                profile_url=profile,
                source="vakilsearch",
            )
        )
    return records


async def _deep_scrape_profiles(
    session: aiohttp.ClientSession,
    limiter: RateLimiter,
    records: list[ProspectRecord],
    max_profiles: int = PROFILE_DEEP_SCRAPE_LIMIT,
) -> None:
    targets = [r for r in records if r.profile_url and not r.phone][:max_profiles]
    if not targets:
        return
    print(f"[india_dirs] deep-scraping {len(targets)} profiles for phones...")
    for rec in targets:
        html = await fetch_html(session, limiter, rec.profile_url, allow_robots=False)
        if not html:
            continue
        primary, alternate = _extract_phones_from_html(html)
        if primary:
            rec.phone = primary
            if alternate and alternate != primary:
                rec.alternate_phone = alternate
        await asyncio.sleep(0.2)


async def scrape_india_dirs(
    data_dir: Path,
    limit: int = 10000,
    cities: Sequence[str] | None = None,
    deep_scrape: bool = True,
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
            for page in range(1, PAGES_PER_CITY + 1):
                if len(all_records) >= limit:
                    break
                lawrato_url = (
                    f"https://www.lawrato.com/lawyers-in-{city}"
                    if page == 1
                    else f"https://www.lawrato.com/lawyers-in-{city}?page={page}"
                )
                html = await fetch_html(session, limiter, lawrato_url, allow_robots=False)
                if html:
                    parsed = _parse_lawrato(html, city)
                    if not parsed:
                        break
                    for rec in parsed:
                        if rec.dedupe_key not in seen:
                            seen.add(rec.dedupe_key)
                            all_records.append(rec)
                await asyncio.sleep(0.3)

            for page in range(1, PAGES_PER_CITY + 1):
                if len(all_records) >= limit:
                    break
                vakil_url = (
                    f"https://vakilsearch.com/lawyers-in-{city}"
                    if page == 1
                    else f"https://vakilsearch.com/lawyers-in-{city}?page={page}"
                )
                html2 = await fetch_html(session, limiter, vakil_url, allow_robots=False)
                if html2:
                    parsed2 = _parse_vakilsearch(html2, city)
                    if not parsed2:
                        break
                    for rec in parsed2:
                        if rec.dedupe_key not in seen:
                            seen.add(rec.dedupe_key)
                            all_records.append(rec)
                await asyncio.sleep(0.3)

        if deep_scrape:
            await _deep_scrape_profiles(session, limiter, all_records)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
