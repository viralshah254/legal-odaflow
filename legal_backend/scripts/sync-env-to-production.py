#!/usr/bin/env python3
"""Merge selected keys from local .env into a target .env file."""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Never overwrite production infrastructure with local dev values.
PROTECTED_KEYS = {
    "NODE_ENV",
    "APP_URL",
    "API_URL",
    "REDIS_URL",
    "PORT",
    "CORS_ORIGINS",
    "DATABASE_URL",
    "DIRECT_DATABASE_URL",
    "JWT_SECRET",
    "REFRESH_TOKEN_SECRET",
    "SESSION_COOKIE_SECRET",
    "SEED_ADMIN_PASSWORD",
}

# Keys to always sync when present locally (missing or updated API/feature config).
SYNC_KEYS = {
    "DEEPGRAM_API_KEY",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "FIRESTORE_DATABASE_ID",
    "GOVINFO_API_KEY",
    "GOVINFO_USCODE_EDITION",
    "USLM_RELEASE_PATH",
    "USLM_MIRROR_HOSTS",
    "LAWS_AFRICA_API_TOKEN",
    "STRIPE_INTRO_OFFER_COUPON_ID",
    "STRIPE_FIRST_PURCHASE_COUPON_ID",
    "STRIPE_REFERRAL_COUPON_ID",
    "STRIPE_PRICE_CONSUMER_PLUS_INR",
    "STRIPE_PRICE_FIRM_PRO_PLUS_INR",
    "STRIPE_PRICE_FIRM_PROFESSIONAL_INR",
    "STRIPE_PRICE_FIRM_STARTER_INR",
    "STRIPE_PRICE_LAWYER_SOLO_INR",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_LAWYER_SOLO_DEVELOPING",
    "STRIPE_PRICE_FIRM_STARTER_DEVELOPING",
    "STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPING",
    "STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPING",
    "STRIPE_PRICE_LAWYER_SOLO_DEVELOPED",
    "STRIPE_PRICE_FIRM_STARTER_DEVELOPED",
    "STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPED",
    "STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPED",
    "OPENAI_API_MODE",
    "OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_API_VERSION",
    "AZURE_OPENAI_DEPLOYMENT_MAP",
    "ANTHROPIC_API_KEY",
    "GOOGLE_AI_API_KEY",
    "GOOGLE_PLACES_API_KEY",
    "TAVILY_API_KEY",
    "COURTLISTENER_API_TOKEN",
    "ECOURTS_API_URL",
    "INDIA_KANOON_API_KEY",
    "AZURE_OCR_ENDPOINT",
    "AZURE_OCR_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ACCOUNT_ID",
    "AWS_REGION",
    "IAM_USER",
    "S3_PROVIDER",
    "S3_BUCKET",
    "LEGAL_S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_PUBLIC_CDN_URL",
    "LEGAL_SQS_QUEUE_URL",
    "ENCRYPTION_MASTER_KEY",
    "DEVICE_FINGERPRINT_SALT",
    "CONSUMER_SIGNUP_CREDITS",
    "LAWYER_SIGNUP_CREDITS",
    "DAILY_FREE_CONSUMER_CREDITS",
    "DEFAULT_CONSUMER_FREE_PREVIEWS",
    "INTRO_OFFER_DISCOUNT_PERCENT",
    "INTRO_OFFER_DAYS",
    "REFERRAL_REWARD_USD",
    "REFERRAL_ATTRIBUTION_DAYS",
    "REFERRAL_MAX_REWARDS_PER_FINGERPRINT",
    "STRIPE_TAX_ENABLED",
    "STRIPE_TAX_CODE_DIGITAL",
    "DEFAULT_COUNTRY",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_API_TOKEN",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "WHATSAPP_WABA_ID",
}


def parse_env(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", s)
        if m:
            data[m.group(1)] = m.group(2)
    return data


def upsert_env(path: Path, updates: dict[str, str]) -> list[str]:
    lines = path.read_text().splitlines()
    changed: list[str] = []
    seen: set[str] = set()

    for i, line in enumerate(lines):
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=", line.strip())
        if not m:
            continue
        key = m.group(1)
        if key in updates:
            new_line = f"{key}={updates[key]}"
            if lines[i] != new_line:
                lines[i] = new_line
                changed.append(key)
            seen.add(key)

    for key, value in updates.items():
        if key not in seen:
            lines.append(f"{key}={value}")
            changed.append(key)

    path.write_text("\n".join(lines) + "\n")
    return changed


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: sync-env-to-production.py <local.env> <target.env>", file=sys.stderr)
        return 1

    local = parse_env(Path(sys.argv[1]))
    target = Path(sys.argv[2])
    updates = {
        k: v
        for k, v in local.items()
        if k in SYNC_KEYS and k not in PROTECTED_KEYS and v.strip() != ""
    }
    changed = upsert_env(target, updates)
    print(f"Updated {len(changed)} keys:")
    for key in sorted(changed):
        print(f"  - {key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
