"""Email enrichment: scraped emails, pattern generation, optional Hunter.io."""

from __future__ import annotations

import asyncio
import os
import re
from urllib.parse import urlparse

import aiohttp

from models import ProspectRecord

try:
    import dns.resolver
except ImportError:
    dns = None  # type: ignore

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _domain_from_website(website: str | None) -> str | None:
    if not website:
        return None
    if "@" in website:
        return None
    url = website if website.startswith("http") else f"https://{website}"
    host = urlparse(url).netloc
    return host.lower().removeprefix("www.") if host else None


def _patterns(first: str, last: str, domain: str) -> list[str]:
    f = re.sub(r"[^a-z0-9]", "", (first or "").lower())
    l = re.sub(r"[^a-z0-9]", "", (last or "").lower())
    if not f or not domain:
        return []
    candidates = [f"{f}@{domain}"]
    if l:
        candidates.extend(
            [
                f"{f}{l}@{domain}",
                f"{f}.{l}@{domain}",
                f"{l}@{domain}",
            ]
        )
    return candidates


def _mx_exists(domain: str) -> bool:
    if dns is None:
        return True
    try:
        answers = dns.resolver.resolve(domain, "MX")
        return len(answers) > 0
    except Exception:
        try:
            dns.resolver.resolve(domain, "A")
            return True
        except Exception:
            return False


async def _hunter_find(
    session: aiohttp.ClientSession,
    domain: str,
    first: str,
    last: str,
) -> tuple[str | None, str | None]:
    api_key = os.environ.get("HUNTER_API_KEY")
    if not api_key:
        return None, None
    params = {
        "domain": domain,
        "first_name": first,
        "last_name": last,
        "api_key": api_key,
    }
    try:
        async with session.get(
            "https://api.hunter.io/v2/email-finder",
            params=params,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                return None, None
            data = await resp.json()
            email = data.get("data", {}).get("email")
            score = data.get("data", {}).get("score", 0)
            if email and score >= 70:
                return email, "hunter"
    except Exception:
        pass
    return None, None


async def enrich_email(record: ProspectRecord) -> ProspectRecord:
    if record.email and _EMAIL_RE.match(record.email):
        record.email_confidence = record.email_confidence or "scraped"
        return record

    domain = _domain_from_website(record.website)
    if not domain or not _mx_exists(domain):
        return record

    async with aiohttp.ClientSession() as session:
        hunter_email, hunter_conf = await _hunter_find(
            session, domain, record.first_name, record.last_name
        )
        if hunter_email:
            record.email = hunter_email
            record.email_confidence = hunter_conf
            return record

    for candidate in _patterns(record.first_name, record.last_name, domain):
        if _EMAIL_RE.match(candidate):
            record.email = candidate
            record.email_confidence = "pattern-high" if _mx_exists(domain) else "pattern-low"
            break

    return record


async def enrich_emails(records: list[ProspectRecord], concurrency: int = 20) -> list[ProspectRecord]:
    sem = asyncio.Semaphore(concurrency)

    async def one(rec: ProspectRecord) -> ProspectRecord:
        async with sem:
            if rec.email:
                rec.email_confidence = rec.email_confidence or "scraped"
                return rec
            return await enrich_email(rec)

    return await asyncio.gather(*[one(r) for r in records])
