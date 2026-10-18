"""Scrape Vakeel Khoj All India Lawyers directory."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import aiohttp

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from enrichment.phone_normalize import normalize_india_phones
from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "vakeelkhoj_india"
LIST_URL = "https://vakeelkhoj.com/all-india-lawyers"

_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
_WEBSITE = re.compile(r"Website\s*[:-]\s*(\S+)", re.I)
_NAME = re.compile(r"NAME\s*[:-]\s*(.+)", re.I)
_LOCATION = re.compile(r"Location\s*[:-]\s*(.+)", re.I)
_SPECIALIZATION = re.compile(
    r"Speciali[sz]ation\s*[:-]\s*(.+?)(?:\n\s*(?:Contact|Email|Website|Advocate|\Z))",
    re.I | re.S,
)
_CONTACT = re.compile(
    r"(?:Contact No\.?|Whatsapp No\.?)\s*[:-]\s*([^\n]+)",
    re.I,
)


def _clean_name(raw: str) -> str:
    name = raw.strip()
    name = re.sub(r"^[-:\s]+", "", name)
    name = re.split(r"\s+Location\s*[:-]", name, maxsplit=1, flags=re.I)[0].strip()
    name = re.sub(r"^ADV(OCATE)?\s*", "", name, flags=re.I).strip()
    name = re.sub(r"\s{2,}", " ", name)
    return name.title() if name.isupper() else name


def _city_from_location(location: str | None) -> tuple[str | None, str | None]:
    if not location:
        return None, None
    loc = location.strip().strip(".")
    loc = re.sub(r"^[-:\s]+", "", loc)
    low = loc.lower()
    if "all over india" in low or low == "india":
        return "India", None
    # First segment before comma
    primary = loc.split(",")[0].strip()
    primary = re.split(r"\s+&\s+", primary, maxsplit=1)[0].strip()
    primary = re.sub(r"\s+and\s+.*$", "", primary, flags=re.I).strip()
    city = primary.title() if primary.isupper() else primary
    state_map = {
        "delhi": "Delhi",
        "delhi ncr": "Delhi",
        "mumbai": "Maharashtra",
        "navi mumbai": "Maharashtra",
        "kolkata": "West Bengal",
        "dehradun": "Uttarakhand",
        "amritsar": "Punjab",
        "chandigarh": "Punjab",
        "bangalore": "Karnataka",
        "chennai": "Tamil Nadu",
        "hyderabad": "Telangana",
    }
    state = state_map.get(city.lower())
    return city, state


def _email_from_block(block: str) -> str | None:
    lines = [ln.strip() for ln in block.splitlines()]
    for i, line in enumerate(lines):
        inline = re.search(r"Email\s*[:-]\s*([\w.+-]+@[\w.-]+)", line, re.I)
        if inline:
            return inline.group(1).lower()
        if re.match(r"Email\s*[:-]\s*$", line, re.I) and i + 1 < len(lines):
            found = _EMAIL.search(lines[i + 1])
            if found:
                return found.group(0).lower()
    found = _EMAIL.search(block)
    return found.group(0).lower() if found else None


def _phones_from_block(block: str) -> tuple[str | None, str | None]:
    found: list[str] = []
    for match in _CONTACT.finditer(block):
        for digits in re.findall(r"[6-9]\d{9}", match.group(1)):
            primary, alternate = normalize_india_phones(digits)
            for num in (primary, alternate):
                if num and num not in found:
                    found.append(num)
    if not found:
        return None, None
    if len(found) == 1:
        return found[0], found[0]
    return found[0], found[1]


def _website_from_block(block: str) -> str | None:
    match = _WEBSITE.search(block)
    if not match:
        return None
    url = match.group(1).strip()
    if url.startswith("www."):
        return f"https://{url}"
    if not url.startswith("http"):
        return f"https://{url}"
    return url


def parse_vakeelkhoj_html(html: str) -> list[ProspectRecord]:
    text = soup(html).get_text("\n")
    blocks = re.split(r"(?=NAME\s*[:.-])", text, flags=re.I)
    records: list[ProspectRecord] = []
    seen: set[str] = set()

    for block in blocks:
        name_match = _NAME.search(block)
        if not name_match:
            continue
        full_name = _clean_name(name_match.group(1))
        if len(full_name) < 4:
            continue

        loc_match = _LOCATION.search(block)
        location = loc_match.group(1).strip() if loc_match else None
        city, state = _city_from_location(location)
        email = _email_from_block(block)
        phone, alternate = _phones_from_block(block)
        if not email and not phone:
            continue

        spec_match = _SPECIALIZATION.search(block)
        practice = (
            re.sub(r"\s+", " ", spec_match.group(1)).strip()[:500]
            if spec_match
            else "Vakeel Khoj All India Lawyers directory"
        )

        key = (full_name + (email or "") + (phone or "")).lower()
        if key in seen:
            continue
        seen.add(key)

        records.append(
            ProspectRecord(
                full_name=full_name,
                organisation="Advocate",
                practice_areas=practice,
                city=city,
                state=state,
                country="IN",
                phone=phone,
                alternate_phone=alternate if alternate != phone else None,
                whatsapp=phone,
                email=email,
                website=_website_from_block(block),
                profile_url=LIST_URL,
                source=SOURCE,
            )
        )
    return records


async def scrape_vakeelkhoj_india(
    data_dir: Path,
    limit: int = 500,
) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        html = await fetch_html(session, limiter, LIST_URL, allow_robots=False)
    if not html:
        raise RuntimeError(f"Could not fetch {LIST_URL}")

    records = parse_vakeelkhoj_html(html)[:limit]
    finish_source(data_dir, SOURCE, records)
    return records
