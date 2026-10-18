"""Base scraper helpers."""

from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import aiohttp
from bs4 import BeautifulSoup

from models import ProspectRecord
from utils.checkpoint import append_record, mark_complete
from utils.rate_limiter import RateLimiter
from utils.robots import allowed

# Browser-like UA — many directories block obvious bots
USER_AGENT = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
)

DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


async def fetch_html(
    session: aiohttp.ClientSession,
    limiter: RateLimiter,
    url: str,
    *,
    allow_robots: bool | None = None,
) -> str | None:
    ignore_robots = os.environ.get("SCRAPER_IGNORE_ROBOTS", "").lower() in (
        "1",
        "true",
        "yes",
    )
    if allow_robots is None:
        allow_robots = not ignore_robots
    if allow_robots and not await allowed(url, USER_AGENT):
        return None
    await limiter.wait(url)
    try:
        async with session.get(
            url,
            timeout=aiohttp.ClientTimeout(total=45),
            headers=DEFAULT_HEADERS,
        ) as resp:
            if resp.status != 200:
                return None
            return await resp.text()
    except Exception:
        return None


def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def persist_batch(
    data_dir: Path,
    source: str,
    records: list[ProspectRecord] | list[dict],
) -> None:
    for rec in records:
        row = rec.to_csv_row() if hasattr(rec, "to_csv_row") else rec
        append_record(data_dir, source, row)
    if records:
        mark_complete(data_dir, source)


def finish_source(
    data_dir: Path, source: str, records: list[ProspectRecord] | list[dict]
) -> None:
    """Persist and mark complete only when we have data."""
    if records:
        persist_batch(data_dir, source, records)
