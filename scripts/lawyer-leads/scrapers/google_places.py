"""Google Places API — law firms in major Indian cities (CLI fallback)."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import aiohttp

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from models import ProspectRecord
from scrapers.base import finish_source
from utils.checkpoint import is_complete, load_records

SOURCE = "google_places"

IN_CITIES: dict[str, tuple[float, float, str]] = {
    "Mumbai": (19.0760, 72.8777, "Maharashtra"),
    "Delhi": (28.7041, 77.1025, "Delhi"),
    "Bangalore": (12.9716, 77.5946, "Karnataka"),
    "Hyderabad": (17.3850, 78.4867, "Telangana"),
    "Chennai": (13.0827, 80.2707, "Tamil Nadu"),
    "Kolkata": (22.5726, 88.3639, "West Bengal"),
    "Pune": (18.5204, 73.8567, "Maharashtra"),
    "Ahmedabad": (23.0225, 72.5714, "Gujarat"),
    "Jaipur": (26.9124, 75.7873, "Rajasthan"),
    "Lucknow": (26.8467, 80.9462, "Uttar Pradesh"),
}

TEXT_QUERIES = [
    "law firm in {city}",
    "lawyer in {city}",
    "advocate in {city}",
    "legal services {city}",
]

GRID_OFFSETS = [-0.05, 0, 0.05]
NEARBY_RADIUS_M = 5000
PAGE_TOKEN_DELAY_S = 2.1
REQUEST_DELAY_S = 0.2
DETAILS_FIELDS = (
    "place_id,name,formatted_phone_number,international_phone_number,"
    "website,formatted_address,url"
)


def _resolve_city(name: str) -> tuple[str, float, float, str] | None:
    trimmed = name.strip()
    if not trimmed:
        return None
    if trimmed in IN_CITIES:
        lat, lng, state = IN_CITIES[trimmed]
        return trimmed, lat, lng, state
    lower = trimmed.lower()
    for city, coords in IN_CITIES.items():
        if city.lower() == lower:
            lat, lng, state = coords
            return city, lat, lng, state
    return None


async def _paginated_search(
    session: aiohttp.ClientSession,
    url: str,
    params: dict[str, str],
) -> list[str]:
    place_ids: list[str] = []
    page_token: str | None = None

    while True:
        req_params = dict(params)
        if page_token:
            req_params["pagetoken"] = page_token
        async with session.get(url, params=req_params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200:
                break
            data = await resp.json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            break
        for place in data.get("results", []):
            pid = place.get("place_id")
            if pid:
                place_ids.append(pid)
        page_token = data.get("next_page_token")
        if not page_token:
            break
        await asyncio.sleep(PAGE_TOKEN_DELAY_S)

    return place_ids


async def _collect_place_ids(
    session: aiohttp.ClientSession,
    api_key: str,
    city: str,
    lat: float,
    lng: float,
) -> set[str]:
    place_ids: set[str] = set()

    for template in TEXT_QUERIES:
        query = template.format(city=city)
        ids = await _paginated_search(
            session,
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            {"query": query, "key": api_key},
        )
        place_ids.update(ids)
        await asyncio.sleep(REQUEST_DELAY_S)

    for d_lat in GRID_OFFSETS:
        for d_lng in GRID_OFFSETS:
            ids = await _paginated_search(
                session,
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                {
                    "location": f"{lat + d_lat},{lng + d_lng}",
                    "radius": str(NEARBY_RADIUS_M),
                    "type": "lawyer",
                    "key": api_key,
                },
            )
            place_ids.update(ids)
            await asyncio.sleep(REQUEST_DELAY_S)

    return place_ids


async def _fetch_details(
    session: aiohttp.ClientSession,
    api_key: str,
    place_id: str,
) -> dict | None:
    params = {
        "place_id": place_id,
        "fields": DETAILS_FIELDS,
        "key": api_key,
    }
    async with session.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        params=params,
        timeout=aiohttp.ClientTimeout(total=30),
    ) as resp:
        if resp.status != 200:
            return None
        data = await resp.json()
    if data.get("status") != "OK":
        return None
    return data.get("result")


async def scrape_google_places(
    data_dir: Path,
    limit: int = 1000,
    city: str | None = None,
) -> list[ProspectRecord]:
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        return []

    checkpoint_key = f"{SOURCE}_{city.lower()}" if city else SOURCE
    if is_complete(data_dir, checkpoint_key):
        rows = load_records(data_dir, checkpoint_key)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    cities: list[tuple[str, float, float, str]] = []
    if city:
        resolved = _resolve_city(city)
        if not resolved:
            return []
        cities.append(resolved)
    else:
        for name, (lat, lng, state) in IN_CITIES.items():
            cities.append((name, lat, lng, state))

    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession() as session:
        for city_name, lat, lng, state in cities:
            if len(all_records) >= limit:
                break
            place_ids = await _collect_place_ids(session, api_key, city_name, lat, lng)
            for place_id in place_ids:
                if len(all_records) >= limit:
                    break
                details = await _fetch_details(session, api_key, place_id)
                if not details:
                    continue
                name = details.get("name", "")
                if not name:
                    continue
                phone = details.get("international_phone_number") or details.get(
                    "formatted_phone_number"
                )
                website = details.get("website")
                profile = details.get("url") or (
                    f"https://www.google.com/maps/place/?q=place_id:{place_id}"
                )
                rec = ProspectRecord(
                    full_name=name,
                    organisation=name,
                    city=city_name,
                    state=state,
                    country="IN",
                    phone=phone,
                    website=website,
                    profile_url=profile,
                    source=SOURCE,
                )
                if rec.dedupe_key not in seen:
                    seen.add(rec.dedupe_key)
                    all_records.append(rec)
                await asyncio.sleep(REQUEST_DELAY_S)

    finish_source(data_dir, checkpoint_key, all_records[:limit])
    return all_records[:limit]
