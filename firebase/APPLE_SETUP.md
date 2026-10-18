# Apple Sign-In — Setup for Umbrella (`umbrella-95da1`)

Web and iOS code is already wired. Complete these Apple Developer + Firebase steps to enable **Continue with Apple**.

## Values for this project

| Setting | Value |
|--------|--------|
| Firebase project | `umbrella-95da1` |
| Firebase auth domain (client config) | `umbrella.okaylegal.ai` |
| Firebase auth handler (proxied) | `umbrella-95da1.firebaseapp.com` |
| OAuth redirect URL (primary) | `https://umbrella.okaylegal.ai/__/auth/handler` |
| OAuth redirect URL (legacy) | `https://umbrella-95da1.firebaseapp.com/__/auth/handler` |
| Web app domain | `umbrella.okaylegal.ai` |
| iOS bundle ID | `com.dvtechventures.umbrella` |
| Suggested Services ID | `com.dvtechventures.umbrella.signin` |
| Server-to-server notifications URL | `https://legal-api.odaflow.com/api/v1/auth/apple/notifications` |

---

## Server-to-server notification endpoint (Apple Developer)

When configuring **Sign In with Apple** on your Services ID, Apple asks for a **Server-to-Server Notification Endpoint**. This is **optional for sign-in to work**, but recommended so Umbrella is notified when users revoke consent, delete their Apple account, or change Hide My Email relay settings.

**Paste this URL in Apple Developer:**

```
https://legal-api.odaflow.com/api/v1/auth/apple/notifications
```

Requirements:
- Must be **HTTPS** with TLS 1.2+
- Must be publicly reachable (Apple’s servers POST to it)
- Deploy the backend with the `AppleNotificationsService` handler (already in `legal_backend`)

What Umbrella does when notified:
- **consent-revoked** / **account-delete** → deactivate the Umbrella user and revoke refresh tokens
- **email-enabled** → update stored email when Apple provides a new relay address
- **email-disabled** → logged (user may need to sign in again)

Optional env override if audiences differ:

```env
APPLE_NOTIFICATION_AUDIENCES=com.dvtechventures.umbrella.signin,com.dvtechventures.umbrella
```

You can **leave the field blank** while testing Apple sign-in, then add the URL before App Store release.

---

## 1. Apple Developer — App ID (iOS)

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers** → select `com.dvtechventures.umbrella` (or create it).
2. Enable **Sign In with Apple** → **Save**.
3. iOS entitlements are already in `legal_app/ios/Runner/Runner.entitlements`.

---

## 2. Apple Developer — Services ID (web)

1. **Identifiers** → **+** → **Services IDs** → Continue.
2. Description: `Umbrella Web Sign In`
3. Identifier: `com.dvtechventures.umbrella.signin` (must match Firebase Apple provider Services ID).
4. Enable **Sign In with Apple** → **Configure**:
   - **Primary App ID:** `com.dvtechventures.umbrella`
   - **Domains and Subdomains:** `umbrella.okaylegal.ai`
   - **Return URLs** (both):
     - `https://umbrella.okaylegal.ai/__/auth/handler` ← required for Safari / mobile web
     - `https://umbrella-95da1.firebaseapp.com/__/auth/handler` ← keep as fallback
   - **Server-to-Server Notification Endpoint (optional):** `https://legal-api.odaflow.com/api/v1/auth/apple/notifications`
5. **Save** → **Continue** → **Register**.

Apple shows a **domain verification** file. Copy the entire JSON body.

---

## 3. Host domain verification on `umbrella.okaylegal.ai`

Apple checks:

`https://umbrella.okaylegal.ai/.well-known/apple-developer-domain-association`

### Option A — Vercel env (recommended)

In **Vercel → legal_web → Environment Variables** (Production):

```
APPLE_DOMAIN_ASSOCIATION=<paste the full JSON from Apple Developer>
```

Redeploy after saving. The Next.js route serves it at the path above.

### Option B — Static file

Paste the JSON into:

`legal_web/public/.well-known/apple-developer-domain-association`

(no file extension), commit, and deploy.

Verify after deploy:

```bash
curl -s https://umbrella.okaylegal.ai/.well-known/apple-developer-domain-association
```

---

## 4. Apple Developer — Sign In with Apple key

1. **Keys** → **+** → name e.g. `Umbrella Firebase Apple Sign In`.
2. Enable **Sign In with Apple** → **Configure** → select Primary App ID `com.dvtechventures.umbrella`.
3. **Register** → download the `.p8` key (**once only**). Note **Key ID** and your **Team ID** (top-right of developer portal).

---

## 5. Firebase Console — Enable Apple provider

