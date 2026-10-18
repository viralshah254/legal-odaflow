# Google & Apple Sign-In — Firebase Console Setup

Enable OAuth providers before testing Google/Apple buttons in `legal_web` or `legal_app`.

## Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) → your project (e.g. `umbrella-95da1` or `legal-6a437`).
2. **Authentication → Sign-in method**
   - Enable **Google** (set support email).
   - Enable **Apple** (Services ID, Team ID, Key ID, private key from Apple Developer).
3. **Authentication → Settings → Authorized domains**
   - Add: `umbrella.okaylegal.ai`, `localhost`, and any staging hosts.

## Google Cloud Console (required after custom authDomain)

With `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=umbrella.okaylegal.ai`, Google OAuth redirects to the app host. Add that URI on the **Web** OAuth 2.0 client (Google Cloud → APIs & Services → Credentials), or you get `Error 400: redirect_uri_mismatch`.

**Authorized redirect URIs** (keep all that apply):

- `https://umbrella.okaylegal.ai/__/auth/handler` ← production
- `https://localhost:3000/__/auth/handler` ← local dev (`npm run dev:https` in `legal_web`)
- `https://umbrella-95da1.firebaseapp.com/__/auth/handler` ← fallback

## Apple Developer (web + iOS)

See **[APPLE_SETUP.md](./APPLE_SETUP.md)** for step-by-step Umbrella-specific instructions.

Summary:

1. **App ID** (iOS): enable **Sign In with Apple** on `com.dvtechventures.umbrella`.
2. **Services ID** (web): `com.dvtechventures.umbrella.signin` with Return URLs:
   - `https://umbrella.okaylegal.ai/__/auth/handler` (required for Safari / mobile)
   - `https://umbrella-95da1.firebaseapp.com/__/auth/handler`
   and domain `umbrella.okaylegal.ai`.
3. **Domain verification**: set `APPLE_DOMAIN_ASSOCIATION` on Vercel or add `public/.well-known/apple-developer-domain-association`.
4. **Key**: create Sign In with Apple key; upload to Firebase Apple provider config.
5. **Auth domain (web):** set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=umbrella.okaylegal.ai` so redirect OAuth stays first-party (Next.js proxies `/__/auth/*`). See **[APPLE_SETUP.md](./APPLE_SETUP.md)** § Safari / mobile web redirect.

## Flutter-specific

### Android keystore + Firebase SHA (required for Google Sign-In)

Google Sign-In on Android fails until the app's signing certificate fingerprints are registered in Firebase.

**1. Create release keystore** (once):

```bash
./legal_app/scripts/setup-android-signing.sh
```

Edit `legal_app/android/key.properties` with the passwords you chose (see `key.properties.example`).

Release signing is already wired in `legal_app/android/app/build.gradle.kts` — it uses `key.properties` when present.

**2. Print SHA-1 / SHA-256** (debug + release):

```bash
./legal_app/scripts/print-android-sha.sh
```

**3. Register in Firebase Console**

1. [Firebase → umbrella-95da1 → Project settings](https://console.firebase.google.com/project/umbrella-95da1/settings/general)
2. **Your apps** → Android `com.dvtechventures.umbrella`
3. **Add fingerprint** for each SHA-1 and SHA-256 from the script output:
   - **Debug** — required for `flutter run` on a device/emulator
   - **Release upload key** — required for release APK/AAB builds
   - **Play App signing key** — add after first Play Console upload (Play Console → Setup → App signing)

**4. Re-download `google-services.json`**

After adding fingerprints, download the updated config and replace:

`legal_app/android/app/google-services.json`

The file should include an Android OAuth client entry (`client_type: 1`) once SHA-1 is registered. If you only see `client_type: 3` (web), fingerprints are not registered yet.

**5. Web client ID for Android**

Pass the same web OAuth client ID used by `legal_web`:

```bash
--dart-define=GOOGLE_WEB_CLIENT_ID=1034275934580-rm58bb4bj2csrpasbmngbfqd1ndqv96q.apps.googleusercontent.com
```

Already defaulted in `AppConfig` and `config/dart_defines.*.json`.

### iOS

- Ensure `GoogleService-Info.plist` is present and `REVERSED_CLIENT_ID` URL scheme is in Xcode.
- See **[APPLE_SETUP.md](./APPLE_SETUP.md)** for Sign In with Apple.

## Backend

Confirm production env has Firebase Admin credentials:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./umbrella-95da1-firebase-adminsdk-fbsvc-11e5b5d0f4.json
# or
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

No backend code changes are required — `/auth/firebase/login` accepts ID tokens from any enabled Firebase provider.

## Firebase Hosting (`__/firebase/init.json`)

Apple/Google redirect flows load `https://<authDomain>/__/firebase/init.json` from Firebase’s auth handler. If Firebase Hosting was never deployed for the project, that URL returns **404 Site Not Found** and redirect sign-in can fail silently.

Deploy once (from repo root):

```bash
cd firebase
firebase deploy --only hosting
```

This publishes `hosting/public/__/firebase/init.json` to `https://umbrella-95da1.firebaseapp.com/__/firebase/init.json`.

When the app runs on `umbrella.okaylegal.ai` or `localhost:3000`, Next.js middleware also serves `/__/firebase/init.json` with the matching `authDomain`.

## Verification checklist

- [ ] Firebase Hosting deployed (`firebase deploy --only hosting`) so `__/firebase/init.json` is not 404
- [ ] Google Web OAuth client has redirect URI `https://umbrella.okaylegal.ai/__/auth/handler`
- [ ] Apple provider enabled with Services ID + key
- [ ] `umbrella.okaylegal.ai` in authorized domains
- [ ] Apple domain verification file hosted
- [ ] `/__/auth/iframe` returns `X-Frame-Options: SAMEORIGIN` (not DENY)
- [ ] Android SHA fingerprints added (Flutter)
- [ ] iOS Sign In with Apple entitlement enabled (Flutter)
- [ ] Backend Firebase Admin creds set in prod
