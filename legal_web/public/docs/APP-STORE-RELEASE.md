# App Store Release Guide

Checklist for shipping the Flutter app in `legal_app/` to Apple App Store and Google Play.

---

## iOS — APNs production (Firebase + Apple)

### Apple Developer

1. In [Apple Developer](https://developer.apple.com/account/resources/certificates/list), create an **Apple Push Notifications service (APNs) Auth Key** (.p8). Note Key ID and Team ID.
2. Enable **Push Notifications** capability on the App ID (`com.dvtechventures.umbrella`).
3. For release builds, set `aps-environment` to **production** in `ios/Runner/Runner.entitlements` (development is fine for local/debug only).

### Firebase Console

1. Project → **Project settings** → **Cloud Messaging** → **Apple app configuration**.
2. Upload the APNs Auth Key (.p8), Key ID, and Team ID (or upload APNs certificate if using legacy flow).
3. Confirm `ios/Runner/GoogleService-Info.plist` matches the Firebase iOS app bundle ID.
4. Enable **Cloud Messaging** in Firebase; verify FCM token registration from a release/TestFlight build.

### Backend (FCM server send)

Set Firebase Admin credentials in `legal_backend/.env`:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Worker/notify jobs use these to deliver push notifications to registered device tokens.

### Pre-submit smoke test

- Install a **release** or TestFlight build (simulator does not receive remote push).
- Sign in, grant notification permission, trigger a test notification from backend/admin.
- Confirm foreground (`FirebaseMessaging.onMessage`) and background delivery.

---

## Android — release signing

Release builds must not ship with the debug keystore. Configure signing in `legal_app/android/app/build.gradle.kts`.

### 1. Create a upload keystore (once)

```bash
./legal_app/scripts/setup-android-signing.sh
```

Or manually:

```bash
keytool -genkey -v -keystore ~/legal-upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias legal-upload
```

Store the keystore and passwords in your secrets manager (never commit).

### 2. Add `android/key.properties` (gitignored)

Copy `android/key.properties.example` → `android/key.properties` and fill in paths/passwords.

```properties
storeFile=keystores/umbrella-upload.jks
storePassword=...
keyAlias=umbrella-upload
keyPassword=...
```

### 3. Register SHA fingerprints in Firebase

```bash
./legal_app/scripts/print-android-sha.sh
```

Add debug + release SHA-1 and SHA-256 in [Firebase Console](https://console.firebase.google.com/project/umbrella-95da1/settings/general) → Android app → Add fingerprint. Re-download `google-services.json` afterward.

Signing is already wired in `build.gradle.kts` when `key.properties` exists.

### 4. Play App Signing

Enroll in [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756). Upload the first AAB with your upload key; Google holds the app signing key.

### 5. Firebase Android

Ensure `android/app/google-services.json` matches the Play package name (`com.dvtechventures.umbrella`) and SHA-1/SHA-256 of your **debug**, **upload**, and **Play app signing** certificates are registered in Firebase. Run `./legal_app/scripts/print-android-sha.sh` for values.

### Build command

```bash
cd legal_app
flutter build appbundle --release \
  --dart-define=API_URL=https://legal-api.odaflow.com/api/v1 \
  --dart-define=DEFAULT_COUNTRY=IN
```

---

## Store listing asset checklist

### Both stores

- [ ] App name and subtitle (≤30 chars subtitle on iOS)
- [ ] Short description (Play, ≤80 chars) and full description
- [ ] Primary category: **Business** (or **Productivity**)
- [ ] Privacy policy URL (required; must match in-app disclosures)
- [ ] Support URL and contact email
- [ ] Keywords / tags (iOS 100-char keyword field)
- [ ] Age rating questionnaire completed
- [ ] Export compliance / encryption questionnaire (iOS)
- [ ] Data safety form (Play) — auth, documents, payments, analytics declared accurately
- [ ] Permissions & privacy manifests — see [`legal_app/STORE-PERMISSIONS.md`](legal_app/STORE-PERMISSIONS.md)

### Graphics

| Asset | Apple App Store | Google Play |
|-------|-----------------|-------------|
| App icon | 1024×1024 PNG (no alpha) | 512×512 PNG |
| Phone screenshots | 6.7" and 5.5" (min 3) | 2–8 phone screenshots |
| Tablet screenshots | iPad 12.9" if supporting tablet | 7" and 10" if supporting tablet |
| Feature graphic | — | 1024×500 JPG/PNG |
| Promo video | Optional | Optional YouTube link |

Recommended screenshot themes: dashboard, matters, client portal pay flow, mobile notifications, lawyer OS time capture.

### iOS-specific

- [ ] App Store Connect app record + bundle ID
- [ ] Permissions & Privacy manifest — [`legal_app/STORE-PERMISSIONS.md`](legal_app/STORE-PERMISSIONS.md)
- [ ] TestFlight internal/external testers
- [ ] Review notes with demo account credentials
- [ ] Push notification entitlement matches production APNs

### Android-specific

- [ ] Play Console app + signed AAB upload
- [ ] **Release notes** — copy from [`legal_app/store/play/release-notes/1.0.5-en-GB.txt`](legal_app/store/play/release-notes/1.0.5-en-GB.txt) into Play Console → Release → Release notes (en-GB)
- [ ] Content rating (IARC)
- [ ] Target API level meets Play current requirement
- [ ] Notification permission rationale (Android 13+) in listing and in-app

---

## Release order

1. Backend + worker deployed with Firebase Admin and payment keys.
2. Web portal live (client pay links referenced from app if applicable).
3. iOS TestFlight → App Store review.
4. Android internal testing → production rollout (staged % recommended).
