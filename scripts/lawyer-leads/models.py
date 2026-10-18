"""Shared record model for scraped lawyer prospects."""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


def normalize_key_part(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())


def make_dedupe_key(full_name: str, organisation: str | None, city: str | None) -> str:
    raw = "|".join(
        [
            normalize_key_part(full_name),
            normalize_key_part(organisation),
            normalize_key_part(city),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def split_name(full_name: str) -> tuple[str, str, str]:
    parts = [p for p in re.split(r"\s+", full_name.strip()) if p]
    if not parts:
        return "", "", ""
    if len(parts) == 1:
        return full_name.strip(), parts[0], ""
    return full_name.strip(), parts[0], " ".join(parts[1:])


@dataclass
class ProspectRecord:
    full_name: str
    organisation: str | None = None
    practice_areas: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    whatsapp: str | None = None
    whatsapp_confidence: str | None = None
    email: str | None = None
    email_confidence: str | None = None
    website: str | None = None
    profile_url: str | None = None
    bar_enrollment_number: str | None = None
    bar_council_state: str | None = None
    lawyer_verified: bool = False
    verified_at: str | None = None
    source: str = ""
    scraped_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    first_name: str = ""
    last_name: str = ""
    dedupe_key: str = ""

    def __post_init__(self) -> None:
        if not self.first_name and self.full_name:
            self.full_name, self.first_name, self.last_name = split_name(self.full_name)
        if not self.dedupe_key:
            self.dedupe_key = make_dedupe_key(
                self.full_name, self.organisation, self.city
            )

    def to_csv_row(self) -> dict[str, Any]:
        d = asdict(self)
        return {
            "id": self.dedupe_key,
            "full_name": d["full_name"],
            "first_name": d["first_name"],
            "last_name": d["last_name"],
            "organisation": d["organisation"] or "",
            "practice_areas": d["practice_areas"] or "",
            "city": d["city"] or "",
            "state": d["state"] or "",
            "country": d["country"] or "",
            "phone": d["phone"] or "",
            "alternate_phone": d["alternate_phone"] or "",
            "whatsapp": d["whatsapp"] or "",
            "whatsapp_confidence": d["whatsapp_confidence"] or "",
            "email": d["email"] or "",
            "email_confidence": d["email_confidence"] or "",
            "website": d["website"] or "",
            "profile_url": d["profile_url"] or "",
            "bar_enrollment_number": d["bar_enrollment_number"] or "",
            "bar_council_state": d["bar_council_state"] or "",
            "lawyer_verified": "true" if d["lawyer_verified"] else "false",
            "verified_at": d["verified_at"] or "",
            "source": d["source"],
            "scraped_at": d["scraped_at"],
        }

    @classmethod
    def from_csv_row(cls, row: dict[str, Any]) -> ProspectRecord:
        full_name = (row.get("full_name") or "").strip()
        first = (row.get("first_name") or "").strip()
        last = (row.get("last_name") or "").strip()
        if not full_name and (first or last):
            full_name = f"{first} {last}".strip()
        rec = cls(
            full_name=full_name,
            organisation=row.get("organisation") or None,
            practice_areas=row.get("practice_areas") or None,
            city=row.get("city") or None,
            state=row.get("state") or None,
            country=row.get("country") or None,
            phone=row.get("phone") or None,
            alternate_phone=row.get("alternate_phone") or None,
            whatsapp=row.get("whatsapp") or None,
            whatsapp_confidence=row.get("whatsapp_confidence") or None,
            email=row.get("email") or None,
            email_confidence=row.get("email_confidence") or None,
            website=row.get("website") or None,
            profile_url=row.get("profile_url") or None,
            bar_enrollment_number=row.get("bar_enrollment_number") or None,
            bar_council_state=row.get("bar_council_state") or None,
            lawyer_verified=(row.get("lawyer_verified") or "").lower() in ("true", "1", "yes"),
            verified_at=row.get("verified_at") or None,
            source=row.get("source") or "",
            scraped_at=row.get("scraped_at")
            or datetime.now(timezone.utc).isoformat(),
            first_name=first,
            last_name=last,
            dedupe_key=(row.get("id") or row.get("dedupe_key") or "").strip(),
        )
        if not rec.dedupe_key:
            rec.dedupe_key = make_dedupe_key(
                rec.full_name, rec.organisation, rec.city
            )
        return rec
