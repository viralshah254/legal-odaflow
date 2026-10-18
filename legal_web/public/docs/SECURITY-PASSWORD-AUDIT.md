# Password Security Audit & Remediation Report

**Date:** 2026-06-22  
**Scope:** Umbrella legal platform — web, backend API, mobile app  
**Status:** Remediated (defense-in-depth applied); remaining risks documented below

---

## Executive Summary

The application previously accepted passwords as short as **8 characters** with **no complexity, breach, or entropy checks**. Passwords such as `123456`, `password123`, and `qwerty` could be registered via the backend API and mobile app. Firebase email signup on web could bypass backend policy entirely.

This remediation introduces a **centralized password policy** enforced server-side, mirrored on web and mobile clients, with **zxcvbn entropy analysis**, a **common-password deny list**, **personal-info detection**, **Have I Been Pwned (HIBP) breach checking**, **auth endpoint rate limits**, and a **live strength meter** on web signup.

---

## A. Vulnerabilities Found

| # | Vulnerability | Severity | OWASP Top 10 | OWASP ASVS |
|---|---------------|----------|--------------|------------|
| 1 | 8-char minimum only; no complexity | **Critical** | A07 Identification & Authentication Failures | V2.1.7, V2.1.8 |
| 2 | Common/ breached passwords accepted | **Critical** | A07 | V2.1.7 |
| 3 | No server-side entropy analysis | **High** | A07 | V2.1.8 |
| 4 | Firebase signup bypasses backend policy | **High** | A07 | V2.1.1 |
| 5 | No MFA / TOTP / WebAuthn | **High** | A07 | V2.8.1 |
| 6 | No auth-specific rate limiting | **High** | A07 | V2.2.1 |
| 7 | No backend password reset/change API | **Medium** | A07 | V2.1.2 |
| 8 | Portal login (email + name only) | **Medium** | A07 | V2.1.1 |
| 9 | bcrypt cost 10 for SAML/SCIM random passwords | **Low** | A02 Cryptographic Failures | V2.4.1 |
| 10 | Login UI min length ≠ backend (8 vs 1) | **Low** | A07 | V2.1.1 |

---

## B. Risk Severity Summary

- **Critical (fixed):** Weak password acceptance on registration and admin user creation  
- **High (partially fixed):** Breach checking and rate limits added; Firebase path validated client-side only; MFA not implemented  
- **Medium (open):** Password reset/change APIs, portal auth model  
- **Low (fixed/mitigated):** SAML bcrypt rounds unified to 12  

---

## C. Files Modified

### Backend (`legal_backend`)
- `src/auth/password/password-policy.constants.ts` *(new)*
- `src/auth/password/common-passwords.ts` *(new)*
- `src/auth/password/password-policy.util.ts` *(new)*
- `src/auth/password/password-breach.service.ts` *(new)*
- `src/auth/password/password-policy.service.ts` *(new)*
- `src/auth/password/password.module.ts` *(new)*
- `src/auth/password/password-policy.util.spec.ts` *(new)*
- `src/auth/auth.service.ts`
- `src/auth/auth.module.ts`
- `src/auth/auth.controller.ts`
- `src/auth/dto/register.dto.ts`
- `src/auth/dto/login.dto.ts`
- `src/tenants/tenants.service.ts`
- `src/tenants/tenants.module.ts`
- `src/tenants/dto/create-tenant-user.dto.ts`
- `.env.example`
- `package.json` (zxcvbn-ts deps)

### Web (`legal_web`)
- `lib/auth/password-policy.ts` *(new)*
- `lib/auth/password-policy.test.ts` *(new)*
- `components/auth/password-field.tsx` *(new)*
- `app/auth/sign-up/page.tsx`
- `package.json` (zxcvbn-ts deps)

### Mobile (`legal_app`)
- `lib/core/security/password_policy.dart` *(new)*
- `lib/features/auth/sign_up_screen.dart`
- `lib/l10n/app_en.arb`

### i18n
- `shared/i18n/en/auth.json`

---

## D. Code Changes (Representative)

### Issue 1 — Weak 8-character minimum

**File:** `legal_backend/src/auth/dto/register.dto.ts`

**Before:**
```typescript
@MinLength(8)
password!: string;
```

**After:**
```typescript
@MinLength(12)
@MaxLength(128)
password!: string;
```

**Rationale:** ASVS requires minimum 12 characters for user-chosen passwords; 128 max prevents DoS via hashing.

---

### Issue 2 — No server-side policy enforcement

**File:** `legal_backend/src/auth/auth.service.ts`

**Before:** Password hashed immediately after duplicate email check.

**After:**
```typescript
await this.passwordPolicy.assertValidIncludingBreachCheck(dto.password, {
  email: dto.email,
  name: dto.name,
  firmName: dto.firmName,
  phone: dto.phone,
});
const passwordHash = await bcrypt.hash(dto.password, 12);
```

**Rationale:** Server is authoritative; rejects common, sequential, personal-info, weak (zxcvbn score < 3), and HIBP-breached passwords.

