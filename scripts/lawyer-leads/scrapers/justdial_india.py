"""Scrape JustDial lawyer/advocate listings across Indian cities (Playwright + HTTP)."""

from __future__ import annotations

import asyncio
import json
import os
import random
import re
import sys
from pathlib import Path
from typing import Sequence
from urllib.parse import quote

import aiohttp

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from data.india_cities import INDIAN_CITIES
from data.justdial_categories import LEGAL_LISTING_PATHS
from enrichment.phone_normalize import is_valid_india_mobile, normalize_india_phones
from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, soup
from utils.checkpoint import append_record, is_complete, load_records, mark_complete
from utils.justdial_progress import clear_progress, load_progress, save_progress
from utils.rate_limiter import RateLimiter

SOURCE = "justdial"

LEGAL_KEYWORDS = re.compile(
    r"\b(lawyer|advocate|attorney|solicitor|legal|law\s*firm|vakil|barrister|notary)\b",
    re.I,
)
_PHONE_TEXT = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}")
_WA_URL = re.compile(r"(?:wa\.me/|phone=)(\+?91?\d{10,12})", re.I)
_JSON_PHONE = re.compile(
    r'"(?:mobile|phone|contact|vnumber|tel)"\s*:\s*"([6-9]\d{9})"',
    re.I,
)
_DATA_PHONE = re.compile(r'data-(?:phone|mobile|contact)=["\']([6-9\d+\s-]+)["\']', re.I)

DEFAULT_PAGES_PER_CITY = int(os.environ.get("JUSTDIAL_PAGES_PER_CITY", "25"))

# JustDial often fails headless Chromium over HTTP/2 — disable it and prefer system Chrome.
CHROMIUM_LAUNCH_ARGS = [
    "--disable-http2",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
]

BACKGROUND_WINDOW_ARGS = [
    "--window-position=-32000,-32000",
    "--window-size=1280,800",
]

