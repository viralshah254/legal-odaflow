"""Scrape lawyers.justia.com by US state."""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

import aiohttp

from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "justia"
BASE = "https://lawyers.justia.com"

US_STATES = [
    "california", "new-york", "texas", "florida", "illinois", "pennsylvania",
    "ohio", "georgia", "north-carolina", "michigan", "new-jersey", "virginia",
    "washington", "arizona", "massachusetts", "tennessee", "indiana", "missouri",
    "maryland", "wisconsin", "colorado", "minnesota", "south-carolina", "alabama",
]


def _parse_listing(html: str, state_slug: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    s = soup(html)
    state_name = state_slug.replace("-", " ").title()
    seen: set[str] = set()

    def add(name: str, href: str, org: str | None = None, city: str | None = None, **kw):
        name = re.sub(r"\s+", " ", name).strip()
        if len(name) < 4 or len(name) > 120:
            return
        if name.lower() in ("view profile", "read more", "lawyers", "attorneys"):
            return
        profile_url = href if href.startswith("http") else f"{BASE}{href}"
        if profile_url in seen:
            return
        seen.add(profile_url)
        records.append(
            ProspectRecord(
                full_name=name,
                organisation=org,
                city=city,
                state=state_name,
                country="US",
                profile_url=profile_url,
                source=SOURCE,
                **kw,
            )
        )

    for card in s.select(
        "div.lawyer-card, li.lawyer-listing, article, .listing-item, .result-item"
    ):
        name_el = card.select_one(
            "a.lawyer-name, h2 a, h3 a, .name a, a[href*='/lawyer/']"
        )
        if not name_el:
            continue
        org_el = card.select_one(".law-firm, .firm-name, .organization")
        city_el = card.select_one(".location, .city, .address")
        city = city_el.get_text(strip=True).split(",")[0] if city_el else None
        phone_el = card.select_one('a[href^="tel:"]')
        phone = phone_el.get("href", "").replace("tel:", "") if phone_el else None
        email_el = card.select_one('a[href^="mailto:"]')
        email = email_el.get("href", "").replace("mailto:", "").split("?")[0] if email_el else None
        add(
            name_el.get_text(strip=True),
            name_el.get("href", ""),
            org=org_el.get_text(strip=True) if org_el else None,
            city=city,
            phone=phone,
            email=email,
            email_confidence="scraped" if email else None,
        )

    for a in s.select('a[href*="/lawyer/"]'):
        href = a.get("href", "")
        if "/lawyer/" not in href or href.count("/") < 3:
            continue
        add(a.get_text(strip=True), href)

    return records


async def scrape_justia(
    data_dir: Path,
    limit: int = 3000,
    max_pages_per_state: int = 8,
) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen_urls: set[str] = set()

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        for state in US_STATES:
            if len(all_records) >= limit:
                break
            for page in range(1, max_pages_per_state + 1):
                if len(all_records) >= limit:
                    break
                if page == 1:
                    url = f"{BASE}/lawyer/{state}"
                else:
                    url = f"{BASE}/lawyer/{state}?page={page}"
                html = await fetch_html(session, limiter, url, allow_robots=False)
                if not html:
                    if page == 1:
                        url = f"{BASE}/{state}"
                        html = await fetch_html(session, limiter, url, allow_robots=False)
                    if not html:
                        break
                batch = _parse_listing(html, state)
                for rec in batch:
                    key = rec.profile_url or rec.dedupe_key
                    if key in seen_urls:
                        continue
                    seen_urls.add(key)
                    all_records.append(rec)
                    if len(all_records) >= limit:
                        break
                if not batch and page > 1:
                    break
                await asyncio.sleep(0.4)

    finish_source(data_dir, SOURCE, all_records)
    return all_records[:limit]