---

### Issue 3 — No frontend strength feedback

**File:** `legal_web/components/auth/password-field.tsx` *(new)*

- Live zxcvbn strength meter (Very Weak → Very Strong)
- Password visibility toggle
- Accessible `aria-live` updates
- Guidance: *"Do not use birthdays, names, phone numbers, or common passwords."*

---

### Issue 4 — Auth brute-force surface

**File:** `legal_backend/src/auth/auth.controller.ts`

**After:**
```typescript
@Throttle({ default: { limit: 5, ttl: 60000 } })  // register
@Throttle({ default: { limit: 10, ttl: 60000 } }) // login / firebase login
```

**Rationale:** Tighter limits on credential endpoints vs global 120/min.

---

## E. Security Improvements Implemented

| Control | Implementation |
|---------|----------------|
| Min length 12 / max 128 | DTOs + policy util (web, backend, mobile) |
| Unicode passphrases | No ASCII-only restriction |
| Common password deny list | ~250 entries + zxcvbn dictionaries |
| Sequential / keyboard patterns | Digit runs, letter runs, qwerty/asdf |
| Repeated characters | 4+ identical chars rejected |
| Personal info in password | Email local-part, name, firm, phone digits |
| zxcvbn entropy | Score ≥ 3 required (Strong) |
| HIBP breach check | k-anonymity SHA-1 range API (backend + web pre-submit) |
| bcrypt cost 12 | Registration, tenant users, SAML/SCIM (was 10) |
| Unique salt | bcrypt per hash (built-in) |
| Unit tests | 16 backend + 9 web tests; all weak examples fail |
| Rate limiting | Login/register throttled |

---

## F. Remaining Risks

| Risk | Severity | Recommendation |
|------|----------|----------------|
| **Firebase Auth password policy** | High | Configure Firebase Console minimum length/complexity; add Cloud Function to reject weak passwords on `beforeUserCreated` |
| **No MFA** | High | Implement TOTP (RFC 6238) + WebAuthn/passkeys; ASVS V2.8 |
| **No backend password reset/change** | Medium | Add `POST /auth/forgot-password`, `POST /auth/reset-password`, `PATCH /users/me/password` with same policy |
| **Portal email+name auth** | Medium | Require magic link or password for client portal |
| **Argon2id migration** | Low | Plan bcrypt → Argon2id rehash on next login (ASVS V2.4.1 preference) |
| **100k local deny list** | Low | HIBP covers breach corpus; expand local list or ship compressed bloom filter offline |
| **Existing accounts with weak passwords** | Medium | Force password upgrade on next login |
| **Mobile lacks zxcvbn** | Medium | Backend enforces; add Dart zxcvbn or API check for UX parity |

---

## G. OWASP ASVS Mapping

| ASVS | Requirement | Status |
|------|-------------|--------|
| V2.1.1 | Passwords ≥ 12 chars | ✅ Enforced |
| V2.1.7 | Not commonly used / breached | ✅ Deny list + HIBP |
| V2.1.8 | Strength meter / guidance | ✅ Web UI |
| V2.2.1 | Anti-automation on auth | ✅ Throttle added |
| V2.4.1 | Approved hash (bcrypt/Argon2) | ⚠️ bcrypt-12 (Argon2 recommended) |
| V2.8.1 | MFA | ❌ Not implemented |

---

## H. OWASP Top 10 Mapping

| Top 10 | Relevance |
|--------|-----------|
| **A07 – Identification & Authentication Failures** | Primary category; weak passwords, stuffing, spraying |
| **A02 – Cryptographic Failures** | Password hashing (bcrypt); no plaintext storage verified |
| **A04 – Insecure Design** | Portal auth model, Firebase bypass |

---

## Testing

```bash
# Backend
cd legal_backend && npm test -- password-policy.util.spec.ts

# Web
cd legal_web && npm run test:unit -- lib/auth/password-policy.test.ts
```

All listed weak passwords (`123456`, `password123`, `qwerty`, etc.) **fail** validation in automated tests.

---

## Password Entry Points — Coverage

| Entry point | Policy enforced |
|-------------|-----------------|
| `POST /auth/register` | ✅ Backend + DTO |
| `POST /tenants/:id/users` | ✅ Backend + DTO |
| Web sign-up (API path) | ✅ Zod + HIBP client |
| Web sign-up (Firebase path) | ⚠️ Client only (see remaining risks) |
| Mobile sign-up | ✅ Dart policy + backend |
| Login | Max 128; no strength check (correct) |
| Password reset | ❌ Firebase-only web; no backend |
| OAuth / SAML / SCIM | N/A (no user-chosen password) |

---

## MFA Recommendation (Not Implemented)

Priority order for future work:

1. **TOTP** (Google Authenticator, Authy) — lowest friction  
2. **WebAuthn / Passkeys** — phishing-resistant  
3. **SMS OTP** — avoid as primary MFA (SIM-swap risk)

Store MFA secrets encrypted; require MFA for firm admins and billing actions.
