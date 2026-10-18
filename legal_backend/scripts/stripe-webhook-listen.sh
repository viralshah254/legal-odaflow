#!/usr/bin/env bash
# Forward Stripe webhooks to local API. Run in a separate terminal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

STRIPE_SECRET_KEY="$(grep -E '^STRIPE_SECRET_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$STRIPE_SECRET_KEY" ]]; then
  echo "STRIPE_SECRET_KEY not set in .env"
  exit 1
fi

FORWARD_URL="${STRIPE_WEBHOOK_FORWARD:-http://localhost:4000/api/v1/subscriptions/webhooks/stripe}"
echo "Forwarding Stripe events to $FORWARD_URL"
echo "Copy the whsec_... secret into STRIPE_WEBHOOK_SECRET in .env, then restart the backend."
echo ""

exec stripe listen \
  --api-key "$STRIPE_SECRET_KEY" \
  --forward-to "$FORWARD_URL" \
  --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted
