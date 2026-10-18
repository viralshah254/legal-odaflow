#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/certificates"
KEY="$CERT_DIR/localhost-key.pem"
CERT="$CERT_DIR/localhost.pem"

mkdir -p "$CERT_DIR"

if [[ -f "$KEY" && -f "$CERT" ]]; then
  exit 0
fi

echo "Generating self-signed HTTPS cert for local OAuth (localhost + 127.0.0.1)..."
openssl req -x509 -newkey rsa:2048 \
  -keyout "$KEY" \
  -out "$CERT" \
  -days 365 \
  -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:localhost:3000,IP:127.0.0.1" 2>/dev/null \
  || openssl req -x509 -newkey rsa:2048 \
    -keyout "$KEY" \
    -out "$CERT" \
    -days 365 \
    -nodes \
    -subj "/CN=localhost"

echo "Wrote $CERT and $KEY"
