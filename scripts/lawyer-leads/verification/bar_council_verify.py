"""Bar Council enrollment verification via public state bar name search."""

from __future__ import annotations

import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import ProspectRecord

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None  # type: ignore

import aiohttp

from scrapers.base import DEFAULT_HEADERS, fetch_html, soup
from utils.rate_limiter import RateLimiter

_ENROLL = re.compile(
    r"((?:UP|MAH|KAR|DEL|TN|GJ|WB|TS|AP|KL|PB|HR|MP|BR|OD|AS|JH|CG|UK|RAJ|BAR)[\s/\-]?\d+[\s/\-]?\d{2,4})",
    re.I,
)

# State bar search endpoints (name-based public lookup)
STATE_SEARCH: list[tuple[str, str, str]] = [
    ("KAR", "Karnataka", "https://ksbc.org.in/memsearch.php"),
    ("MAH", "Maharashtra", "https://barcouncilmahgoa.org/v2/members/"),
    ("DEL", "Delhi", "https://bcd.org.in/member-search"),
    ("UP", "Uttar Pradesh", "http://upbarcouncil.com/AdvocateSearchByName.aspx"),
    ("TN", "Tamil Nadu", "https://tnbarcouncil.org/members"),
    ("GJ", "Gujarat", "https://gujaratbarcouncil.org/member-list"),
    ("WB", "West Bengal", "https://www.wbbarcouncil.org/members"),
    ("TS", "Telangana", "https://tbcap.in/members"),
    ("AP", "Andhra Pradesh", "https://apbarcouncil.org/members"),
    ("KL", "Kerala", "https://keralabarcouncil.com/members"),
    ("PB", "Punjab", "https://punjabbarcouncil.com/members"),
    ("HR", "Haryana", "https://haryanabarcouncil.com/members"),
    ("MP", "Madhya Pradesh", "https://mpbarcouncil.org/members"),
    ("BR", "Bihar", "https://biharbarcouncil.org/members"),
    ("RAJ", "Rajasthan", "https://rajasthanbarcouncil.org/members"),
]

HONORIFICS = re.compile(
    r"^(?:adv\.?|shri\.?|smt\.?|dr\.?|mr\.?|ms\.?|mrs\.?|wg\s+cdr\.?|col\.?)\s+",
    re.I,
)


def normalize_advocate_name(name: str) -> str:
    n = HONORIFICS.sub("", name.strip())
    n = re.sub(r"\s+", " ", n)
    return n.lower()


def _guess_state_code(record) -> str | None:
    if record.bar_council_state:
        return record.bar_council_state.upper()
    state = (record.state or "").lower()
    mapping = {
        "karnataka": "KAR",
        "maharashtra": "MAH",
        "delhi": "DEL",
        "uttar pradesh": "UP",
        "tamil nadu": "TN",
        "gujarat": "GJ",
        "west bengal": "WB",
        "telangana": "TS",
        "andhra pradesh": "AP",
        "kerala": "KL",
        "punjab": "PB",
        "haryana": "HR",
        "madhya pradesh": "MP",
        "bihar": "BR",
        "rajasthan": "RAJ",
    }
    for key, code in mapping.items():
        if key in state:
            return code
    city = (record.city or "").lower()
    metro_map = {
        "mumbai": "MAH",
        "pune": "MAH",
        "bangalore": "KAR",
        "bengaluru": "KAR",
        "delhi": "DEL",
        "chennai": "TN",
        "hyderabad": "TS",
        "kolkata": "WB",
        "ahmedabad": "GJ",
        "lucknow": "UP",
    }
    for key, code in metro_map.items():
        if key in city:
            return code
    return None


def _parse_search_results(html: str) -> list[tuple[str, str]]:
    """Return list of (name, enrollment_number) from search HTML."""
    results: list[tuple[str, str]] = []
    sp = soup(html)
    seen: set[str] = set()

    for block in sp.select("tr, li, div, p"):
        text = block.get_text(" ", strip=True)
        if len(text) < 8:
            continue
        enroll_match = _ENROLL.search(text)
        if not enroll_match:
            continue
        enroll = enroll_match.group(1).strip()
        # Name heuristic: text before enrollment or first capitalized words
        name_part = text.split(enroll)[0].strip()[:80]
        name_part = HONORIFICS.sub("", name_part).strip()
        if len(name_part) < 4:
            continue
        key = enroll.lower()
        if key in seen:
            continue
        seen.add(key)
        results.append((name_part, enroll))

    return results[:10]


