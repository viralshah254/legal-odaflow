"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GoogleAuthProvider, OAuthProvider, signInWithRedirect } from "firebase/auth";
import { SocialAuthButtons, type SocialAuthProvider } from "@/components/auth/social-auth-buttons";
import {
  completeOAuthRedirectLogin,
  isOAuthRedirectTimeout,
} from "@/lib/auth/oauth-flow";
import { type FirebaseLoginRequest } from "@/lib/api/firebase-auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { saveOAuthRedirectPending } from "@/lib/auth/oauth-redirect-pending";
import { getDeviceId } from "@/lib/device/device-id";
import type { AuthResponse } from "@/lib/api/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const OFFICE_RETURN_KEY = "umbrella_office_addin_return_url";

async function directApiLogin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as AuthResponse & { message?: string };
  if (!res.ok) throw new Error(body.message ?? "Invalid email or password");
  return body;
}

async function directFirebaseLogin(data: FirebaseLoginRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/firebase/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json().catch(() => ({}))) as AuthResponse & { message?: string };
  if (!res.ok) throw new Error(body.message ?? "Sign-in failed");
  return body;
}

const ALLOWED_RETURN_HOSTS = new Set(["127.0.0.1:3001", "localhost:3001"]);

function isAllowedReturnUrl(returnUrl: string): boolean {
  try {
    const url = new URL(returnUrl);
    return (
      url.protocol === "https:" &&
      ALLOWED_RETURN_HOSTS.has(url.host) &&
      url.pathname.endsWith("/auth-bridge.html")
    );
  } catch {
    return false;
  }
}

function handoffToAddIn(returnUrl: string, response: AuthResponse) {
  const params = new URLSearchParams({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    userId: response.user.id,
    tenantId: response.user.tenantId ?? "",
    displayName: response.user.name ?? response.user.email,
  });
  window.location.href = `${returnUrl}#${params.toString()}`;
}

function rememberReturnUrl(returnUrl: string) {
  try {
    sessionStorage.setItem(OFFICE_RETURN_KEY, returnUrl);
  } catch {
    // ignore
  }
}

function readRememberedReturnUrl(): string {
  try {
    return sessionStorage.getItem(OFFICE_RETURN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Office dialog WebViews block OAuth popups — always use full-page redirect. */
async function startOfficeOAuthRedirect(provider: SocialAuthProvider) {
  saveOAuthRedirectPending(provider);
  const auth = getFirebaseAuth();
  if (provider === "google") {
    const google = new GoogleAuthProvider();
    google.addScope("email");
    google.addScope("profile");
    await signInWithRedirect(auth, google);
    return;
  }
  const apple = new OAuthProvider("apple.com");
  apple.addScope("email");
  apple.addScope("name");
  await signInWithRedirect(auth, apple);
}

export default function OfficeAddInAuthPage() {
  const searchParams = useSearchParams();
  const queryReturnUrl = searchParams.get("returnUrl") ?? "";
  const returnUrl = isAllowedReturnUrl(queryReturnUrl)
    ? queryReturnUrl
    : readRememberedReturnUrl();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<SocialAuthProvider | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const redirectChecked = useRef(false);

  const complete = useCallback((response: AuthResponse) => {
    if (!isAllowedReturnUrl(returnUrl)) {
      setError("Invalid return URL for Office add-in.");
      return;
    }
    if (!response.accessToken) {
      setError("Could not obtain an access token.");
      return;
    }
    handoffToAddIn(returnUrl, response);
  }, [returnUrl]);

  useEffect(() => {
    if (isAllowedReturnUrl(queryReturnUrl)) {
      rememberReturnUrl(queryReturnUrl);
    }
  }, [queryReturnUrl]);

  useEffect(() => {
    if (redirectChecked.current || !isAllowedReturnUrl(returnUrl)) return;
    redirectChecked.current = true;

    void (async () => {
      try {
        const outcome = await completeOAuthRedirectLogin(
          (data) => directFirebaseLogin(data),
          { deviceFingerprint: getDeviceId() ?? undefined },
        );
        if (outcome.status === "authenticated") {
          complete(outcome.response);
        } else if (outcome.status === "profile_completion") {
          setError("Complete your Umbrella profile in the web app first, then try again.");
        }
      } catch (err) {
        if (isOAuthRedirectTimeout(err)) {
          setError("Sign-in timed out. Try again or use email and password.");
        }
      }
    })();
  }, [returnUrl, complete]);

  const handleSocial = async (provider: SocialAuthProvider) => {
    if (!isAllowedReturnUrl(returnUrl)) return;
    setLoading(provider);
    setError(null);
    rememberReturnUrl(returnUrl);
    try {
      await startOfficeOAuthRedirect(provider);
      // Page navigates away to Google/Apple.
    } catch (err) {
      setLoading(null);
      setError(
        err instanceof Error
          ? err.message
          : "Could not start sign-in. Try email and password instead.",
      );
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return;
    setError(null);
    setLoading(null);
    try {
      complete(await directApiLogin(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  if (!returnUrl || !isAllowedReturnUrl(returnUrl)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <p className="text-sm text-red-600">Missing or invalid Office add-in return URL.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Sign in to Umbrella</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connecting your Word add-in. Google and Apple will open in this window — complete
          sign-in here, then you will return to Word automatically.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <SocialAuthButtons
        onProviderClick={(provider) => void handleSocial(provider)}
        loadingProvider={loading}
        showDivider
      />

      <div className="space-y-2">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && void handleEmailLogin()}
        />
        <button
          type="button"
          onClick={() => void handleEmailLogin()}
          disabled={loading !== null}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Sign in with email
        </button>
      </div>
    </main>
  );
}