1. [Firebase Console](https://console.firebase.google.com/) → `umbrella-95da1` → **Authentication** → **Sign-in method**.
2. **Apple** → **Enable**.
3. Fill in:
   - **Services ID:** `com.dvtechventures.umbrella.signin`
   - **Apple team ID:** (10-character Team ID)
   - **Key ID:** from step 4
   - **Private key:** paste contents of the `.p8` file
4. **Save**.

---

## 6. Firebase — Authorized domains

**Authentication → Settings → Authorized domains** must include:

- `umbrella.okaylegal.ai`
- `localhost` (Firebase Auth; Apple web sign-in still requires production domain verification)

---

## 7. Test

### Production web

1. Open `https://umbrella.okaylegal.ai/auth/sign-in/`
2. Click **Continue with Apple**
3. New users should see **Finish your profile** (account type + country) after Apple auth.

### Local web

With `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=umbrella-95da1.firebaseapp.com` (default in `.env.local`), Apple redirect goes to the Firebase HTTPS handler, then back to `http://localhost:3000/auth`. Use regular `npm run dev` — no local HTTPS needed.

Do **not** set auth domain to `localhost:3000` unless you also run `npm run dev:https` and add `https://localhost:3000/__/auth/handler` to Apple Return URLs.

### iOS (Flutter)

Run on a physical device or simulator with an Apple ID:

```bash
cd legal_app && flutter run
```

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `auth/operation-not-allowed` | Enable Apple in Firebase Authentication |
| `Invalid client` / redirect error | Services ID return URLs must include `https://umbrella.okaylegal.ai/__/auth/handler` |
| Stuck on `firebaseapp.com` “CONTINUE TO THE APP” (blank) | Safari blocks cross-site storage. Set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=umbrella.okaylegal.ai`, deploy the `/__/auth` Next.js proxy, and add the custom-domain Return URL in Apple Developer |
| Blank white page on `umbrella.okaylegal.ai/__/auth/handler/` | Trailing slash breaks Firebase relative scripts. Middleware must keep `/__/auth/handler` (no trailing slash). Redeploy after the `skipTrailingSlashRedirect` fix |
| Auth iframe blocked / `X-Frame-Options: DENY` on `/__/auth/*` | Catch-all security headers must not apply to `/__/auth/*`. Confirm `curl -sI …/__/auth/iframe` shows `SAMEORIGIN` |
| Domain not verified | Deploy `APPLE_DOMAIN_ASSOCIATION` and confirm curl returns JSON (not 404) |
| No name pre-filled | Apple sends name only on first authorization; user can enter it on the finish-profile step |
| Hide My Email | Private relay addresses work; backend accepts any email in the Firebase token |

---

## Safari / mobile web redirect (required)

Modern Safari (and iOS browsers) block third-party cookies between `*.firebaseapp.com` and your app. Umbrella proxies Firebase Auth helpers onto the app origin:

1. **Vercel env:** `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=umbrella.okaylegal.ai`
2. **Code:** `legal_web/next.config.js` rewrites `/__/auth/:path*` → `https://umbrella-95da1.firebaseapp.com/__/auth/:path*`
3. **Apple Return URL:** `https://umbrella.okaylegal.ai/__/auth/handler`
4. Redeploy `legal_web` after changing the env var

Verify the proxy after deploy:

```bash
curl -sI "https://umbrella.okaylegal.ai/__/auth/handler" | head -n 5
```

You should get a Firebase Auth handler response (not a Next 404).

Confirm frame headers (auth iframe must be SAMEORIGIN; site root stays DENY):

```bash
curl -sI "https://umbrella.okaylegal.ai/__/auth/iframe" | grep -i x-frame-options
# expect: X-Frame-Options: SAMEORIGIN

curl -sI "https://umbrella.okaylegal.ai/" | grep -i x-frame-options
# expect: X-Frame-Options: DENY
```

If `/__/auth/iframe` returns `DENY`, the Firebase auth iframe is blocked and social sign-in fails.
---

## Checklist

- [ ] App ID `com.dvtechventures.umbrella` has Sign In with Apple
- [ ] Services ID created with domain + **both** return URLs (app host + firebaseapp.com)
- [ ] Domain verification file live on `umbrella.okaylegal.ai`
- [ ] Sign In with Apple key (.p8) created
- [ ] Firebase Apple provider enabled with Services ID, Team ID, Key ID, private key
- [ ] `umbrella.okaylegal.ai` in Firebase authorized domains
- [ ] Vercel `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=umbrella.okaylegal.ai` (not `*.firebaseapp.com`)
- [ ] Vercel `APPLE_DOMAIN_ASSOCIATION` set and redeployed
- [ ] `/__/auth/handler` reachable on the app host after deploy
- [ ] `/__/auth/iframe` returns `X-Frame-Options: SAMEORIGIN` (site root stays `DENY`)
