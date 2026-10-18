"""Scrape public India state bar council advocate listings where available."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

import aiohttp

from enrichment.phone_normalize import normalize_india_phones
from models import ProspectRecord
from scrapers.base import DEFAULT_HEADERS, fetch_html, finish_source, soup
from utils.checkpoint import is_complete, load_records
from utils.rate_limiter import RateLimiter

SOURCE = "india_bar"

# Public listing pages (HTML tables / advocate directories)
BAR_LIST_URLS: list[tuple[str, str, str]] = [
    ("Rajasthan", "https://rajasthan.nalsa.gov.in/list-of-plvs/", "RAJ"),
    ("Maharashtra", "https://barcouncilmahgoa.org/v2/members/", "MAH"),
    ("Karnataka", "https://ksbc.org.in/memsearch.php", "KAR"),
    ("Uttar Pradesh", "http://upbarcouncil.com/AdvocateSearchByName.aspx", "UP"),
    ("Delhi", "https://bcd.org.in/member-search", "DEL"),
    ("Tamil Nadu", "https://tnbarcouncil.org/members", "TN"),
    ("Gujarat", "https://gujaratbarcouncil.org/member-list", "GJ"),
    ("West Bengal", "https://www.wbbarcouncil.org/members", "WB"),
    ("Telangana", "https://tbcap.in/members", "TS"),
    ("Andhra Pradesh", "https://apbarcouncil.org/members", "AP"),
    ("Kerala", "https://keralabarcouncil.com/members", "KL"),
    ("Punjab", "https://punjabbarcouncil.com/members", "PB"),
    ("Haryana", "https://haryanabarcouncil.com/members", "HR"),
    ("Madhya Pradesh", "https://mpbarcouncil.org/members", "MP"),
    ("Bihar", "https://biharbarcouncil.org/members", "BR"),
    ("Odisha", "https://orissahighcourt.nic.in/bar-council", "OD"),
    ("Assam", "https://assambarcouncil.com/members", "AS"),
    ("Jharkhand", "https://jharkhandbarcouncil.org/members", "JH"),
    ("Chhattisgarh", "https://cgbarcouncil.org/members", "CG"),
    ("Uttarakhand", "https://uttarakhandbarcouncil.org/members", "UK"),
]

_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
_ENROLL = re.compile(
    r"(?:Enroll(?:ment)?\.?\s*(?:No\.?)?\s*[:.]?\s*)([A-Z]{2,4}[\s/\-]?\d+[\s/\-]?\d{2,4})",
    re.I,
)
_PHONE = re.compile(r"(?:\+91[\s-]?|Mobile[\s:-]*)?([6-9]\d{9})", re.I)
_MOBILE_LABEL = re.compile(r"Mobile[\s:-]*([6-9]\d{9})", re.I)


def _parse_advocate_table(html: str, state: str, bar_code: str) -> list[ProspectRecord]:
    records: list[ProspectRecord] = []
    sp = soup(html)
    seen: set[str] = set()
    now = datetime.now(timezone.utc).isoformat()

    for tr in sp.select("table tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.select("td, th")]
        if len(cells) < 2:
            continue
        row_text = " | ".join(cells)
        emails = _EMAIL.findall(row_text)
        phones_raw = _PHONE.findall(re.sub(r"\D", " ", row_text))
        name = cells[0] if cells else ""
        if len(name) < 4 or name.lower() in ("name", "advocate", "s.no", "sl.no"):
            continue
        phone = None
        alt = None
        if phones_raw:
            primary, alternate = normalize_india_phones(phones_raw[0])
            phone = primary
            alt = alternate
        email = emails[0] if emails else None
        enroll = _ENROLL.search(row_text)
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        rec = ProspectRecord(
            full_name=name,
            practice_areas=f"Bar/LSA panel | {state}",
            state=state,
            country="IN",
            phone=phone,
            alternate_phone=alt,
            email=email,
            email_confidence="scraped" if email else None,
            source=SOURCE,
        )
        if enroll:
            rec.bar_enrollment_number = enroll.group(1).strip()
            rec.bar_council_state = bar_code
            rec.lawyer_verified = True
            rec.verified_at = now
        records.append(rec)

    # Block-level parsing for member directory pages (e.g. Maharashtra BCMG)
    page_text = sp.get_text("\n", strip=True)
    for mobile_match in _MOBILE_LABEL.finditer(page_text):
        phone, _ = normalize_india_phones(mobile_match.group(1))
        if not phone:
            continue
        # Context window around mobile for name/enrollment
        start = max(0, mobile_match.start() - 200)
        context = page_text[start:mobile_match.start() + 50]
        enroll = _ENROLL.search(context)
        name_match = re.search(
            r"(?:Adv\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})",
            context,
        )
        name = name_match.group(1).strip() if name_match else f"Advocate {mobile_match.group(1)[:4]}***"
        key = (name + (enroll.group(1) if enroll else phone)).lower()
        if key in seen:
            continue
        seen.add(key)
        rec = ProspectRecord(
            full_name=name,
            practice_areas=f"Bar council member | {state}",
            state=state,
            country="IN",
            phone=phone,
            source=SOURCE,
        )
        if enroll:
            rec.bar_enrollment_number = enroll.group(1).strip()
            rec.bar_council_state = bar_code
            rec.lawyer_verified = True
            rec.verified_at = now
        records.append(rec)

    for block in sp.select("div, p, li, article"):
        text = block.get_text(" ", strip=True)
        if len(text) < 20 or "adv" not in text.lower():
            continue
        enroll = _ENROLL.search(text)
        if not enroll:
            continue
        phones = _PHONE.findall(text.replace(" ", ""))
        phone = None
        if phones:
            phone, _ = normalize_india_phones(phones[0])
        # Heuristic: first line with "Adv." is the name
        name_match = re.search(r"Adv\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", text)
        if not name_match:
            continue
        name = name_match.group(1).strip()
        key = (name + enroll.group(1)).lower()
        if key in seen:
            continue
        seen.add(key)
        records.append(
            ProspectRecord(
                full_name=name,
                practice_areas=f"Bar council member | {state}",
                state=state,
                country="IN",
                phone=phone,
                bar_enrollment_number=enroll.group(1).strip(),
                bar_council_state=bar_code,
                lawyer_verified=True,
                verified_at=now,
                source=SOURCE,
            )
        )

    return records


async def scrape_india_bar_councils(data_dir: Path, limit: int = 10000) -> list[ProspectRecord]:
    if is_complete(data_dir, SOURCE):
        rows = load_records(data_dir, SOURCE)
        return [ProspectRecord.from_csv_row(r) for r in rows[:limit]]

    limiter = RateLimiter(1.0)
    all_records: list[ProspectRecord] = []
    seen: set[str] = set()

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        for state, url, bar_code in BAR_LIST_URLS:
            if len(all_records) >= limit:
                break
            html = await fetch_html(session, limiter, url, allow_robots=False)
            if not html:
                continue
            for rec in _parse_advocate_table(html, state, bar_code):
                k = rec.dedupe_key
                if k not in seen:
                    seen.add(k)
                    all_records.append(rec)

    finish_source(data_dir, SOURCE, [r.to_csv_row() for r in all_records[:limit]])
    return all_records[:limit]
