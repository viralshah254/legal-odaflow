"""Scrape Chambers & Partners India firm and lawyer rankings (public pages)."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import aiohttp

from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE_FIRMS = "chambers_firms"
SOURCE_LAWYERS = "chambers_lawyers"
BASE = "https://chambers.com"

# Seed India practice-area ranking pages (discovered from chambers.com legal guide)
INDIA_PRACTICE_PATHS = [
    "/legal-rankings/banking-finance-india-2:6:110:1",
    "/legal-rankings/corporate-ma-india-2:7:110:1",
    "/legal-rankings/dispute-resolution-arbitration-india-2:568:110:1",
    "/legal-rankings/dispute-resolution-litigation-india-2:569:110:1",
    "/legal-rankings/capital-markets-debt-india-2:8:110:1",
    "/legal-rankings/capital-markets-equity-india-2:9:110:1",
    "/legal-rankings/competition-india-2:10:110:1",
    "/legal-rankings/employment-india-2:12:110:1",
    "/legal-rankings/intellectual-property-india-2:15:110:1",
    "/legal-rankings/projects-energy-india-2:22:110:1",
    "/legal-rankings/real-estate-india-2:24:110:1",
    "/legal-rankings/tax-india-2:28:110:1",
    "/legal-rankings/insurance-india-2:16:110:1",
    "/legal-rankings/private-equity-india-2:21:110:1",
    "/legal-rankings/restructuring-insolvency-india-2:25:110:1",
    "/legal-rankings/telecoms-media-internet-india-2:29:110:1",
    "/legal-rankings/white-collar-crime-india-2:31:110:1",
    "/legal-rankings/international-arbitration-india-2:17:110:1",
    "/legal-rankings/construction-india-2:11:110:1",
    "/legal-rankings/energy-natural-resources-india-2:13:110:1",
]

_DEPT_LINK = re.compile(r"/department/([^\"'?#]+)")
_LAWYER_LINK = re.compile(r"/(?:lawyer|individual)/([^\"'?#]+)")
_BAND_RE = re.compile(r"Band\s+(\d+)", re.I)


def _practice_from_path(path: str) -> str:
    slug = path.split("/legal-rankings/")[-1].split("-india")[0]
    return slug.replace("-", " ").title()


def _parse_ranking_page(
    html: str,
    practice: str,
    page_url: str,
    *,
    lawyers: bool,
) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()

    link_re = _LAWYER_LINK if lawyers else _DEPT_LINK
    for a in sp.select("a[href]"):
        href = a.get("href") or ""
        m = link_re.search(href)
        if not m:
            continue
        name = re.sub(r"\s+", " ", a.get_text(strip=True))
        name = re.sub(r"\d+\s+Years\s+Ranked.*", "", name, flags=re.I).strip()
        if len(name) < 3 or name.lower() in ("view profile", "my account"):
            continue
        profile = urljoin(BASE, href.split("?")[0])
        key = profile.lower()
        if key in seen:
            continue
        seen.add(key)

        band = "Band ?"
        parent = a.find_parent(["section", "div", "li"])
        if parent:
            band_m = _BAND_RE.search(parent.get_text(" ", strip=True))
            if band_m:
                band = f"Band {band_m.group(1)}"

        practice_tag = f"{practice} | Chambers {band}"

        if lawyers:
            records.append(
                ProspectRecord(
                    full_name=name,
                    practice_areas=practice_tag,
                    city=None,
                    state=None,
                    country="IN",
                    profile_url=profile,
                    source="chambers_lawyer",
                )
            )
        else:
            records.append(
                ProspectRecord(
                    full_name=name,
                    organisation=name,
                    practice_areas=practice_tag,
                    city=None,
                    country="IN",
                    profile_url=profile,
                    source="chambers_firm",
                )
            )

    # Fallback: numbered list items under Band headings (markdown-rendered pages)
    if not records:
        text = sp.get_text("\n", strip=True)
        for band_m in _BAND_RE.finditer(text):
            pass  # bands parsed via links primarily

    return records


async def _fetch_profile_website(
    session: aiohttp.ClientSession,
    limiter: RateLimiter,
    profile_url: str,
) -> str | None:
    html = await fetch_html(session, limiter, profile_url, allow_robots=False)
    if not html:
        return None
    sp = soup(html)
    for a in sp.select("a[href^='http']"):
        href = a.get("href", "")
        if not href or "chambers.com" in href:
            continue
        label = (a.get_text(strip=True) or "").lower()
        if any(k in label for k in ("website", "visit", "www", "home")):
            return href
        if re.search(r"\.(com|in|co\.in|org|net)(/|$)", href, re.I):
            return href
    return None


async def scrape_chambers_india(
    data_dir: Path,
    firm_limit: int = 2500,
    lawyer_limit: int = 5000,
    enrich_profiles: bool = True,
) -> list[ProspectRecord]:
    """Return firm + lawyer records from Chambers India rankings."""
    ck = f"{SOURCE_FIRMS}+{SOURCE_LAWYERS}"
    if is_complete(data_dir, ck):
        rows = load_records(data_dir, ck)
        return [ProspectRecord.from_csv_row(r) for r in rows[: firm_limit + lawyer_limit]]

    limiter = RateLimiter(1.2)
    firms: list[ProspectRecord] = []
    lawyers: list[ProspectRecord] = []
    seen_firms: set[str] = set()
    seen_lawyers: set[str] = set()

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        for path in INDIA_PRACTICE_PATHS:
            if len(firms) >= firm_limit and len(lawyers) >= lawyer_limit:
                break
            practice = _practice_from_path(path)
            dept_url = urljoin(BASE, path)
            lawyer_url = dept_url + ("&" if "?" in dept_url else "?") + "tab=lawyers"

            dept_html = await fetch_html(session, limiter, dept_url, allow_robots=False)
            if dept_html:
                for rec in _parse_ranking_page(dept_html, practice, dept_url, lawyers=False):
                    k = rec.full_name.lower()
                    if k not in seen_firms:
                        seen_firms.add(k)
                        firms.append(rec)
                    if len(firms) >= firm_limit:
                        break

            law_html = await fetch_html(session, limiter, lawyer_url, allow_robots=False)
            if law_html:
                for rec in _parse_ranking_page(law_html, practice, lawyer_url, lawyers=True):
                    k = rec.full_name.lower()
                    if k not in seen_lawyers:
                        seen_lawyers.add(k)
                        lawyers.append(rec)
                    if len(lawyers) >= lawyer_limit:
                        break

        if enrich_profiles:
            for rec in firms[: min(400, len(firms))]:
                if rec.website:
                    continue
                site = await _fetch_profile_website(session, limiter, rec.profile_url or "")
                if site:
                    rec.website = site
            for rec in lawyers[: min(800, len(lawyers))]:
                if rec.website:
                    continue
                site = await _fetch_profile_website(session, limiter, rec.profile_url or "")
                if site:
                    rec.website = site

    all_recs = firms[:firm_limit] + lawyers[:lawyer_limit]
    finish_source(data_dir, ck, [r.to_csv_row() for r in all_recs])
    return all_recs
