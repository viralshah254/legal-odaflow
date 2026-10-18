"""JustDial legal listing paths (term + optional national category id)."""

from __future__ import annotations

# national_catid in nct-XXXXXXXX slugs; verified on justdial.com listing URLs.
LEGAL_LISTING_PATHS: list[tuple[str, str | None]] = [
    ("Lawyers", "nct-10296083"),
    ("Advocates", "nct-10296048"),
    ("Law-Firms", "nct-10296103"),
    ("Legal-Consultants", "nct-10298477"),
    ("Notary-Services", "nct-10492452"),
]
