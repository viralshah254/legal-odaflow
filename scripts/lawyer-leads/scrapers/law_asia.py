"""Scrape Law.asia / India Business Law Journal firm directory."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import aiohttp

from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "law_asia"
BASE = "https://www.law.asia"
DIRECTORY = f"{BASE}/directory/"


def _parse_directory(html: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()

    for a in sp.select("a[href]"):
        href = a.get("href") or ""
        text = re.sub(r"\s+", " ", a.get_text(strip=True))
        if len(text) < 4:
            continue
        # Firm profile pages on law.asia
        if not any(x in href for x in ("/law-firms/", "/firm/", "/directory/", "/rankings/")):
            continue
        if href.rstrip("/") in ("/directory", "/directory/"):
            continue
        profile = urljoin(BASE, href)
        key = profile.lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(
            ProspectRecord(
                full_name=text,
                organisation=text,
                practice_areas="Law.asia directory",
                country="IN",
                profile_url=profile,
                source=SOURCE,
            )
        )

    # Table/list fallback
    for row in sp.select("tr, li, article, [class*='firm']"):
        name_el = row.select_one("h2, h3, h4, a, strong")
        if not name_el:
            continue
        name = re.sub(r"\s+", " ", name_el.get_text(strip=True))
        if len(name) < 4 or name.lower() in ("law firms", "directory"):
            continue
        link = row.select_one("a[href]")
        profile = urljoin(BASE, link["href"]) if link else None
        key = (profile or name).lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(
            ProspectRecord(
                full_name=name,
                organisation=name,
                practice_areas="Law.asia directory",
                country="IN",
                profile_url=profile,
                source=SOURCE,
            )
        )
    return records


async def scrape_law_asia(data_dir: Path, limit: int = 1500) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        # Paginate directory (common pattern: /directory/page/N/)
        for page in range(1, 40):
            if len(all_records) >= limit:
                break
            url = DIRECTORY if page == 1 else f"{DIRECTORY}page/{page}/"
            html = await fetch_html(session, limiter, url, allow_robots=False)
            if not html:
                break
            batch = _parse_directory(html)
            if not batch:
                break
            for rec in batch:
                k = rec.full_name.lower()
                if k not in seen:
                    seen.add(k)
                    all_records.append(rec)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
