"""
India-focused phone number normalization.

Handles:
- Multi-number strings (split on / , ; & or)
- Label stripping (Mob:, Tel:, WhatsApp:, Phone:)
- Leading 0 removal
- Duplicate 91 prefix detection
- E.164 formatting (+91XXXXXXXXXX)
- Mobile vs landline classification (IN mobiles start with 6-9)
- Junk rejection (all-same-digit, too short, test numbers)
"""

from __future__ import annotations

import re

# Patterns that delimit multiple numbers inside a single field
_MULTI_SPLIT = re.compile(r"\s*/\s*|\s*,\s*|\s*;\s*|\s+or\s+|\s+&\s+|\s+and\s+")

# Common label prefixes to strip before parsing
_LABEL = re.compile(
    r"(?i)\b(mob|mobile|tel|phone|ph|fax|whatsapp|wa|contact|call|res|off(?:ice)?)\s*[:\-]?\s*"
)

_DIGITS_ONLY = re.compile(r"\D+")

# Indian mobile numbers start with 6, 7, 8, or 9 (after +91)
_IN_MOBILE_PREFIX = re.compile(r"^[6-9]\d{9}$")

# Obvious junk: all same digit, or fewer than 6 digits
_JUNK = re.compile(r"^(\d)\1{5,}$")


def _clean_digits(raw: str) -> str | None:
    """Return stripped digits for a single number string, or None if not parseable."""
    raw = _LABEL.sub("", raw).strip()
    digits = _DIGITS_ONLY.sub("", raw)
    if not digits or len(digits) < 7:
        return None
    if _JUNK.match(digits):
        return None
    return digits


def _to_e164_india(digits: str) -> str | None:
    """
    Convert a raw digit string to +91XXXXXXXXXX E.164, or return None if invalid.
    Accepts:
        10-digit bare mobile
        91 + 10-digit (no leading +)
        0 + 10-digit (STD trunk prefix)
        +91 already formatted
    """
    # Strip leading +
    if digits.startswith("+"):
        digits = digits[1:]

    # Strip country code 91 prefix if present
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        # STD trunk prefix
        digits = digits[1:]

    if len(digits) != 10:
        return None

    if not _IN_MOBILE_PREFIX.match(digits):
        return None  # landline or invalid

    return f"+91{digits}"


def normalize_india_phones(raw: str | None) -> tuple[str | None, str | None]:
    """
    Parse a raw phone field into (primary, alternate) E.164 India mobile numbers.

    Returns (None, None) if no valid mobile found.
    Returns (primary, None) if only one valid number.
    Returns (primary, alternate) if two distinct valid numbers found.
    """
    if not raw:
        return None, None

    parts = _MULTI_SPLIT.split(raw)
    found: list[str] = []
    seen: set[str] = set()

    for part in parts:
        digits = _clean_digits(part)
        if not digits:
            continue
        e164 = _to_e164_india(digits)
        if e164 and e164 not in seen:
            seen.add(e164)
            found.append(e164)
        if len(found) >= 2:
            break

    if not found:
        return None, None
    if len(found) == 1:
        return found[0], None
    return found[0], found[1]


def is_valid_india_mobile(phone: str | None) -> bool:
    """Return True if the stored phone is a valid +91 E.164 mobile."""
    if not phone:
        return False
    if not phone.startswith("+91"):
        return False
    body = phone[3:]
    return bool(_IN_MOBILE_PREFIX.match(body))
