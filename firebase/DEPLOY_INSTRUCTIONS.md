# Firestore Security Rules — Deployment Instructions (WEB-H-06)

**Firebase project:** `umbrella-95da1`  
**Audit finding:** WEB-H-06 — Client-side Firestore writes for credit wallet (High severity)  
**Date:** 2026-06-18

---

## What you received

This email includes the **`firebase/`** folder as an attachment. It contains:

| File | Purpose |
|------|---------|
| `firestore.rules` | Security rules that block client writes to credit wallet paths |
| `firebase.json` | Firebase CLI config pointing at the rules file |
| `.firebaserc` | Pre-configured project ID (`umbrella-95da1`) |
| `DEPLOY_INSTRUCTIONS.md` | This document |

---

## Why this is important (read before deploying)

Our app stores **AI credit wallet balances** in Firestore at:

```
users/{firebaseUid}/credits/wallet
```

Previously, the **browser could write** to that path. A malicious user could inflate their credit balance if Firestore rules were permissive or missing.

We fixed this in three layers:

1. **Frontend (`legal_web`)** — removed all client-side writes. The browser only **reads** (real-time listener).
2. **Backend (`legal_backend`)** — only the **Admin SDK** writes wallet balances (after REST wallet fetch and after payments).
3. **Firestore rules (this folder)** — **must be deployed to Firebase** to block client write attempts at the database level.

**Deploying the code without deploying these rules leaves a billing-fraud hole open.** The rules deploy is mandatory for the fix to be complete.

---

## Step 1 — Get the code on the `security` branch

You need the matching code changes in **both** backend and frontend. Pull or checkout the **`security`** branch in each repo.

### Backend (`legal_backend`)

```bash
cd legal_backend
git fetch origin
git checkout security
git pull origin security
npm install
```

### Frontend (`legal_web`)

```bash
cd legal_web
git fetch origin
git checkout security
git pull origin security
npm install
```

> **Note:** If the branch name on remote is slightly different (e.g. `security-fixes`), use the branch that contains the WEB-H-06 changes. Ask if unsure.

### Confirm the code changes exist

After pulling `security`, verify:

- **`legal_web/lib/firestore/credits.ts`** — no `seedFirestoreBalance`, no `setDoc`
- **`legal_backend/src/credits/credit-wallet.service.ts`** — contains `syncBalanceToFirestore()`
- **`legal_web/components/consumer/credit-balance-widget.tsx`** — only subscribes to Firestore (no seed call)

---

## Step 2 — Place this `firebase/` folder at the repo root

After downloading the attachment from the email, place the **`firebase/`** folder on your machine so it sits **at the same level** as `legal_backend` and `legal_web`:

```
your-local-folder/
├── legal_backend/
├── legal_web/
└── firebase/          ← place the attached folder here
    ├── .firebaserc
    ├── firebase.json
    ├── firestore.rules
    └── DEPLOY_INSTRUCTIONS.md
```

Do **not** put it inside `legal_backend/` or `legal_web/`. It belongs at the **root**, as a sibling to both.

If you already have a `firebase/` folder there, replace it with the attached version (or merge so `firestore.rules` and `.firebaserc` match this package).

---

## Step 3 — One-time Firebase CLI setup

This deploy is **not** a backend or frontend deploy. It updates **Firebase / Google Cloud** directly using the Firebase CLI.

### Install Firebase CLI

Requires Node.js (LTS). Then:

```bash
npm install -g firebase-tools
```

### Log in

Use the Google account that has access to project **`umbrella-95da1`**:

```bash
firebase login
```

### Confirm project access

```bash
firebase projects:list
```

You should see **`umbrella-95da1`** in the list.

The included `.firebaserc` already sets the default project to `umbrella-95da1`, so you should **not** need to run `firebase use` manually.

---

## Step 4 — Deploy Firestore rules

From the **`firebase/`** folder you placed at the repo root:

```bash
cd firebase
firebase deploy --only firestore:rules
```

**Expected success output** (wording may vary slightly):

