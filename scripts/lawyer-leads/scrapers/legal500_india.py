"""Scrape Legal 500 Asia Pacific India firm listings (public tier rankings)."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import aiohttp

from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "legal500"
BASE = "https://www.legal500.com"

INDIA_SEED_URLS = [
    f"{BASE}/c/india/",
    f"{BASE}/c/india/city-focus-bengaluru/leading-firms/",
    f"{BASE}/c/india/city-focus-mumbai/leading-firms/",
    f"{BASE}/c/india/city-focus-new-delhi/leading-firms/",
    f"{BASE}/c/india/city-focus-hyderabad/leading-firms/",
    f"{BASE}/c/india/city-focus-chennai/leading-firms/",
]

_FIRM_LINK = re.compile(r"/firms/\d+-[^/]+")


def _parse_legal500(html: str, city_hint: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()

    for a in sp.select("a[href]"):
        href = a.get("href") or ""
        if not _FIRM_LINK.search(href):
            continue
        name = re.sub(r"\s+", " ", a.get_text(strip=True))
        if len(name) < 3:
            continue
        profile = urljoin(BASE, href.split("?")[0])
        key = profile.lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(
            ProspectRecord(
                full_name=name,
                organisation=name,
                practice_areas="Legal 500 Asia Pacific | India",
                city=city_hint or None,
                country="IN",
                profile_url=profile,
                source=SOURCE,
            )
        )

    for h in sp.select("h2, h3, h4"):
        name = re.sub(r"\s+", " ", h.get_text(strip=True))
        if len(name) < 4 or name.lower().startswith("tier"):
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(
            ProspectRecord(
                full_name=name,
                organisation=name,
                practice_areas="Legal 500 leading firms | India",
                city=city_hint or None,
                country="IN",
                source=SOURCE,
            )
        )
    return records


async def scrape_legal500_india(data_dir: Path, limit: int = 2000) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        for url in INDIA_SEED_URLS:
            if len(all_records) >= limit:
                break
            city = "India"
            if "bengaluru" in url:
                city = "Bengaluru"
            elif "mumbai" in url:
                city = "Mumbai"
            elif "delhi" in url:
                city = "Delhi"
            elif "hyderabad" in url:
                city = "Hyderabad"
            elif "chennai" in url:
                city = "Chennai"
            html = await fetch_html(session, limiter, url, allow_robots=False)
            if not html:
                continue
            for rec in _parse_legal500(html, city):
                k = rec.full_name.lower()
                if k not in seen:
                    seen.add(k)
                    all_records.append(rec)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
