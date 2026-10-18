#!/usr/bin/env bash
# Print SHA-1 and SHA-256 for Firebase Google Sign-In (debug + release).
# Run from repo root: ./legal_app/scripts/print-android-sha.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_DIR="$ROOT/legal_app/android"
KEY_PROPS="$ANDROID_DIR/key.properties"
DEBUG_KEYSTORE="${HOME}/.android/debug.keystore"

print_fingerprints() {
  local label="$1"
  local keystore="$2"
  local alias="$3"
  local storepass="$4"
  local keypass="${5:-$storepass}"

  echo "=== $label ==="
  if [[ ! -f "$keystore" ]]; then
    echo "Keystore not found: $keystore"
    echo
    return
  fi

  keytool -list -v \
    -keystore "$keystore" \
    -alias "$alias" \
    -storepass "$storepass" \
    -keypass "$keypass" 2>/dev/null | grep -E "SHA1|SHA256" || {
    echo "Could not read keystore (wrong password or alias)."
  }
  echo
}

print_fingerprints "Debug (local flutter run / emulator)" "$DEBUG_KEYSTORE" "androiddebugkey" "android" "android"

if [[ -f "$KEY_PROPS" ]]; then
  store_file="$(grep '^storeFile=' "$KEY_PROPS" | cut -d= -f2-)"
  store_password="$(grep '^storePassword=' "$KEY_PROPS" | cut -d= -f2-)"
  key_alias="$(grep '^keyAlias=' "$KEY_PROPS" | cut -d= -f2-)"
  key_password="$(grep '^keyPassword=' "$KEY_PROPS" | cut -d= -f2-)"

  if [[ "$store_file" != /* ]]; then
    store_file="$ANDROID_DIR/$store_file"
  fi

  if [[ "$store_password" == *PASTE_* ]] || [[ "$key_password" == *PASTE_* ]]; then
    echo "=== Release (upload keystore) ==="
    echo "key.properties still has placeholder passwords — edit it first."
    echo
  else
    print_fingerprints "Release (upload keystore)" "$store_file" "$key_alias" "$store_password" "$key_password"
  fi
else
  echo "=== Release (upload keystore) ==="
  echo "No key.properties found. Run: ./legal_app/scripts/setup-android-signing.sh"
  echo
fi

cat <<'EOF'
Firebase steps (umbrella-95da1):
1. Open Project settings → Your apps → Android app (com.dvtechventures.umbrella)
2. Add SHA-1 and SHA-256 for BOTH debug and release fingerprints above
3. Re-download google-services.json → legal_app/android/app/google-services.json
4. Confirm Google Sign-In provider is enabled under Authentication → Sign-in method

Play App Signing: after first upload, also add Google Play's app-signing SHA
from Play Console → Setup → App signing → App signing key certificate.
EOF