```
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

If prompted to select a project, choose **`umbrella-95da1`**.

### Quick reference (copy-paste)

```bash
npm install -g firebase-tools
firebase login
cd firebase
firebase deploy --only firestore:rules
```

---

## Step 5 — Verify in Firebase Console (Rules Simulator)

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select project **`umbrella-95da1`**
3. Go to **Firestore Database** → **Rules** tab
4. Confirm the published rules match `firestore.rules` in this folder (client writes denied on wallet paths)
5. Open **Rules Playground** (or **Rules Simulator**)

### Test A — Client write must FAIL (core security fix)

| Field | Value |
|-------|--------|
| Simulation type | **Create** or **Update** |
| Location | `/users/SOME_TEST_UID/credits/wallet` |
| Authenticated | **Yes** |
| Auth UID | `SOME_TEST_UID` (must match path `{userId}`) |
| Request data | `{ "balance": 999999 }` |

**Expected result:** **Denied** / **Permission denied**

### Test B — Client read should succeed (signed-in owner)

| Field | Value |
|-------|--------|
| Simulation type | **Get** |
| Location | `/users/SOME_TEST_UID/credits/wallet` |
| Authenticated | **Yes** |
| Auth UID | `SOME_TEST_UID` |

**Expected result:** **Allowed**

### Test C — Client write to credit packs must FAIL

| Field | Value |
|-------|--------|
| Simulation type | **Create** |
| Location | `/credit_packs/test-pack` |
| Authenticated | **Yes** |

**Expected result:** **Denied**

---

## Step 6 — End-to-end app test (on `security` branch)

Run backend and frontend locally (or on staging) with the **`security`** branch checked out.

### Backend environment

In `legal_backend/.env`, confirm:

```env
FIREBASE_PROJECT_ID=umbrella-95da1
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

(or equivalent `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`)

The service account must belong to **`umbrella-95da1`**. Admin SDK writes bypass security rules (by design).

### Frontend environment

In `legal_web/.env`, confirm:

```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=umbrella-95da1
NEXT_PUBLIC_USE_FIREBASE_AUTH=true
```

(plus the other `NEXT_PUBLIC_FIREBASE_*` variables for your project)

### Manual test flow

1. Start backend:
   ```bash
   cd legal_backend
   npm run start:dev
   ```
2. Start frontend:
   ```bash
   cd legal_web
   npm run dev
   ```
3. Sign in with a Firebase-authenticated user.
4. Open a page that shows **AI credits** (credit balance widget).
5. Confirm the balance displays (REST API first, then optional live Firestore update).
6. In browser DevTools → **Network**, confirm wallet fetch hits `/api/v1/credits/wallet` or `/credits/plan-usage`.
7. In Firebase Console → **Firestore**, open:
   ```
   users/{that user's Firebase UID}/credits/wallet
   ```
   The document should be created or updated by the **backend** (Admin SDK), not the browser.
8. In DevTools → **Console**, there should be **no** permission errors on the Firestore **read** listener.

If a signed-in user tries to write to the wallet path from the browser, it should fail with **permission-denied** — that confirms rules are enforced.

---

## What changed in code (summary)

| Area | Change |
|------|--------|
| `legal_web` | Removed `seedFirestoreBalance()` — browser no longer writes to wallet |
| `legal_backend` | Added `syncBalanceToFirestore()` — Admin SDK seeds wallet on `/credits/wallet` and `/credits/plan-usage` |
| `firebase/` (this folder) | Rules: wallet read-only for owner; **all client writes denied** on wallet and credit_packs |

Full audit write-up: `SECURITY_AUDIT_legal_web.md` → **WEB-H-06** (marked Fixed).

---

## Completion checklist

Reply confirming each item:

- [ ] Checked out **`security`** branch on `legal_backend` and `legal_web`
- [ ] Placed attached **`firebase/`** folder at repo root (sibling to backend and frontend)
- [ ] Ran `firebase deploy --only firestore:rules` against **`umbrella-95da1`**
- [ ] Rules Simulator: client **write** to `users/*/credits/wallet` → **Denied**
- [ ] Rules Simulator: client **read** own wallet → **Allowed**
- [ ] App test: credit balance loads; Firestore wallet doc updated after wallet API call
- [ ] No permission errors on Firestore read listener in browser console

---

## Troubleshooting

| Problem | Likely cause | What to do |
|---------|----------------|------------|
| `firebase: command not found` | CLI not installed | `npm install -g firebase-tools` |
| Wrong project / permission denied | Wrong Google account | `firebase login` with owner of `umbrella-95da1` |
| Backend not writing to Firestore | Missing/invalid service account | Check `FIREBASE_SERVICE_ACCOUNT_PATH` and backend logs for `[Firestore] syncBalanceToFirestore` |
| Frontend listener permission denied | Rules not deployed, or user not signed in to Firebase Auth | Redeploy rules; confirm Firebase Auth session |
| Balance shows but never updates live | Backend sync or UID mismatch | Compare Firebase Auth UID with Firestore path; check backend logs |

---

## Re-deploying later

Whenever `firestore.rules` changes in the repo:

```bash
cd firebase
firebase deploy --only firestore:rules
```

No backend or frontend redeploy is required **only** for rules changes — but app code and rules should stay in sync across environments.

---

**Project ID:** `umbrella-95da1`  
**Contact:** Reply to the sender of this email when the checklist is complete.
