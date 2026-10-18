#!/usr/bin/env bash
# Generate the Android upload keystore and key.properties for Umbrella.
# Run from repo root: ./legal_app/scripts/setup-android-signing.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_DIR="$ROOT/legal_app/android"
KEYSTORE_DIR="$ANDROID_DIR/keystores"
KEYSTORE_FILE="$KEYSTORE_DIR/umbrella-upload.jks"
KEY_PROPS="$ANDROID_DIR/key.properties"
KEY_ALIAS="umbrella-upload"

mkdir -p "$KEYSTORE_DIR"

if [[ -f "$KEYSTORE_FILE" ]]; then
  echo "Keystore already exists: $KEYSTORE_FILE"
  echo "Delete it first if you want to regenerate."
  exit 1
fi

if [[ -f "$KEY_PROPS" ]]; then
  echo "key.properties already exists: $KEY_PROPS"
  echo "Remove or rename it before running this script."
  exit 1
fi

echo "Creating Android upload keystore for com.dvtechventures.umbrella"
echo "You will be prompted for keystore and key passwords."
echo "Store both passwords in your secrets manager — they cannot be recovered."
echo

keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Umbrella Legal, OU=Mobile, O=DV Tech Ventures, L=Nairobi, ST=Nairobi, C=KE"

cat > "$KEY_PROPS" <<EOF
storeFile=keystores/umbrella-upload.jks
storePassword=PASTE_STORE_PASSWORD_HERE
keyAlias=$KEY_ALIAS
keyPassword=PASTE_KEY_PASSWORD_HERE
EOF

echo
echo "Created:"
echo "  Keystore: $KEYSTORE_FILE"
echo "  Template: $KEY_PROPS"
echo
echo "Edit key.properties and replace PASTE_* placeholders with the passwords you chose."
echo "Then run: ./legal_app/scripts/print-android-sha.sh"
echo
echo "Add both SHA-1 and SHA-256 to Firebase Console:"
echo "  https://console.firebase.google.com/project/umbrella-95da1/settings/general"
echo "  → Your apps → Android (com.dvtechventures.umbrella) → Add fingerprint"
echo
echo "After adding fingerprints, re-download google-services.json and replace:"
echo "  legal_app/android/app/google-services.json"