_STEALTH_INIT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
"""

_browser_context = None  # reused for the duration of one scrape run
_homepage_warmed = False
_warned_empty_shell = False
_consecutive_blocks = 0


def _background_mode() -> bool:
    return os.environ.get("JUSTDIAL_BACKGROUND", "").lower() in ("1", "true", "yes")


def _launch_args() -> list[str]:
    args = list(CHROMIUM_LAUNCH_ARGS)
    if _background_mode():
        args.extend(BACKGROUND_WINDOW_ARGS)
    return args


def _should_keep_browser() -> bool:
    env = os.environ.get("JUSTDIAL_KEEP_BROWSER", "").lower()
    if env in ("0", "false", "no"):
        return False
    if env in ("1", "true", "yes"):
        return True
    if _browser_context:
        return _browser_context.get("mode") in ("cdp", "persistent")
    if os.environ.get("JUSTDIAL_CDP_URL"):
        return True
    if os.environ.get("JUSTDIAL_USER_DATA_DIR"):
        return True
    return False


async def _get_work_page(ctx_bundle: dict):
    """One reusable tab for the whole scrape — no open/close per URL."""
    existing = ctx_bundle.get("work_page")
    if existing and not existing.is_closed():
        return existing
    page = await ctx_bundle["context"].new_page()
    ctx_bundle["work_page"] = page
    return page


def _justdial_host() -> str:
    host = (os.environ.get("JUSTDIAL_HOST") or "www.justdial.com").strip().rstrip("/")
    if host.startswith("http"):
        return host
    return f"https://{host}"


def _term_label(term: str) -> str:
    return term.replace("-", " ")


def _ncat_digits(category: str | None) -> str:
    if not category:
        return ""
    match = re.search(r"(\d+)", category)
    return match.group(1) if match else ""


def _city_url_slug(city: str) -> str:
    """justdial.com/Delhi/Lawyers — title-case hyphenated slugs."""
    return "-".join(part.capitalize() for part in city.lower().split("-"))


def _listing_url(city_slug: str, term: str, category: str | None, page: int) -> str:
    base = _justdial_host()
    path = f"{base}/{city_slug}/{term}"
    if category:
        path = f"{path}/{category}"
    if page > 1:
        path = f"{path}/page-{page}"
    extra = (os.environ.get("JUSTDIAL_LISTING_QUERY") or "").strip().lstrip("?")
    if extra:
        sep = "&" if "?" in path else "?"
        path = f"{path}{sep}{extra}"
    return path


def _ajx_listing_url(city_slug: str, term: str, category: str | None, page: int) -> str:
    term_label = _term_label(term)
    ncatid = _ncat_digits(category)
    return (
        "https://www.justdial.com/functions/ajxsearch.php"
        f"?national_search=0&act=pagination_new&city={quote(city_slug)}"
        f"&search={quote(term_label)}&where=&catid=0&psearch=&prid=&page={page}"
        f"&SID=&mntypgrp=0&toknbkt=&bookDate=&jdsrc="
        f"&ncatid={ncatid}&mncatname={quote(term_label)}&dcity={quote(city_slug)}"
        f"&pncode=999999&htlis=0"
    )


def _is_legal_listing(name: str, category: str | None = None) -> bool:
    cat = (category or "").lower()
    if any(k in cat for k in ("lawyer", "advocate", "legal", "notary", "law-firm", "law firm")):
        return len(name) >= 3
    return bool(LEGAL_KEYWORDS.search(f"{name} {category or ''}"))


def _whatsapp_only_mode() -> bool:
    return os.environ.get("JUSTDIAL_WA_ONLY", "1").lower() not in ("0", "false", "no")


def _whatsapp_from_href(href: str | None) -> str | None:
    if not href:
        return None
    match = _WA_URL.search(href.replace(" ", ""))
    if not match:
        return None
    primary, _ = normalize_india_phones(match.group(1))
    return primary


def _whatsapp_from_item_dict(item: dict) -> str | None:
    """WhatsApp number from listing JSON — NOT the call/VNumber button."""
    for key in (
        "wpnumber",
        "watsapp",
        "whatsapp",
        "whatsapp_number",
        "wa_number",
        "wp_number",
        "wpnum",
    ):
        val = item.get(key)
        if val is None:
            continue
        if isinstance(val, list):
            for part in val:
                wa = _whatsapp_from_href(str(part)) or normalize_india_phones(str(part))[0]
                if wa:
                    return wa
            continue
        text = str(val).strip()
        wa = _whatsapp_from_href(text)
        if wa:
            return wa
        primary, _ = normalize_india_phones(text)
        if primary and is_valid_india_mobile(primary):
            return primary
    for val in item.values():
        if isinstance(val, str) and ("wa.me" in val or "whatsapp.com" in val):
            wa = _whatsapp_from_href(val)
            if wa:
                return wa
    blob = json.dumps(item, ensure_ascii=False)
    return _whatsapp_from_href(blob)


def _whatsapp_from_blob(text: str) -> str | None:
    wa = _whatsapp_from_href(text)
    if wa:
        return wa
    return None


def _prospect_from_listing(
    *,
    name: str,
    city: str,
    term: str,
    whatsapp: str | None,
    profile: str | None = None,
    call_phone: str | None = None,
    organisation: str | None = None,
) -> ProspectRecord | None:
    if len(name) < 3 or not _is_legal_listing(name, term):
        return None
    wa_primary, _ = normalize_india_phones(whatsapp)
    if _whatsapp_only_mode() and not wa_primary:
        return None
    if not wa_primary and not call_phone:
        return None

    contact = wa_primary or call_phone
    call_primary, call_alt = normalize_india_phones(call_phone)
    if wa_primary:
        contact = wa_primary
        wa_conf = "from_wa_link"
    else:
        wa_conf = None

    if profile and not profile.startswith("http"):
        profile = f"https://www.justdial.com/{profile.lstrip('/')}"

    org = organisation
    if not org and re.search(r"firm|associates|&|consultants|legal", name, re.I):
        org = name

    return ProspectRecord(
        full_name=name,
        organisation=org,
        practice_areas=term,
        city=_city_url_slug(city).replace("-", " "),
        country="IN",
        phone=contact,
        alternate_phone=call_alt if call_alt and call_alt != contact else call_primary if call_primary and call_primary != contact else None,
        whatsapp=wa_primary or contact,
        whatsapp_confidence=wa_conf,
        profile_url=profile,
        source=SOURCE,
    )


def _phones_from_text(text: str) -> tuple[str | None, str | None]:
    raw: list[str] = []
    for m in _JSON_PHONE.findall(text):
        raw.append(m)
    for m in _DATA_PHONE.findall(text):
        raw.append(m)
    for m in _PHONE_TEXT.findall(text.replace(" ", "")):
        raw.append(m)
    combined = " / ".join(dict.fromkeys(raw)) if raw else None
    return normalize_india_phones(combined)


def _extract_whatsapp_and_call(el, html_chunk: str = "") -> tuple[str | None, str | None, str | None]:
    """Return (whatsapp, call_primary, call_alternate) from a listing card."""
    whatsapp: str | None = None
    call_raw: list[str] = []
    for a in el.select('a[href*="wa.me"], a[href*="whatsapp"]'):
        wa = _whatsapp_from_href(a.get("href", ""))
        if wa:
            whatsapp = wa
    for a in el.select('a[href^="tel:"]'):
        call_raw.append(a.get("href", "").replace("tel:", "").strip())
    for node in el.select(
        '[data-phone], [data-mobile], [data-contact], .contact-info, span[class*=mobile]'
    ):
        for attr in ("data-phone", "data-mobile", "data-contact"):
            val = node.get(attr)
            if val:
                call_raw.append(str(val))
        text = node.get_text(" ", strip=True)
        for m in _PHONE_TEXT.findall(text.replace(" ", "")):
            call_raw.append(m)
    if html_chunk and not whatsapp:
        whatsapp = _whatsapp_from_href(html_chunk)
    call_primary, call_alt = normalize_india_phones(" / ".join(dict.fromkeys(call_raw)) if call_raw else None)
    return whatsapp, call_primary, call_alt


def _extract_phones(el, html_chunk: str = "") -> tuple[str | None, str | None]:
    whatsapp, call_primary, call_alt = _extract_whatsapp_and_call(el, html_chunk)
    if whatsapp:
        return whatsapp, call_alt if call_alt and call_alt != whatsapp else call_primary if call_primary and call_primary != whatsapp else None
    return call_primary, call_alt


def _api_only_mode() -> bool:
    """Use JustDial JSON APIs instead of listing HTML (requires valid session tokens)."""
    return os.environ.get("JUSTDIAL_API_ONLY", "").lower() in ("1", "true", "yes")


def _cdp_html_mode() -> bool:
    """CDP + real Chrome: load listing pages and parse embedded Next.js data."""
    return bool(os.environ.get("JUSTDIAL_CDP_URL")) and not _api_only_mode()


async def _browser_fetch(
    ctx_bundle: dict,
    url: str,
    *,
    method: str = "GET",
    body: dict | None = None,
    referer: str | None = None,
) -> tuple[int, str]:
    """Run fetch() inside the real Chrome tab (uses session cookies, no Playwright goto)."""
    page = await _get_work_page(ctx_bundle)
    current = page.url or ""
    html_len = len(await page.content())
    if "justdial.com" not in current or html_len < 5000:
        await page.goto(
            "https://www.justdial.com/",
            wait_until="domcontentloaded",
            timeout=90000,
        )
        await page.wait_for_timeout(2500)
        global _homepage_warmed
        _homepage_warmed = True

    result = await page.evaluate(
        """async ({ url, method, body, referer }) => {
            const headers = {
              Accept: 'application/json, text/plain, */*',
              'Accept-Language': 'en-IN,en;q=0.9',
            };
            if (referer) headers.Referer = referer;
            const opts = { method, credentials: 'include', headers };
            if (body) {
              headers['Content-Type'] = 'application/json';
              opts.body = JSON.stringify(body);
            }
            const resp = await fetch(url, opts);
            return { status: resp.status, text: await resp.text() };
        }""",
        {"url": url, "method": method, "body": body, "referer": referer},
    )
    return int(result["status"]), str(result["text"])


def _parse_api_row(row: object) -> tuple[str, str | None, str | None, str | None]:
    """Extract name, WhatsApp, call phone, profile from resultsPageListing row."""
    name = ""
    whatsapp: str | None = None
    call_phone: str | None = None
    profile = None

    if isinstance(row, list):
        if len(row) > 1 and row[1]:
            name = str(row[1]).strip()
        if len(row) > 0 and row[0]:
            profile = str(row[0]).strip()
        blob = json.dumps(row, ensure_ascii=False)
        whatsapp = _whatsapp_from_href(blob)
        if not whatsapp and isinstance(row, list):
            item = {f"c{i}": v for i, v in enumerate(row)}
            whatsapp = _whatsapp_from_item_dict(item)
        phones = _PHONE_TEXT.findall(blob.replace(" ", ""))
        for digits in phones:
            primary, _ = normalize_india_phones(digits)
            if primary and primary != whatsapp:
                call_phone = primary
                break
    elif isinstance(row, dict):
        name = str(
            row.get("name")
            or row.get("compname")
            or row.get("companyname")
            or row.get("cn")
            or ""
        ).strip()
        whatsapp = _whatsapp_from_item_dict(row)
        call_raw = str(
            row.get("VNumber")
            or row.get("vnumber")
            or row.get("mobile")
            or row.get("phone")
            or row.get("contact")
            or ""
        ).strip()
        call_phone, _ = normalize_india_phones(call_raw or None)
        profile = row.get("url") or row.get("href") or row.get("weburl") or row.get("docid")
        if profile:
            profile = str(profile).strip()

    if profile and not profile.startswith("http"):
        profile = f"https://www.justdial.com/{profile.lstrip('/')}"
    return name, whatsapp, call_phone, profile


def _parse_results_api_payload(payload: dict, city: str, term: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    seen: set[str] = set()
    results = payload.get("results")
    rows: list = []
    if isinstance(results, dict):
        data = results.get("data")
        if isinstance(data, list):
            rows = data
    elif isinstance(results, list):
        rows = results

    for row in rows:
        name, whatsapp, call_phone, profile = _parse_api_row(row)
        rec = _prospect_from_listing(
            name=name,
            city=city,
            term=term,
            whatsapp=whatsapp,
            profile=profile,
            call_phone=call_phone,
        )
        if not rec:
            continue
        key = (profile or name).lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(rec)
    return records


async def _fetch_results_api(
    ctx_bundle: dict,
    city_slug: str,
    term: str,
    category: str | None,
    page: int,
    listing_url: str,
) -> str | None:
    """POST resultsPageListing — same API the website uses for infinite scroll."""
    term_label = _term_label(term)
    ncat = _ncat_digits(category)
    body = {
        "pg_no": page,
        "city": city_slug,
        "search": term_label,
        "national_catid": ncat,
        "mncatname": term_label,
        "stype": "category_list",
        "area": "",
        "lat": "",
        "long": "",
        "median_latitude": "",
        "median_longitude": "",
        "nearme": 0,
        "opt": "",
        "checkin": "",
        "checkout": "",
        "attribute_values": "",
        "darea_flg": 0,
    }
    api_url = "https://www.justdial.com/api/resultsPageListing?searchReferer=gen"
    try:
        status, text = await _browser_fetch(
            ctx_bundle,
            api_url,
            method="POST",
            body=body,
            referer=listing_url,
        )
        if status >= 400 or len(text) < 80:
            return None
        return text
    except Exception as exc:
        print(f"[justdial] results API error: {exc}", file=sys.stderr)
        return None


def _parse_next_data(html: str, city: str, term: str) -> list[ProspectRecord]:
    """Parse lawyers from __NEXT_DATA__ embedded in modern JustDial listing pages."""
    match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        html,
        re.S,
    )
    if not match:
        return []
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    records: list[ProspectRecord] = []
    seen: set[str] = set()
    page_props = payload.get("props", {}).get("pageProps", {})
    list_data = page_props.get("listData", {})
    results = list_data.get("results", {})
    columns = results.get("columns")
    rows = results.get("data")
    if not isinstance(columns, list) or not isinstance(rows, list):
        return []

    for row in rows:
        if not isinstance(row, list) or len(row) != len(columns):
            continue
        item = dict(zip(columns, row))
        name = str(item.get("name") or "").strip()
        whatsapp = _whatsapp_from_item_dict(item)
        call_raw = str(item.get("VNumber") or item.get("mobile") or "").strip()
        call_primary, _ = normalize_india_phones(call_raw or None)
        weburl = str(item.get("weburl") or item.get("sharedt_url") or "").strip()
        profile = None
        if weburl:
            profile = (
                weburl if weburl.startswith("http") else f"https://www.justdial.com/{weburl.lstrip('/')}"
            )
        rec = _prospect_from_listing(
            name=name,
            city=city,
            term=term,
            whatsapp=whatsapp,
            profile=profile,
            call_phone=call_primary,
        )
        if not rec:
            continue
        key = (profile or name).lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(rec)
    return records


def _parse_justdial_html(html: str, city: str, term: str) -> list[ProspectRecord]:
    next_records = _parse_next_data(html, city, term)
    if next_records:
        return next_records

    records: list[ProspectRecord] = []
    seen: set[str] = set()
    stripped = html.lstrip()
    if stripped.startswith(("{", "[")):
        try:
            payload = json.loads(html)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict):
            api_records = _parse_results_api_payload(payload, city, term)
            if api_records:
                return api_records
            items: list = []
            for key in ("results", "data", "listings", "list"):
                val = payload.get(key)
                if isinstance(val, list):
                    items = val
                    break
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = str(
                    item.get("name")
                    or item.get("compname")
                    or item.get("companyname")
                    or item.get("cn")
                    or ""
                ).strip()
                if len(name) < 3:
                    continue
                mobile = (
                    item.get("mobile")
                    or item.get("phone")
                    or item.get("contact")
                    or item.get("vnumber")
                    or ""
                )
                profile = item.get("url") or item.get("href") or item.get("docid")
                if profile and isinstance(profile, str) and not profile.startswith("http"):
                    profile = f"https://www.justdial.com{profile}"
                whatsapp = _whatsapp_from_item_dict(item)
                call_primary, _ = normalize_india_phones(str(mobile) if mobile else None)
                rec = _prospect_from_listing(
                    name=name,
                    city=city,
                    term=term,
                    whatsapp=whatsapp,
                    profile=str(profile) if profile else None,
                    call_phone=call_primary,
                )
                if not rec:
                    continue
                key = (str(profile) if profile else name).lower()
                if key in seen:
                    continue
                seen.add(key)
                records.append(rec)
            if records:
                return records

    sp = soup(html)
    seen: set[str] = set()

    cards = sp.select(
        ".cntanr, .store-details, .jd-card, .resultbox, "
        "[class*=listing], li[class*=cnt], .jcn-parent, .jdicon"
    )
    if not cards:
        cards = sp.select("li, article, .row")

    for card in cards:
        name_el = card.select_one(
            ".lng_cont_name a, .lng_cont_name, .store-name, h3 a, h4 a, .jcn a, .jcn"
        )
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if len(name) < 3 or len(name) > 120:
            continue
        cat_el = card.select_one(".category, .jcn + span, .mrehit, .jcn")
        category = cat_el.get_text(strip=True) if cat_el else term
        if not _is_legal_listing(name, category):
            continue

        profile = None
        if name_el.name == "a":
            href = name_el.get("href", "").strip()
        else:
            link = card.select_one("a[href*='/']")
            href = link.get("href", "").strip() if link else ""
        if href:
            profile = href if href.startswith("http") else f"https://www.justdial.com{href}"

        card_html = str(card)
        whatsapp, call_primary, call_alt = _extract_whatsapp_and_call(card, card_html)
        rec = _prospect_from_listing(
            name=name,
            city=city,
            term=category,
            whatsapp=whatsapp,
            profile=profile,
            call_phone=call_primary,
        )
        if not rec:
            continue
        key = (profile or name).lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(rec)

    if not records and not _whatsapp_only_mode():
        for match in re.finditer(
            r'"name"\s*:\s*"([^"]{3,120})"[^}]{0,400}?"(?:mobile|phone)"\s*:\s*"([6-9]\d{9})"',
            html,
        ):
            name, mobile = match.group(1), match.group(2)
            if not _is_legal_listing(name, term):
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            primary, alternate = normalize_india_phones(mobile)
            records.append(
                ProspectRecord(
                    full_name=name,
                    practice_areas=term,
                    city=_city_url_slug(city).replace("-", " "),
                    country="IN",
                    phone=primary,
                    alternate_phone=alternate,
                    source=SOURCE,
                )
            )
    return records


async def _ensure_browser_context():
    """Open one Playwright browser context per scrape (session reuse helps with JD)."""
    global _browser_context
    if _browser_context is not None:
        return _browser_context

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print(
            "[justdial] playwright not installed — run: pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        return None

    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    headless = os.environ.get("JUSTDIAL_HEADED", "").lower() not in ("1", "true", "yes")
    prefer = (os.environ.get("JUSTDIAL_BROWSER") or "auto").lower()
    host = _justdial_host()
    mobile_host = "m.justdial.com" in host or "wap.justdial.com" in host
    cdp_url = (os.environ.get("JUSTDIAL_CDP_URL") or "").strip()
    user_data_dir = (os.environ.get("JUSTDIAL_USER_DATA_DIR") or "").strip()

    pw = await async_playwright().start()
    browser = None
    context = None
    mode = "launch"
    label = "unknown"

    if cdp_url:
        try:
            browser = await pw.chromium.connect_over_cdp(cdp_url)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            mode = "cdp"
            label = "cdp"
            print(
                f"[justdial] connected to Chrome via CDP ({cdp_url}) — use your normal browser session",
                file=sys.stderr,
            )
        except Exception as exc:
            print(
                f"[justdial] CDP connect failed ({cdp_url}): {exc}\n"
                "  Start Chrome first:\n"
                '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome '
                "--remote-debugging-port=9222 --user-data-dir=$HOME/.justdial-scrape-chrome",
                file=sys.stderr,
            )
            await pw.stop()
            return None
    elif user_data_dir:
        profile = Path(user_data_dir).expanduser()
        profile.mkdir(parents=True, exist_ok=True)
        launch_kw: dict = {
            "user_data_dir": str(profile),
            "headless": headless,
            "args": _launch_args(),
            "locale": "en-IN",
            "timezone_id": "Asia/Kolkata",
            "geolocation": {"latitude": 28.6139, "longitude": 77.2090},
            "permissions": ["geolocation"],
            "viewport": {"width": 1366, "height": 768},
        }
        if proxy:
            launch_kw["proxy"] = {"server": proxy}
        if prefer in ("auto", "chrome"):
            launch_kw["channel"] = "chrome"
            label = "chrome-profile"
        try:
            context = await pw.chromium.launch_persistent_context(**launch_kw)
            mode = "persistent"
            print(
                f"[justdial] persistent Chrome profile ({profile}, headless={headless})",
                file=sys.stderr,
            )
        except Exception as exc:
            print(f"[justdial] persistent profile launch failed: {exc}", file=sys.stderr)
            await pw.stop()
            return None
    else:
        launch_plans: list[tuple[str, dict, str]] = []
        if prefer in ("auto", "chrome"):
            launch_plans.append(
                (
                    "chromium",
                    {"channel": "chrome", "headless": headless, "args": _launch_args()},
                    "chrome",
                )
            )
        if prefer in ("auto", "chromium"):
            launch_plans.append(
                (
                    "chromium",
                    {"headless": headless, "args": _launch_args()},
                    "chromium",
                )
            )
        if prefer in ("auto", "firefox"):
            launch_plans.append(("firefox", {"headless": headless}, "firefox"))

        last_err: Exception | None = None
        for engine, plan, plan_label in launch_plans:
            try:
                launch_kw = dict(plan)
                if proxy:
                    launch_kw["proxy"] = {"server": proxy}
                if engine == "chromium":
                    browser = await pw.chromium.launch(**launch_kw)
                else:
                    browser = await pw.firefox.launch(**launch_kw)
                label = plan_label
                print(f"[justdial] browser ready ({label}, headless={headless})", file=sys.stderr)
                break
            except Exception as exc:
                last_err = exc
                continue

        if browser is None:
            print(f"[justdial] could not launch browser: {last_err}", file=sys.stderr)
            await pw.stop()
            return None

        ua = DEFAULT_HEADERS["User-Agent"]
        if mobile_host:
            ua = (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            )

        context = await browser.new_context(
            user_agent=ua,
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            viewport={"width": 390, "height": 844} if mobile_host else {"width": 1366, "height": 768},
            is_mobile=mobile_host,
            geolocation={"latitude": 28.6139, "longitude": 77.2090},
            permissions=["geolocation"],
            extra_http_headers={
                "Accept-Language": "en-IN,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )

    if mode != "cdp":
        await context.add_init_script(_STEALTH_INIT)
    _browser_context = {
        "pw": pw,
        "browser": browser,
        "context": context,
        "mode": mode,
    }
    return _browser_context


async def _warm_homepage(ctx_bundle: dict, *, force: bool = False) -> None:
    global _homepage_warmed
    if _homepage_warmed and not force:
        return
    page = await _get_work_page(ctx_bundle)
    current = page.url or ""
    try:
        if not force and "justdial.com" in current and len(await page.content()) > 10000:
            _homepage_warmed = True
            return
        await page.goto(
            "https://www.justdial.com/",
            wait_until="domcontentloaded",
            timeout=90000,
        )
        await page.wait_for_timeout(2500)
        _homepage_warmed = True
    except Exception as exc:
        print(f"[justdial] homepage warmup failed: {exc}", file=sys.stderr)


async def _cooldown_after_block(ctx_bundle: dict, url: str) -> None:
    global _homepage_warmed
    wait_sec = float(os.environ.get("JUSTDIAL_BLOCK_COOLDOWN", "45"))
    print(
        f"[justdial] blocked on {url} — cooling down {wait_sec:.0f}s (restart Chrome if this repeats)",
        file=sys.stderr,
    )
    await asyncio.sleep(wait_sec)
    _homepage_warmed = False
    await _warm_homepage(ctx_bundle, force=True)


def _is_block_shell(html: str | None) -> bool:
    return not html or len(html) < 500


def _register_block_success() -> None:
    global _consecutive_blocks
    _consecutive_blocks = 0


def _register_block() -> int:
    global _consecutive_blocks
    _consecutive_blocks += 1
    return _consecutive_blocks


async def _handle_session_block(ctx_bundle: dict, url: str) -> None:
    """Escalating backoff when JustDial returns blank anti-bot shells."""
    global _consecutive_blocks, _homepage_warmed
    n = _register_block()
    max_blocks = int(os.environ.get("JUSTDIAL_MAX_BLOCKS", "3"))
    if n < max_blocks:
        await _cooldown_after_block(ctx_bundle, url)
        return

    pause = float(os.environ.get("JUSTDIAL_SESSION_PAUSE_SEC", "1800"))
    print(
        f"[justdial] session blocked {n} times in a row — pausing {pause / 60:.0f} min\n"
        "  Open scrape Chrome → browse justdial.com → complete captcha if shown\n"
        "  Or run: ./unblock_justdial.sh",
        file=sys.stderr,
    )
    await asyncio.sleep(pause)
    _consecutive_blocks = 0
    _homepage_warmed = False
    await _warm_homepage(ctx_bundle, force=True)


async def _page_delay_sleep() -> None:
    base = float(os.environ.get("JUSTDIAL_PAGE_DELAY", "12"))
    if base <= 0:
        return
    await asyncio.sleep(base * (0.7 + random.random() * 0.6))


async def _city_delay_sleep() -> None:
    base = float(os.environ.get("JUSTDIAL_CITY_DELAY", "30"))
    if base <= 0:
        return
    wait = base * (0.8 + random.random() * 0.4)
    print(f"[justdial] city cooldown {wait:.0f}s", file=sys.stderr)
    await asyncio.sleep(wait)


def _filter_listing_paths(
    paths: list[tuple[str, str | None]],
) -> list[tuple[str, str | None]]:
    raw = os.environ.get("JUSTDIAL_CATEGORIES", "").strip()
    if not raw:
        return paths
    allowed = {part.strip().lower() for part in raw.split(",") if part.strip()}
    filtered = [
        (term, cat)
        for term, cat in paths
        if term.lower() in allowed or any(a in term.lower() for a in allowed)
    ]
    return filtered or paths


def _warn_empty_shell(url: str, html_len: int) -> None:
    global _warned_empty_shell
    if _warned_empty_shell:
        print(f"[justdial] short response ({html_len} bytes) for {url}", file=sys.stderr)
        return
    _warned_empty_shell = True
    print(
        f"[justdial] short response ({html_len} bytes) for {url} — JustDial is likely blocking "
        "automated access (blank/empty page). Fixes to try:\n"
        "  1. ./start_justdial_chrome.sh --visible --bg   # open JustDial on-screen\n"
        "  2. Browse justdial.com manually; complete captcha if shown\n"
        "  3. mv ~/.justdial-scrape-chrome ~/.justdial-scrape-chrome.bak  # fresh profile\n"
        "  4. export HTTP_PROXY=...            # India residential proxy if outside IN\n"
        "See README JustDial section for CDP setup.",
        file=sys.stderr,
    )


async def _close_browser_context(*, force: bool = False) -> None:
    global _browser_context, _homepage_warmed, _warned_empty_shell
    if not _browser_context:
        return
    if not force and _should_keep_browser():
        print(
            "[justdial] leaving Chrome running (JUSTDIAL_KEEP_BROWSER=1 / CDP mode)",
            file=sys.stderr,
        )
        _browser_context = None
        _homepage_warmed = False
        _warned_empty_shell = False
        return
    try:
        mode = _browser_context.get("mode", "launch")
        context = _browser_context["context"]
        browser = _browser_context.get("browser")
        work_page = _browser_context.get("work_page")
        if work_page and not work_page.is_closed():
            await work_page.close()
        if mode == "persistent":
            await context.close()
        elif mode == "cdp":
            if browser:
                await browser.close()  # disconnect only; leaves Chrome running
        else:
            await context.close()
            if browser:
                await browser.close()
        await _browser_context["pw"].stop()
    except Exception:
        pass
    _browser_context = None
    _homepage_warmed = False
    _warned_empty_shell = False


async def _fetch_ajx(
    ctx_bundle: dict,
    city_slug: str,
    term: str,
    category: str | None,
    page: int,
    listing_url: str,
) -> str | None:
    """Legacy pagination API (fallback)."""
    await _warm_homepage(ctx_bundle)
    ajx_url = _ajx_listing_url(city_slug, term, category, page)
    try:
        status, body = await _browser_fetch(
            ctx_bundle,
            ajx_url,
            referer=listing_url,
        )
        if status >= 400 or len(body) < 200:
            return None
        return body
    except Exception as exc:
        print(f"[justdial] ajx API error: {exc}", file=sys.stderr)
    return None


async def _fetch_playwright(url: str) -> str | None:
    ctx_bundle = await _ensure_browser_context()
    if not ctx_bundle:
        return None

    context = ctx_bundle["context"]
    await _warm_homepage(ctx_bundle)
    page = await _get_work_page(ctx_bundle)
    try:
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                resp = await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=90000,
                    referer="https://www.justdial.com/",
                )
                await page.wait_for_timeout(3500)
                try:
                    await page.wait_for_function(
                        "() => {"
                        "  const nd = document.querySelector('#__NEXT_DATA__');"
                        "  if (nd && nd.textContent && nd.textContent.length > 200) return true;"
                        "  return (document.body && document.body.innerText.length > 400);"
                        "}",
                        timeout=20000,
                    )
                except Exception:
                    pass
                await page.evaluate(
                    "window.scrollTo(0, Math.min(document.body.scrollHeight, 2400))"
                )
                await page.wait_for_timeout(1500)
                if resp and resp.status >= 400:
                    print(
                        f"[justdial] HTTP {resp.status} for {url}",
                        file=sys.stderr,
                    )
                    return None
                break
            except Exception as exc:
                last_exc = exc
                err = str(exc)
                if attempt < 2 and (
                    "ERR_HTTP2" in err
                    or "ERR_CONNECTION" in err
                    or "Timeout" in err
                ):
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                raise exc from last_exc
        else:
            if last_exc:
                raise last_exc

        for selector in (
            'button:has-text("Show Number")',
            'span:has-text("Show Number")',
            ".callcontent",
            '[class*="callNow"]',
        ):
            try:
                buttons = await page.query_selector_all(selector)
                for btn in buttons[:10]:
                    await btn.click(timeout=2000)
                    await page.wait_for_timeout(250)
            except Exception:
                continue

        html = await page.content()
        if len(html) >= 3000:
            _register_block_success()
            return html

        if _cdp_html_mode():
            await _handle_session_block(ctx_bundle, url)
            await page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=90000,
                referer="https://www.justdial.com/",
            )
            await page.wait_for_timeout(3500)
            html = await page.content()
            if len(html) >= 3000:
                _register_block_success()
                return html

        _warn_empty_shell(url, len(html))
        return None
    except Exception as exc:
        msg = str(exc)
        if "Executable doesn't exist" in msg:
            print(
                "[justdial] Chromium missing — run: playwright install chromium  "
                "(or install Google Chrome and set JUSTDIAL_BROWSER=chrome)",
                file=sys.stderr,
            )
        elif "ERR_HTTP2" in msg:
            print(
                f"[justdial] HTTP/2 blocked for {url} — try: export JUSTDIAL_BROWSER=chrome "
                f"or install Google Chrome; retrying uses --disable-http2",
                file=sys.stderr,
            )
        else:
            print(f"[justdial] Playwright error for {url}: {exc}", file=sys.stderr)
        return None


_DOM_WHATSAPP_JS = """
() => {
  const out = [];
  const seen = new Set();
  const waLinks = document.querySelectorAll('a[href*="whatsapp.com"], a[href*="wa.me"]');
  for (const a of waLinks) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/(?:wa\\.me\\/|phone=)(\\+?91?\\d{10,12})/i);
    if (!m) continue;
    const card = a.closest('.resultbox, .cntanr, .store-details, .jd-card, li, article')
      || a.parentElement?.parentElement;
    let name = '';
    if (card) {
      const nameEl = card.querySelector(
        '.lng_cont_name a, .lng_cont_name, .store-name, h3 a, h4 a, .jcn a, .jcn'
      );
      if (nameEl) name = (nameEl.innerText || '').trim();
    }
    let profile = '';
    if (card) {
      const link = card.querySelector('a[href*="justdial.com"]');
      if (link) profile = link.getAttribute('href') || '';
    }
    let callPhone = '';
    if (card) {
      const tel = card.querySelector('a[href^="tel:"]');
      if (tel) callPhone = (tel.getAttribute('href') || '').replace('tel:', '').trim();
    }
    const key = (profile || name || m[1]).toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, whatsapp: m[1], profile, call_phone: callPhone });
  }
  return out;
}
"""


_wa_open_hook_installed = False


async def _cleanup_cdp_tabs(ctx_bundle: dict) -> None:
    """Close stray tabs left from prior runs so WhatsApp popups can open."""
    page = await _get_work_page(ctx_bundle)
    closed = 0
    for tab in list(ctx_bundle["context"].pages):
        if tab is page or tab.is_closed():
            continue
        try:
            await tab.close()
            closed += 1
        except Exception:
            pass
    if closed:
        print(f"[justdial] closed {closed} stray Chrome tabs", file=sys.stderr)
    await _close_whatsapp_tabs(ctx_bundle["context"], page)


async def _load_listing_for_whatsapp(ctx_bundle: dict, url: str) -> bool:
    """Open a listing page in the CDP tab — no Show Number clicks (keeps WhatsApp working)."""
    global _wa_open_hook_installed
    page = await _get_work_page(ctx_bundle)
    await _warm_homepage(ctx_bundle)
    await _close_whatsapp_tabs(page.context, page)
    if not _wa_open_hook_installed:
        await page.context.add_init_script(
            """
            window.__jdWaUrls = window.__jdWaUrls || [];
            const _open = window.open;
            window.open = function(url, ...args) {
              try {
                if (url && String(url).includes('whatsapp')) window.__jdWaUrls.push(String(url));
              } catch (e) {}
              return _open.apply(this, [url, ...args]);
            };
            """
        )
        _wa_open_hook_installed = True
    try:
        resp = await page.goto(
            url,
            wait_until="domcontentloaded",
            timeout=90000,
            referer="https://www.justdial.com/",
        )
        await page.wait_for_timeout(3500)
        html = await page.content()
        if resp and resp.status >= 400:
            return False
        if len(html) >= 3000:
            _register_block_success()
            return True
        if _cdp_html_mode():
            await _handle_session_block(ctx_bundle, url)
            html = await page.content()
            return len(html) >= 3000
        return False
    except Exception as exc:
        print(f"[justdial] listing load failed for {url}: {exc}", file=sys.stderr)
        return False
    scroll_passes = passes if passes is not None else int(os.environ.get("JUSTDIAL_SCROLL_PASSES", "10"))
    scroll_delay = float(os.environ.get("JUSTDIAL_SCROLL_DELAY", "2"))
    last_height = 0
    for i in range(scroll_passes):
        await page.evaluate("window.scrollBy(0, window.innerHeight * 0.9)")
        await asyncio.sleep(scroll_delay)
        height = await page.evaluate("document.body.scrollHeight")
        if i > 2 and height == last_height:
            break
        last_height = height
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await asyncio.sleep(scroll_delay)


async def _extract_whatsapp_from_dom(page) -> list[dict]:
    """Static href scan (usually empty on JustDial — numbers need a button click)."""
    try:
        rows = await page.evaluate(_DOM_WHATSAPP_JS)
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        print(f"[justdial] DOM WhatsApp extract failed: {exc}", file=sys.stderr)
        return []


async def _close_whatsapp_tabs(context, keep_page) -> None:
    for tab in context.pages:
        if tab is keep_page or tab.is_closed():
            continue
        if "whatsapp.com" in (tab.url or ""):
            try:
                await tab.close()
            except Exception:
                pass


async def _fetch_whatsapp_from_detail(ctx_bundle: dict, profile_url: str) -> str | None:
    """Open a listing detail page and resolve the WhatsApp send URL."""
    if not profile_url:
        return None
    if not profile_url.startswith("http"):
        profile_url = f"https://www.justdial.com/{profile_url.lstrip('/')}"
    page = await _get_work_page(ctx_bundle)
    context = page.context
    try:
        await page.goto(profile_url, wait_until="domcontentloaded", timeout=90000)
        await page.wait_for_timeout(2500)
        for selector in (
            'a[href*="web.whatsapp.com"]',
            'a[href*="wa.me"]',
            ".float_whatsapp",
        ):
            loc = page.locator(selector).first
            if await loc.count():
                href = await loc.get_attribute("href")
                wa = _whatsapp_from_href(href)
                if wa:
                    return wa
        for selector in (".chatbtn:has-text('WhatsApp')",):
            btn = page.locator(selector).first
            if not await btn.count():
                btn = page.get_by_text("WhatsApp", exact=True).first
            if not await btn.count():
                continue
            try:
                async with context.expect_page(timeout=12000) as popup_info:
                    await btn.click(timeout=6000)
                popup = await popup_info.value
                await popup.wait_for_load_state("domcontentloaded", timeout=20000)
                wa = _whatsapp_from_href(popup.url)
                if popup is not page:
                    await popup.close()
                if wa:
                    return wa
            except Exception:
                captured = await page.evaluate(
                    "() => { const u = window.__jdWaUrls || []; window.__jdWaUrls = []; return u; }"
                )
                for href in reversed(captured or []):
                    wa = _whatsapp_from_href(href)
                    if wa:
                        return wa
    except Exception as exc:
        print(f"[justdial] detail WhatsApp failed for {profile_url}: {exc}", file=sys.stderr)
    finally:
        await _close_whatsapp_tabs(context, page)
    return None


async def _resolve_whatsapp_from_button(page, btn) -> str | None:
    """Click a listing WhatsApp control; accept direct wa popup or follow JD detail page."""
    context = page.context
    popup = None
    try:
        try:
            async with context.expect_page(timeout=12000) as popup_info:
                await btn.click(timeout=6000)
            popup = await popup_info.value
        except Exception:
            captured = await page.evaluate(
                "() => { const u = window.__jdWaUrls || []; window.__jdWaUrls = []; return u; }"
            )
            for href in reversed(captured or []):
                wa = _whatsapp_from_href(href)
                if wa:
                    return wa
            for tab in context.pages:
                if tab is not page and "whatsapp.com" in (tab.url or ""):
                    popup = tab
                    break
            if not popup:
                return None

        await popup.wait_for_load_state("domcontentloaded", timeout=20000)
        wa = _whatsapp_from_href(popup.url)
        if wa:
            if popup is not page:
                await popup.close()
            return wa

        detail_url = popup.url
        if popup is not page:
            await popup.close()
        if "justdial.com" in detail_url:
            ctx_bundle = {"context": context}
            return await _fetch_whatsapp_from_detail(ctx_bundle, detail_url)
    except Exception:
        await _close_whatsapp_tabs(context, page)
    return None


async def _click_whatsapp_buttons(page, *, seen_cards: set[str] | None = None) -> list[dict]:
    """Click each listing WhatsApp button; read phone from web.whatsapp.com popup URL."""
    delay = float(os.environ.get("JUSTDIAL_WA_CLICK_DELAY", "2.5"))
    max_clicks = int(os.environ.get("JUSTDIAL_WA_CLICKS_PER_PAGE", "40"))
    rows: list[dict] = []
    seen_wa: set[str] = set()
    clicked_cards = seen_cards if seen_cards is not None else set()
    context = page.context
    buttons = page.locator("li:has(.callcontent), .resultbox, .cntanr")
    card_count = await buttons.count()
    if card_count == 0:
        buttons = page.locator(".chatbtn:has-text('WhatsApp')")
        card_count = await buttons.count()
        use_cards = False
    else:
        use_cards = True

    clicks = 0
    for i in range(card_count):
        if clicks >= max_clicks:
            break
        try:
            if use_cards:
                card = buttons.nth(i)
                btn = card.locator(".chatbtn:has-text('WhatsApp')")
                if not await btn.count():
                    btn = card.get_by_text("WhatsApp", exact=True)
                if not await card.is_visible():
                    continue
                meta = await card.evaluate(
                    """el => {
                    let name = '';
                    let profile = '';
                    let callPhone = '';
                    const nameEl = el.querySelector(
                      '.lng_cont_name a, .lng_cont_name, .store-name, h3 a, h4 a, .jcn a, .jcn'
                    );
                    if (nameEl) name = (nameEl.innerText || '').trim();
                    const link = el.querySelector('a[href*="justdial.com"]');
                    if (link) profile = link.href || link.getAttribute('href') || '';
                    const tel = el.querySelector('.callcontent, a[href^="tel:"]');
                    if (tel) callPhone = (tel.innerText || tel.getAttribute('href') || '').replace('tel:', '').trim();
                    return { name, profile, callPhone };
                }"""
                )
            else:
                btn = buttons.nth(i)
                if not await btn.is_visible():
                    continue
                meta = await btn.evaluate(
                    """el => {
                    const card = el.closest('li, article, [class*="result"], .resultbox, .cntanr')
                      || el.parentElement?.parentElement?.parentElement;
                    let name = '';
                    let profile = '';
                    let callPhone = '';
                    if (card) {
                      const nameEl = card.querySelector(
                        '.lng_cont_name a, .lng_cont_name, .store-name, h3 a, h4 a, .jcn a, .jcn'
                      );
                      if (nameEl) name = (nameEl.innerText || '').trim();
                      const link = card.querySelector('a[href*="justdial.com"]');
                      if (link) profile = link.href || link.getAttribute('href') || '';
                      const tel = card.querySelector('.callcontent, a[href^="tel:"]');
                      if (tel) callPhone = (tel.innerText || tel.getAttribute('href') || '').replace('tel:', '').trim();
                    }
                    return { name, profile, callPhone };
                }"""
                )

            card_key = f"{meta.get('name', '')}|{meta.get('profile', '')}".lower().strip("|")
            if card_key and card_key in clicked_cards:
                continue

            wa = await _resolve_whatsapp_from_button(page, btn)
            if wa and wa not in seen_wa:
                seen_wa.add(wa)
                rows.append({**meta, "whatsapp": wa})
                if card_key:
                    clicked_cards.add(card_key)
                clicks += 1
            await asyncio.sleep(delay)
        except Exception as exc:
            print(
                f"[justdial] WhatsApp card {i + 1}/{card_count} failed: {exc}",
                file=sys.stderr,
            )
            await _close_whatsapp_tabs(context, page)
            await asyncio.sleep(delay * 1.5)

    await _close_whatsapp_tabs(context, page)
    return rows


async def _scroll_and_click_whatsapp(page) -> list[dict]:
    """Scroll listing to load lazy cards; click WhatsApp on each visible batch."""
    scroll_passes = int(os.environ.get("JUSTDIAL_SCROLL_PASSES", "12"))
    scroll_delay = float(os.environ.get("JUSTDIAL_SCROLL_DELAY", "2"))
    all_rows: list[dict] = []
    seen_wa: set[str] = set()
    clicked_cards: set[str] = set()
    stale_passes = 0

    try:
        for pass_i in range(scroll_passes):
            if page.is_closed():
                print("[justdial] Chrome tab closed — stop scrolling", file=sys.stderr)
                break
            batch = await _click_whatsapp_buttons(page, seen_cards=clicked_cards)
            added = 0
            for row in batch:
                wa = str(row.get("whatsapp") or "")
                primary, _ = normalize_india_phones(wa)
                if primary and primary not in seen_wa:
                    seen_wa.add(primary)
                    row["whatsapp"] = primary
                    all_rows.append(row)
                    added += 1

            before = await page.locator(".chatbtn:has-text('WhatsApp')").count()
            if before == 0:
                before = await page.get_by_text("WhatsApp", exact=True).count()
            await page.evaluate("window.scrollBy(0, window.innerHeight * 0.92)")
            await asyncio.sleep(scroll_delay)
            after = await page.locator(".chatbtn:has-text('WhatsApp')").count()
            if after == 0:
                after = await page.get_by_text("WhatsApp", exact=True).count()

            if added == 0 and after <= before:
                stale_passes += 1
            else:
                stale_passes = 0
            if stale_passes >= 3:
                break
    except Exception as exc:
        if "Target page, context or browser has been closed" in str(exc):
            print(
                "[justdial] Chrome was closed during scrape — restart Chrome and re-run",
                file=sys.stderr,
            )
        else:
            raise

    return all_rows


async def _scrape_category_whatsapp(
    ctx_bundle: dict,
    city: str,
    city_slug: str,
    term: str,
    category: str | None,
    pages_per_city: int,
    page_start: int = 1,
) -> list[ProspectRecord]:
    """Load each listing page, scroll, click WhatsApp buttons, capture popup URLs."""
    records: list[ProspectRecord] = []
    seen: set[str] = set()

    def _merge(batch: list[ProspectRecord]) -> int:
        added = 0
        for rec in batch:
            if rec.dedupe_key in seen:
                continue
            seen.add(rec.dedupe_key)
            records.append(rec)
            added += 1
        return added

    for page_num in range(page_start, pages_per_city + 1):
        listing_url = _listing_url(city_slug, term, category, page_num)
        if not await _load_listing_for_whatsapp(ctx_bundle, listing_url):
            print(
                f"[justdial] blocked/empty listing page {city_slug}/{term} page {page_num}",
                file=sys.stderr,
            )
            break

        work_page = await _get_work_page(ctx_bundle)
        dom_rows = await _scroll_and_click_whatsapp(work_page)
        page_recs: list[ProspectRecord] = []
        for row in dom_rows:
            rec = _prospect_from_listing(
                name=str(row.get("name") or "").strip(),
                city=city,
                term=term,
                whatsapp=str(row.get("whatsapp") or ""),
                profile=str(row.get("profile") or "") or None,
                call_phone=str(row.get("callPhone") or row.get("call_phone") or "") or None,
            )
            if rec:
                page_recs.append(rec)

        # Also pick up any wa.me links embedded after scroll (rare)
        for row in await _extract_whatsapp_from_dom(work_page):
            rec = _prospect_from_listing(
                name=str(row.get("name") or "").strip(),
                city=city,
                term=term,
                whatsapp=str(row.get("whatsapp") or ""),
                profile=str(row.get("profile") or "") or None,
                call_phone=str(row.get("call_phone") or "") or None,
            )
            if rec:
                page_recs.append(rec)

        added = _merge(page_recs)
        print(
            f"[justdial] {city_slug}/{term} page {page_num}: +{added} WhatsApp (total {len(records)})",
            file=sys.stderr,
        )
        if added == 0:
            break
        _register_block_success()
        await _page_delay_sleep()

    return records


async def _fetch_page(
    session: aiohttp.ClientSession | None,
    limiter: RateLimiter | None,
    url: str,
    *,
    prefer_playwright: bool,
    city_slug: str = "",
    term: str = "",
    category: str | None = None,
    page_num: int = 1,
) -> str | None:
    use_browser = prefer_playwright or os.environ.get("JUSTDIAL_USE_PLAYWRIGHT", "").lower() in (
        "1",
        "true",
        "yes",
    )

    if use_browser:
        ctx_bundle = await _ensure_browser_context()
        if ctx_bundle and city_slug and term and _cdp_html_mode():
            html = await _fetch_playwright(url)
            if html and len(html) > 5000:
                return html

        if ctx_bundle and city_slug and term and _api_only_mode():
            await _warm_homepage(ctx_bundle)
            for fetcher in (_fetch_results_api, _fetch_ajx):
                raw = await fetcher(
                    ctx_bundle, city_slug, term, category, page_num, url
                )
                if raw and len(raw) > 200:
                    parsed = _parse_justdial_html(raw, city_slug.lower(), term)
                    if parsed:
                        return raw
            print(
                f"[justdial] API returned no data for {city_slug}/{term} page {page_num}",
                file=sys.stderr,
            )
            return None

        if not _api_only_mode() and not _cdp_html_mode():
            html = await _fetch_playwright(url)
            if html and len(html) > 5000:
                return html
            if ctx_bundle and city_slug and term:
                ajx = await _fetch_ajx(
                    ctx_bundle, city_slug, term, category, page_num, url
                )
                if ajx and len(ajx) > 500:
                    return ajx

    if session and limiter:
        return await fetch_html(session, limiter, url, allow_robots=False)
    return None


async def scrape_justdial_india(
    data_dir: Path,
    limit: int = 50000,
    cities: Sequence[str] | None = None,
    *,
    pages_per_city: int = DEFAULT_PAGES_PER_CITY,
    resume: bool = True,
    prefer_playwright: bool = True,
) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE) and not resume:
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    city_list = [c.lower() for c in cities] if cities else INDIAN_CITIES
    paths = _filter_listing_paths(LEGAL_LISTING_PATHS)
    if len(paths) < len(LEGAL_LISTING_PATHS):
        print(
            f"[justdial] categories: {', '.join(t for t, _ in paths)}",
            file=sys.stderr,
        )

    if _cdp_html_mode():
        print(
            "[justdial] CDP WhatsApp mode — scroll listing + extract wa.me/send?phone= links",
            file=sys.stderr,
        )
    elif _api_only_mode():
        print(
            "[justdial] API-only mode — fetching listings via JSON API (no listing page navigation)",
            file=sys.stderr,
        )

    seen: set[str] = set()
    all_records: list[ProspectRecord] = []
    for row in load_records(data_dir, SOURCE):
        rec = ProspectRecord.from_csv_row(row)
        seen.add(rec.dedupe_key)
        all_records.append(rec)

    progress = load_progress(data_dir) if resume else {"city_index": 0, "path_index": 0, "page": 1}
    start_city = int(progress.get("city_index", 0))
    if resume and start_city >= len(city_list) and is_complete(data_dir, SOURCE):
        return all_records[:limit]
    start_path = int(progress.get("path_index", 0))
    start_page = int(progress.get("page", 1))

    if prefer_playwright and (os.environ.get("JUSTDIAL_CDP_URL") or "").strip():
        ctx = await _ensure_browser_context()
        if not ctx:
            raise SystemExit(
                "[justdial] JUSTDIAL_CDP_URL is set but Chrome CDP is unreachable.\n"
                "  ./start_justdial_chrome.sh --bg\n"
                "  export JUSTDIAL_CDP_URL=http://127.0.0.1:9222"
            )
        await _cleanup_cdp_tabs(ctx)

    limiter = RateLimiter(float(os.environ.get("JUSTDIAL_RATE_SEC", "1.5")))
    session: aiohttp.ClientSession | None = None
    if not prefer_playwright:
        session = aiohttp.ClientSession()

    try:
        for city_i, city in enumerate(city_list):
            if city_i < start_city:
                continue
            if len(all_records) >= limit:
                break
            city_slug = _city_url_slug(city)

            for path_i, (term, category) in enumerate(paths):
                if city_i == start_city and path_i < start_path:
                    continue
                page_start = start_page if city_i == start_city and path_i == start_path else 1
                empty_streak = 0

                if _cdp_html_mode():
                    ctx_bundle = await _ensure_browser_context()
                    if not ctx_bundle:
                        raise SystemExit("[justdial] CDP browser context unavailable")
                    parsed = await _scrape_category_whatsapp(
                        ctx_bundle,
                        city,
                        city_slug,
                        term,
                        category,
                        pages_per_city,
                        page_start,
                    )
                    if not parsed:
                        print(
                            f"[justdial] no WhatsApp listings for {city_slug}/{term}",
                            file=sys.stderr,
                        )
                    else:
                        for rec in parsed:
                            if rec.dedupe_key in seen:
                                continue
                            seen.add(rec.dedupe_key)
                            all_records.append(rec)
                            append_record(data_dir, SOURCE, rec.to_csv_row())
                            if len(all_records) >= limit:
                                break
                    save_progress(
                        data_dir,
                        city_index=city_i,
                        path_index=path_i + 1,
                        page=1,
                        city=city,
                        records=len(all_records),
                    )
                    if city_i == start_city and path_i == start_path:
                        start_page = 1
                    await _page_delay_sleep()
                    continue

                for page in range(page_start, pages_per_city + 1):
                    if len(all_records) >= limit:
                        break
                    url = _listing_url(city_slug, term, category, page)
                    html = await _fetch_page(
                        session,
                        limiter,
                        url,
                        prefer_playwright=prefer_playwright,
                        city_slug=city_slug,
                        term=term,
                        category=category,
                        page_num=page,
                    )
                    if not html:
                        empty_streak += 1
                        if _consecutive_blocks > 0 or empty_streak >= 2:
                            break
                        continue

                    parsed = _parse_justdial_html(html, city, term)
                    if not parsed:
                        empty_streak += 1
                        if _is_block_shell(html) or empty_streak >= 2:
                            break
                        continue
                    empty_streak = 0
                    _register_block_success()

                    for rec in parsed:
                        if rec.dedupe_key in seen:
                            continue
                        seen.add(rec.dedupe_key)
                        all_records.append(rec)
                        append_record(data_dir, SOURCE, rec.to_csv_row())
                        if len(all_records) >= limit:
                            break

                    save_progress(
                        data_dir,
                        city_index=city_i,
                        path_index=path_i,
                        page=page + 1,
                        city=city,
                        records=len(all_records),
                    )
                    await _page_delay_sleep()

                if city_i == start_city and path_i == start_path:
                    start_page = 1

            save_progress(
                data_dir,
                city_index=city_i + 1,
                path_index=0,
                page=1,
                city=city,
                records=len(all_records),
            )
            await _city_delay_sleep()
    finally:
        if session:
            await session.close()
        await _close_browser_context()

    if all_records:
        mark_complete(data_dir, SOURCE)
    return all_records[:limit]
