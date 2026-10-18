# Store permissions — Umbrella mobile (`legal_app`)

Reference for App Store Connect and Google Play Console declarations. Only permissions tied to shipped features are declared in the native manifests.

## Feature → permission map

| Feature | iOS | Android |
|---------|-----|---------|
| Sign in (Google / Apple / email) | Sign in with Apple entitlement, Google URL scheme | Internet |
| Push notifications (FCM) | `remote-notification` background mode, APNs entitlement | `POST_NOTIFICATIONS`, `WAKE_LOCK` |
| Meeting recording | `NSMicrophoneUsageDescription`, `audio` background mode | `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `MODIFY_AUDIO_SETTINGS` |
| Live captions (iOS) | `NSSpeechRecognitionUsageDescription` | (uses mic) |
| Document / image attach | `NSPhotoLibraryUsageDescription` | Storage Access Framework intent (no broad storage permission) |
| Country detection | IP / locale / timezone only — **no GPS** | Internet |
| Secure session storage | Keychain | EncryptedSharedPreferences / Keystore (no extra permission) |

## Intentionally **not** requested

- **Camera** — document upload uses the system file/photo picker, not a live camera capture flow.
- **Location (GPS)** — jurisdiction is inferred from IP, device locale, and timezone.
- **Contacts, SMS, phone state, calendar** — not used.
- **Advertising ID** — stripped from the Android manifest (`AD_ID` removed).
- **iOS background fetch** — removed; not used by the app.

## iOS checklist (App Store Connect)

- [ ] **Privacy Nutrition Labels** — align with [privacy policy](https://umbrella.okaylegal.ai/privacy): account info, user content (documents, recordings), diagnostics (Sentry when enabled).
- [ ] **App Privacy manifest** — `ios/Runner/PrivacyInfo.xcprivacy` bundled in the Runner target.
- [ ] **Export compliance** — `ITSAppUsesNonExemptEncryption = false` (HTTPS only).
- [ ] **Push** — `Runner.entitlements`: `aps-environment = production` for release; APNs key in Firebase.
- [ ] **Sign in with Apple** — entitlement present; required because Google sign-in is offered.
- [ ] **Review notes** — demo account + explain microphone use (lawyer meeting recordings).

## Android checklist (Play Console)

- [ ] **Target API** — meet current Play requirement (Flutter `targetSdkVersion`; verify before each release).
- [ ] **Data safety form** — declare: email, name, documents, audio recordings, device identifiers (FCM token), crash logs (Sentry if enabled). No location, no contacts, no AD ID.
- [ ] **Photo/video permissions** — not declared; file picking uses the system document UI (SAF).
- [ ] **Foreground service** — declare **microphone** type if Play asks (meeting recording).
- [ ] **Notification permission** — shown on first launch via Firebase Messaging; rationale: case updates and task reminders.
- [ ] **Release signing** — see [APP-STORE-RELEASE.md](../APP-STORE-RELEASE.md).

## Pre-submit smoke tests

1. Fresh install → sign in → notification permission prompt appears (grant/deny both OK).
2. Lawyer → Record meeting → microphone prompt → record 10s → upload succeeds.
3. iOS record screen → live captions prompt (speech recognition) → optional grant.
4. Attach PDF/image from Files/Photos on consumer upload and lawyer matter documents.
5. Deny microphone → app shows Settings hint, does not crash.

## Files

| Platform | File |
|----------|------|
| iOS permissions copy | `ios/Runner/Info.plist` |
| iOS entitlements | `ios/Runner/Runner.entitlements` |
| iOS privacy manifest | `ios/Runner/PrivacyInfo.xcprivacy` |
| iOS permission_handler flags | `ios/Podfile` (`PERMISSION_MICROPHONE`, `PERMISSION_SPEECH_RECOGNIZER`) |
| Android manifest | `android/app/src/main/AndroidManifest.xml` |
