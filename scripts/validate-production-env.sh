#!/usr/bin/env bash
# Series A Prompt 38 — production environment validation
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/legal_backend/.env"

required=(
  DATABASE_URL
  REDIS_URL
  STRIPE_SECRET_KEY
  JWT_SECRET
  REFRESH_TOKEN_SECRET
  SESSION_COOKIE_SECRET
  API_URL
  APP_URL
  CORS_ORIGINS
  S3_BUCKET
  S3_REGION
)

optional_warn=(
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  AZURE_DOCUMENT_INTELLIGENCE_KEY
  AZURE_OCR_ENDPOINT
  AZURE_OCR_API_KEY
  ECOURTS_API_URL
  COURTLISTENER_API_TOKEN
  COURTLISTENER_TOKEN
  INDIA_KANOON_API_KEY
  GOOGLE_OAUTH_CLIENT_ID
  MICROSOFT_CLIENT_ID
  STRIPE_WEBHOOK_SECRET
  RESEND_API_KEY
  SENTRY_DSN
  FIREBASE_PROJECT_ID
  FIREBASE_CLIENT_EMAIL
  FIREBASE_PRIVATE_KEY
  DIRECT_DATABASE_URL
)

echo "=== Production env validation ==="

if [[ ! -f "$ENV_FILE" ]]; then
  echo "WARN: $ENV_FILE not found — checking process env"
else
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

missing=0
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "FAIL required: $key"
    missing=$((missing + 1))
  else
    echo "OK   required: $key"
  fi
done

# OpenAI credentials depend on OPENAI_API_MODE (default: direct)
# azure = Azure OpenAI for GPT + embeddings; Whisper always needs OPENAI_API_KEY
openai_mode="$(echo "${OPENAI_API_MODE:-direct}" | tr '[:upper:]' '[:lower:]')"
if [[ "$openai_mode" == "azure" ]]; then
  for key in AZURE_OPENAI_ENDPOINT AZURE_OPENAI_API_KEY; do
    if [[ -z "${!key:-}" ]]; then
      echo "FAIL required (OPENAI_API_MODE=azure): $key"
      missing=$((missing + 1))
    else
      echo "OK   required (OPENAI_API_MODE=azure): $key"
    fi
  done
  if [[ -z "${AZURE_OPENAI_API_VERSION:-}" ]]; then
    echo "WARN optional: AZURE_OPENAI_API_VERSION (defaults to 2024-10-21)"
  else
    echo "OK   optional: AZURE_OPENAI_API_VERSION"
  fi
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "WARN optional: OPENAI_API_KEY (required for Whisper — always uses OpenAI direct)"
  else
    echo "OK   optional: OPENAI_API_KEY (Whisper)"
  fi
else
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "FAIL required (OPENAI_API_MODE=direct): OPENAI_API_KEY"
    missing=$((missing + 1))
  else
    echo "OK   required (OPENAI_API_MODE=direct): OPENAI_API_KEY"
  fi
fi

for key in "${optional_warn[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "WARN optional: $key (feature degraded)"
  else
    echo "OK   optional: $key"
  fi
done

if [[ "${NODE_ENV:-development}" == "production" && "$missing" -gt 0 ]]; then
  echo "Production deploy blocked: $missing required variable(s) missing."
  exit 1
fi

echo "Validation complete."
