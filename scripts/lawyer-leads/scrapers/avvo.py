"""Scrape avvo.com lawyer listings via Playwright (async API)."""

from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path

from models import ProspectRecord
from scrapers.base import finish_source
from utils.checkpoint import is_complete, load_records

SOURCE = "avvo"

PRACTICE_SLUGS = [
    "business", "family", "criminal-defense", "estate-planning",
    "personal-injury", "immigration", "real-estate", "bankruptcy",
]

CITIES = [
    ("New York", "NY"), ("Los Angeles", "CA"), ("Chicago", "IL"),
    ("Houston", "TX"), ("Phoenix", "AZ"), ("Philadelphia", "PA"),
    ("San Antonio", "TX"), ("San Diego", "CA"), ("Dallas", "TX"),
    ("San Jose", "CA"),
]


async def _parse_avvo_page(page) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    seen: set[str] = set()

    cards = await page.query_selector_all(
        '[data-testid="lawyer-card"], .search-result, .lawyer-search-result, '
        "article, .organic-result, li"
    )
    for card in cards:
        try:
            name_el = await card.query_selector(
                "a.profile-link, h3 a, h2 a, .name a, a[href*='/attorneys/']"
            )
            if not name_el:
                continue
            name = (await name_el.inner_text()).strip()
            href = await name_el.get_attribute("href") or ""
            if len(name) < 4:
                continue
            profile = href if href.startswith("http") else f"https://www.avvo.com{href}"
            if profile in seen:
                continue
            seen.add(profile)
            firm_el = await card.query_selector(".firm, .organization, .law-firm-name")
            org = (await firm_el.inner_text()).strip() if firm_el else None
            loc_el = await card.query_selector(".location, .address, .city-state")
            city = None
            if loc_el:
                loc = (await loc_el.inner_text()).strip()
                city = loc.split(",")[0].strip() if loc else None
            records.append(
                ProspectRecord(
                    full_name=name,
                    organisation=org,
                    city=city,
                    country="US",
                    profile_url=profile,
                    source=SOURCE,
                )
            )
        except Exception:
            continue

    if not records:
        links = await page.query_selector_all('a[href*="/attorneys/"]')
        for link in links[:80]:
            try:
                name = (await link.inner_text()).strip()
                href = await link.get_attribute("href") or ""
                if len(name) < 4 or not re.search(r"[A-Za-z]{2,}", name):
                    continue
                profile = href if href.startswith("http") else f"https://www.avvo.com{href}"
                if profile in seen:
                    continue
                seen.add(profile)
                records.append(
                    ProspectRecord(
                        full_name=name,
                        country="US",
                        profile_url=profile,
                        source=SOURCE,
                    )
                )
            except Exception:
                continue
    return records


async def scrape_avvo(data_dir: Path, limit: int = 2000) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return []

    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with async_playwright() as p:
        launch_opts: dict = {"headless": True}
        if proxy:
            launch_opts["proxy"] = {"server": proxy}
        browser = await p.chromium.launch(**launch_opts)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = await context.new_page()

        for practice in PRACTICE_SLUGS:
            if len(all_records) >= limit:
                break
            for city, state in CITIES:
                if len(all_records) >= limit:
                    break
                city_slug = city.lower().replace(" ", "-")
                url = (
                    f"https://www.avvo.com/{practice}-lawyer/"
                    f"{city_slug}-{state.lower()}.html"
                )
                try:
                    await page.goto(url, wait_until="networkidle", timeout=60000)
                    await page.wait_for_timeout(2000)
                    batch = await _parse_avvo_page(page)
                    for rec in batch:
                        key = rec.profile_url or rec.dedupe_key
                        if key in seen:
                            continue
                        seen.add(key)
                        rec.state = state
                        rec.city = city
                        rec.practice_areas = practice.replace("-", " ")
                        all_records.append(rec)
                        if len(all_records) >= limit:
                            break
                except Exception:
                    continue
                await asyncio.sleep(2)

        await browser.close()

    finish_source(data_dir, SOURCE, all_records)
    return all_records[:limit]
