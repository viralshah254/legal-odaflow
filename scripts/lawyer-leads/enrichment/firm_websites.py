"""Attach known firm websites for email enrichment."""

from __future__ import annotations

import json
from pathlib import Path

from models import ProspectRecord

_DOMAINS_FILE = Path(__file__).resolve().parents[1] / "data" / "india_firm_domains.json"
_cache: dict[str, str] | None = None


def _load_domains() -> dict[str, str]:
    global _cache
    if _cache is not None:
        return _cache
    if not _DOMAINS_FILE.exists():
        _cache = {}
        return _cache
    raw = json.loads(_DOMAINS_FILE.read_text(encoding="utf-8"))
    _cache = {k.strip().lower(): v for k, v in raw.items()}
    return _cache


def enrich_firm_websites(records: list[ProspectRecord]) -> list[ProspectRecord]:
    domains = _load_domains()
    for rec in records:
        if rec.website:
            continue
        for key in (rec.full_name, rec.organisation):
            if not key:
                continue
            url = domains.get(key.strip().lower())
            if url:
                rec.website = url
                break
    return records
