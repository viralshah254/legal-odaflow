"""Scrape IFLR1000 India jurisdiction rankings (banking, capital markets, M&A)."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import aiohttp

from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "iflr1000"
BASE = "https://www.iflr1000.com"

# IFLR1000 jurisdiction / practice URLs for India
INDIA_URLS = [
    f"{BASE}/jurisdiction/india",
    f"{BASE}/jurisdiction/india/financial-and-corporate",
    f"{BASE}/jurisdiction/india/capital-markets",
    f"{BASE}/jurisdiction/india/banking",
    f"{BASE}/jurisdiction/india/m-and-a",
]


def _parse_iflr(html: str, practice: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()

    for a in sp.select("a[href]"):
        href = a.get("href") or ""
        text = re.sub(r"\s+", " ", a.get_text(strip=True))
        if len(text) < 3:
            continue
        if not any(x in href for x in ("/firm/", "/lawyer/", "/jurisdiction/", "/guide/")):
            continue
        profile = urljoin(BASE, href)
        is_lawyer = "/lawyer/" in href or "/partner/" in href
        key = profile.lower()
        if key in seen:
            continue
        seen.add(key)
        tag = f"IFLR1000 | {practice}"
        if is_lawyer:
            records.append(
                ProspectRecord(
                    full_name=text,
                    practice_areas=tag,
                    country="IN",
                    profile_url=profile,
                    source=f"{SOURCE}_lawyer",
                )
            )
        else:
            records.append(
                ProspectRecord(
                    full_name=text,
                    organisation=text,
                    practice_areas=tag,
                    country="IN",
                    profile_url=profile,
                    source=f"{SOURCE}_firm",
                )
            )
    return records


async def scrape_iflr1000_india(data_dir: Path, limit: int = 1200) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        for url in INDIA_URLS:
            if len(all_records) >= limit:
                break
            practice = url.rstrip("/").split("/")[-1].replace("-", " ").title()
            html = await fetch_html(session, limiter, url, allow_robots=False)
            if not html:
                continue
            for rec in _parse_iflr(html, practice):
                k = (rec.profile_url or rec.full_name).lower()
                if k not in seen:
                    seen.add(k)
                    all_records.append(rec)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
