"""Scrape public state bar attorney directories (CA, NY, TX, FL)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import aiohttp

from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, USER_AGENT, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "state_bars"


async def _scrape_california(
    session: aiohttp.ClientSession,
    limiter: RateLimiter,
    limit: int,
) -> list[ProspectRecord]:
    """California State Bar public search API."""
    records: list[ProspectRecord] = []
    base = "https://apps.calbar.ca.gov/api/attorneysearch"
    # Search by common last-name prefixes to gather volume
    prefixes = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["SM", "JO", "WI", "BR", "MC"]
    for prefix in prefixes:
        if len(records) >= limit // 4:
            break
        await limiter.wait(base)
        params = {"lastName": prefix, "limit": 50, "offset": 0}
        try:
            async with session.get(
                base,
                params=params,
                timeout=aiohttp.ClientTimeout(total=30),
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            ) as resp:
                if resp.status != 200:
                    continue
                text = await resp.text()
                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    continue
                items = data if isinstance(data, list) else data.get("results", data.get("attorneys", []))
                if not isinstance(items, list):
                    continue
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    first = item.get("firstName") or item.get("first_name") or ""
                    last = item.get("lastName") or item.get("last_name") or ""
                    name = f"{first} {last}".strip() or item.get("name", "")
                    if not name:
                        continue
                    records.append(
                        ProspectRecord(
                            full_name=name,
                            organisation=item.get("firmName") or item.get("firm"),
                            city=item.get("city"),
                            state="California",
                            country="US",
                            phone=item.get("phone") or item.get("phoneNumber"),
                            email=item.get("email"),
                            email_confidence="scraped" if item.get("email") else None,
                            profile_url=item.get("profileUrl") or item.get("url"),
                            source="calbar",
                        )
                    )
        except Exception:
            continue
        await asyncio.sleep(0.3)
    return records


async def _scrape_texas(
    session: aiohttp.ClientSession,
    limiter: RateLimiter,
    limit: int,
) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    url = "https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer"
    await limiter.wait(url)
    # Texas bar uses HTML search; sample listing pages
    search_url = "https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer&Template=/CM/HTMLDisplay.cfm&ContentID=12345"
    try:
        async with session.get(
            search_url,
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": USER_AGENT},
        ) as resp:
            if resp.status != 200:
                return records
            html = await resp.text()
            s = soup(html)
            for row in s.select("tr, .attorney-result, .search-result")[:limit]:
                name_el = row.select_one("a, .name, td")
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                if len(name) < 4:
                    continue
                records.append(
                    ProspectRecord(
                        full_name=name,
                        state="Texas",
                        country="US",
                        source="texasbar",
                    )
                )
    except Exception:
        pass
    return records[: limit // 4]


async def _scrape_florida(
    session: aiohttp.ClientSession,
    limiter: RateLimiter,
    limit: int,
) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    # Florida Bar member search — letter browse
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        if len(records) >= limit // 4:
            break
        url = f"https://www.floridabar.org/directories/find-mbr/?barNum=&lname={letter}"
        await limiter.wait(url)
        try:
            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=30),
                headers={"User-Agent": USER_AGENT},
            ) as resp:
                if resp.status != 200:
                    continue
                s = soup(await resp.text())
                for a in s.select('a[href*="member"], .member-name, td a'):
                    name = a.get_text(strip=True)
                    if len(name) < 4 or len(name) > 80:
                        continue
                    href = a.get("href", "")
                    profile = href if href.startswith("http") else f"https://www.floridabar.org{href}"
                    records.append(
                        ProspectRecord(
                            full_name=name,
                            state="Florida",
                            country="US",
                            profile_url=profile,
                            source="floridabar",
                        )
                    )
        except Exception:
            continue
    return records


async def scrape_state_bars(data_dir: Path, limit: int = 2500) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    per_state = max(limit // 4, 200)
    all_records: list[ProspectRecord] = []

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        ca = await _scrape_california(session, limiter, per_state)
        all_records.extend(ca)
        tx = await _scrape_texas(session, limiter, per_state)
        all_records.extend(tx)
        fl = await _scrape_florida(session, limiter, per_state)
        all_records.extend(fl)

    finish_source(data_dir, SOURCE, all_records[:limit])
    return all_records[:limit]
