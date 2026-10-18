"""OpenStreetMap Overpass — lawyer offices (free, reliable bulk source)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import aiohttp

from enrichment.phone_normalize import normalize_india_phones
from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS
from scrapers.osm_regions import ALL_US_IN_REGIONS, INDIA_REGIONS, US_REGIONS
from utils.checkpoint import append_record, is_complete, load_records, mark_complete

SOURCE = "osm"
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
PER_TILE_LIMIT = 500
REQUEST_DELAY_SEC = 1.5


def _subdivide_bbox(
    south: float,
    west: float,
    north: float,
    east: float,
    rows: int,
    cols: int,
) -> list[tuple[float, float, float, float]]:
    if rows <= 1 and cols <= 1:
        return [(south, west, north, east)]
    tiles: list[tuple[float, float, float, float]] = []
    lat_step = (north - south) / rows
    lon_step = (east - west) / cols
    for r in range(rows):
        for c in range(cols):
            s = south + r * lat_step
            n = south + (r + 1) * lat_step
            w = west + c * lon_step
            e = west + (c + 1) * lon_step
            tiles.append((s, w, n, e))
    return tiles


def _build_query(south: float, west: float, north: float, east: float) -> str:
    bbox = f"{south},{west},{north},{east}"
    return f"""
[out:json][timeout:120];
(
  node["office"="lawyer"]({bbox});
  way["office"="lawyer"]({bbox});
  node["office"="legal"]({bbox});
  way["office"="legal"]({bbox});
  node["amenity"="lawyer"]({bbox});
  way["amenity"="lawyer"]({bbox});
);
out center {PER_TILE_LIMIT};
"""


def _parse_elements(
    data: dict,
    city: str,
    state: str | None,
    country: str,
) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name") or tags.get("operator")
        if not name or len(name) < 2:
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        raw_phone = (
            tags.get("phone")
            or tags.get("contact:phone")
            or tags.get("contact:mobile")
            or tags.get("mobile")
        )
        raw_whatsapp = tags.get("contact:whatsapp") or tags.get("whatsapp")
        email = tags.get("email") or tags.get("contact:email")
        website = tags.get("website") or tags.get("contact:website")
        org = tags.get("operator") if tags.get("operator") != name else None
        profile = None
        if lat and lon:
            profile = (
                f"https://www.openstreetmap.org/{el.get('type', 'node')}/{el.get('id')}"
            )

        # For India: normalize to +91, split primary/alternate
        alternate_phone: str | None = None
        if country == "IN":
            combined = "/".join(filter(None, [raw_phone, raw_whatsapp]))
            primary, alternate_phone = normalize_india_phones(combined or None)
            phone = primary
        else:
            phone = raw_phone

        records.append(
            ProspectRecord(
                full_name=name,
                organisation=org,
                practice_areas=tags.get("description"),
                city=city,
                state=state,
                country=country,
                phone=phone,
                alternate_phone=alternate_phone,
                email=email,
                email_confidence="scraped" if email else None,
                website=website,
                profile_url=profile,
                source=SOURCE,
            )
        )
    return records


def _region_list(geography: str | None) -> list:
    if geography == "us":
        return US_REGIONS
    if geography == "in":
        return INDIA_REGIONS
    return ALL_US_IN_REGIONS


async def _fetch_tile(
    session: aiohttp.ClientSession,
    query: str,
    url_idx: int,
) -> dict | None:
    for attempt in range(len(OVERPASS_URLS)):
        url = OVERPASS_URLS[(url_idx + attempt) % len(OVERPASS_URLS)]
        try:
            async with session.post(
                url,
                data={"data": query},
                timeout=aiohttp.ClientTimeout(total=150),
            ) as resp:
                if resp.status == 429:
                    await asyncio.sleep(10)
                    continue
                if resp.status != 200:
                    continue
                raw = await resp.text()
                return json.loads(raw)
        except Exception:
            continue
    return None


async def scrape_osm(
    data_dir: Path,
    limit: int = 10000,
    geography: str | None = None,
) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    regions = _region_list(geography)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()
    tiles_total = sum(r[7] * r[8] for r in regions)
    tile_num = 0

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        for city, state, country, south, west, north, east, grid_r, grid_c in regions:
            if len(all_records) >= limit:
                break
            tiles = _subdivide_bbox(south, west, north, east, grid_r, grid_c)
            region_count = 0
            for tile in tiles:
                if len(all_records) >= limit:
                    break
                tile_num += 1
                query = _build_query(*tile)
                data = await _fetch_tile(session, query, tile_num)
                if not data:
                    await asyncio.sleep(REQUEST_DELAY_SEC)
                    continue
                batch = _parse_elements(data, city, state, country)
                for rec in batch:
                    key = rec.dedupe_key
                    if key in seen:
                        continue
                    seen.add(key)
                    all_records.append(rec)
                    region_count += 1
                    append_record(data_dir, SOURCE, rec.to_csv_row())
                    if len(all_records) >= limit:
                        break
                await asyncio.sleep(REQUEST_DELAY_SEC)

            print(
                f"[osm] {city}, {state or country}: +{region_count} "
                f"(total {len(all_records)}, tile {tile_num}/{tiles_total})",
                file=sys.stderr,
            )

    if all_records:
        mark_complete(data_dir, SOURCE)
    return all_records[:limit]
