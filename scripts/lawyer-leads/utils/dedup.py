"""Deduplicate prospect records."""

from __future__ import annotations

from models import ProspectRecord, make_dedupe_key

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None  # type: ignore


def _fuzzy_dup(a: ProspectRecord, b: ProspectRecord) -> bool:
    if fuzz is None:
        return False
    name_a = (a.full_name or "").lower()
    name_b = (b.full_name or "").lower()
    org_a = (a.organisation or "").lower()
    org_b = (b.organisation or "").lower()
    city_a = (a.city or "").lower()
    city_b = (b.city or "").lower()
    if city_a and city_b and city_a != city_b:
        return False
    name_score = fuzz.token_sort_ratio(name_a, name_b)
    org_score = fuzz.token_sort_ratio(org_a, org_b) if org_a and org_b else 100
    return name_score >= 90 and org_score >= 85


def deduplicate(records: list[ProspectRecord]) -> list[ProspectRecord]:
    seen_keys: set[str] = set()
    result: list[ProspectRecord] = []

    for rec in records:
        key = rec.dedupe_key or make_dedupe_key(
            rec.full_name, rec.organisation, rec.city
        )
        if key in seen_keys:
            continue
        dup = False
        for existing in result:
            if existing.dedupe_key == key or _fuzzy_dup(existing, rec):
                dup = True
                break
        if dup:
            continue
        rec.dedupe_key = key
        seen_keys.add(key)
        result.append(rec)

    return result