async def _search_state_bar(
    session: aiohttp.ClientSession,
    limiter: RateLimiter,
    code: str,
    url: str,
    name: str,
) -> list[tuple[str, str]]:
    """Search bar council by name. Returns (name, enrollment) matches."""
    # Most portals use GET with name query param or POST; try common patterns
    search_urls = [
        f"{url}?name={name.replace(' ', '+')}",
        f"{url}?search={name.replace(' ', '+')}",
        f"{url}?advname={name.replace(' ', '+')}",
        url,
    ]
    all_results: list[tuple[str, str]] = []
    for search_url in search_urls:
        html = await fetch_html(session, limiter, search_url, allow_robots=False)
        if html and name.lower()[:4] in html.lower():
            parsed = _parse_search_results(html)
            if parsed:
                all_results.extend(parsed)
                break
    return all_results


def _fuzzy_match_name(query: str, candidates: list[tuple[str, str]], threshold: int = 90) -> tuple[str, str] | None:
    if not candidates:
        return None
    if fuzz is None:
        # Fallback: simple substring match
        q = normalize_advocate_name(query)
        for name, enroll in candidates:
            if q in normalize_advocate_name(name) or normalize_advocate_name(name) in q:
                return name, enroll
        return None

    best_score = 0
    best: tuple[str, str] | None = None
    q = normalize_advocate_name(query)
    for name, enroll in candidates:
        score = fuzz.token_sort_ratio(q, normalize_advocate_name(name))
        if score > best_score:
            best_score = score
            best = (name, enroll)
    if best_score >= threshold:
        return best
    return None


async def verify_bar_council_batch(
    records: list,
    *,
    concurrency: int = 3,
    delay_sec: float = 1.0,
    checkpoint_dir: Path | None = None,
) -> list:
    """
    For records missing lawyer_verified, attempt bar council name lookup.
    Sets bar_enrollment_number, bar_council_state, lawyer_verified, verified_at.
    """
    from models import ProspectRecord  # noqa: F401

    pending = [
        r for r in records
        if not r.lawyer_verified
        and (r.country or "").upper() in ("IN", "INDIA")
        and r.full_name
    ]
    if not pending:
        return records

    checkpoint_path = (checkpoint_dir or Path("data/checkpoints")) / "bar_verify.json"
    verified_keys: set[str] = set()
    if checkpoint_path.exists():
        try:
            verified_keys = set(json.loads(checkpoint_path.read_text()))
        except Exception:
            verified_keys = set()

    limiter = RateLimiter(1.0)
    sem = asyncio.Semaphore(concurrency)
    verified_count = 0
    now = datetime.now(timezone.utc).isoformat()

    async def _verify_one(session: aiohttp.ClientSession, rec) -> None:
        nonlocal verified_count
        if rec.dedupe_key in verified_keys:
            return
        async with sem:
            state_code = _guess_state_code(rec)
            if not state_code:
                # Try all states if unknown
                search_states = STATE_SEARCH
            else:
                search_states = [(c, s, u) for c, s, u in STATE_SEARCH if c == state_code]
                if not search_states:
                    search_states = STATE_SEARCH[:5]

            norm_name = normalize_advocate_name(rec.full_name)
            for code, _state_name, url in search_states:
                results = await _search_state_bar(session, limiter, code, url, rec.full_name)
                match = _fuzzy_match_name(rec.full_name, results)
                if match:
                    _matched_name, enroll = match
                    rec.bar_enrollment_number = enroll
                    rec.bar_council_state = code
                    rec.lawyer_verified = True
                    rec.verified_at = now
                    verified_keys.add(rec.dedupe_key)
                    verified_count += 1
                    break
                await asyncio.sleep(delay_sec)

    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS, connector=connector) as session:
        await asyncio.gather(*[_verify_one(session, rec) for rec in pending])

    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_path.write_text(json.dumps(list(verified_keys)))
    print(f"[bar_verify] verified {verified_count}/{len(pending)} advocates via bar council lookup")
    return records
