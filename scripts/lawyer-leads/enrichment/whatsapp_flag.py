"""
Normalize phones and flag WhatsApp-likely contacts.

For India (country=IN):
  - Splits multi-number fields into primary + alternate
  - Formats both to +91 E.164
  - Sets whatsapp = primary, whatsappConfidence = "high"
  - Optionally probes wa.me to confirm (--verify-whatsapp flag)
  - Stores alternate number in alternate_phone field

For other countries:
  - Basic normalization retained for backward compatibility
"""

from __future__ import annotations

import asyncio
import re
import sys
from typing import TYPE_CHECKING

from enrichment.phone_normalize import normalize_india_phones, is_valid_india_mobile

if TYPE_CHECKING:
    pass

_DIGITS = re.compile(r"\D+")


def normalize_phone(phone: str | None, country: str | None = None) -> str | None:
    """Legacy single-number normalizer (non-India or fallback)."""
    if not phone:
        return None
    cc = (country or "").upper()

    # For India use the full normalizer, return just the primary
    if cc in ("IN", "INDIA"):
        primary, _ = normalize_india_phones(phone)
        return primary

    digits = _DIGITS.sub("", phone)
    if not digits:
        return None
    if cc in ("US", "USA", "UNITED STATES") and len(digits) == 10:
        digits = "1" + digits
    if cc in ("GB", "UK", "UNITED KINGDOM") and digits.startswith("0"):
        digits = "44" + digits[1:]
    return "+" + digits if not digits.startswith("+") else digits


def whatsapp_link(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = _DIGITS.sub("", phone)
    if not digits:
        return None
    return f"https://wa.me/{digits}"


def enrich_whatsapp(record) -> object:  # type: ignore[type-arg]
    """
    Enrich a ProspectRecord with normalized phone, alternate_phone,
    whatsapp, and whatsappConfidence.

    India records:
      - Parse primary + alternate from raw phone field
      - Both stored as +91 E.164
      - whatsappConfidence = "high" for valid mobiles (no live check)

    Other countries:
      - Basic normalization as before
    """
    from models import ProspectRecord  # avoid circular at module level

    cc = (record.country or "").upper()

    if cc in ("IN", "INDIA"):
        if record.whatsapp and record.whatsapp_confidence in ("from_wa_link", "verified"):
            primary, _ = normalize_india_phones(record.whatsapp)
            record.whatsapp = primary
            record.phone = primary
            if record.alternate_phone:
                alt, _ = normalize_india_phones(record.alternate_phone)
                if alt and alt != primary:
                    record.alternate_phone = alt
                else:
                    record.alternate_phone = None
            return record

        raw_phone = record.phone
        primary, alternate = normalize_india_phones(raw_phone)

        record.phone = primary
        if alternate and alternate != primary:
            record.alternate_phone = alternate

        if primary and is_valid_india_mobile(primary):
            record.whatsapp = primary
            record.whatsapp_confidence = "high"
        else:
            record.whatsapp = None
            record.whatsapp_confidence = None
    else:
        # Non-India: existing behaviour
        phone = normalize_phone(record.phone, record.country)
        if phone:
            record.phone = phone
        if not phone:
            record.whatsapp = None
            record.whatsapp_confidence = None
            return record

        if phone.startswith("+1") or phone.startswith("+44"):
            record.whatsapp = phone
            record.whatsapp_confidence = "possible"
        else:
            record.whatsapp = phone
            record.whatsapp_confidence = "possible"

    return record


async def _probe_whatsapp(session, phone: str) -> bool:
    """
    HEAD-request wa.me to check if the number has WhatsApp.
    Returns True only if the redirect goes to the chat page
    (wa.me returns 301 → web.whatsapp.com for real numbers).
    Rate-limit: caller is responsible for delays.
    """
    digits = _DIGITS.sub("", phone)
    url = f"https://wa.me/{digits}"
    try:
        async with session.head(
            url,
            allow_redirects=False,
            timeout=10,
        ) as resp:
            location = resp.headers.get("Location", "")
            return resp.status in (301, 302) and "web.whatsapp.com" in location
    except Exception:
        return False


async def verify_whatsapp_batch(
    records: list,
    concurrency: int = 5,
    delay_sec: float = 0.5,
) -> list:
    """
    Probe wa.me for all records where whatsapp is set and country=IN.
    Updates whatsapp_confidence to "verified" on success.
    """
    try:
        import aiohttp
    except ImportError:
        print("[warn] aiohttp not available — skipping WhatsApp verification", file=sys.stderr)
        return records

    india_records = [
        r for r in records
        if (r.country or "").upper() in ("IN", "INDIA")
        and r.whatsapp
        and r.whatsapp_confidence in ("high", "possible", "from_wa_link")
    ]

    if not india_records:
        return records

    sem = asyncio.Semaphore(concurrency)

    async def _check(session, rec) -> None:
        async with sem:
            confirmed = await _probe_whatsapp(session, rec.whatsapp)
            if confirmed:
                rec.whatsapp_confidence = "verified"
            await asyncio.sleep(delay_sec)

    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        await asyncio.gather(*[_check(session, rec) for rec in india_records])

    verified = sum(1 for r in india_records if r.whatsapp_confidence == "verified")
    print(f"[whatsapp] verified {verified}/{len(india_records)} India numbers")
    return records
