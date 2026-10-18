import { useState } from "react";
import {
  exchangeOfficeToken,
  umbrellaLogin,
  devLogin,
  loginViaUmbrellaDialog,
} from "../../auth/auth";
import type { AddinSession } from "../App";

interface Props {
  onLogin: (session: AddinSession) => void;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [devSecret, setDevSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDev, setShowDev] = useState(false);

  const toSession = (result: {
    accessToken: string;
    tenantId: string;
    userId: string;
    displayName: string;
  }): AddinSession => ({
    accessToken: result.accessToken,
    tenantId: result.tenantId,
    userId: result.userId,
    displayName: result.displayName,
  });

  const handleUmbrellaLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      onLogin(toSession(await umbrellaLogin(email, password)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const openSocialDialog = async (provider: "google" | "apple") => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginViaUmbrellaDialog(provider);
      onLogin({
        accessToken: result.accessToken,
        tenantId: result.tenantId,
        userId: result.userId,
        displayName: result.displayName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async () => {
    setLoading(true);
    setError(null);
    try {
      onLogin(toSession(await exchangeOfficeToken()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microsoft sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    if (!email || !devSecret) return;
    setLoading(true);
    setError(null);
    try {
      onLogin(toSession(await devLogin(email, devSecret)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col px-5 py-6 space-y-3">
      <div className="text-center pb-1">
        <div className="w-10 h-10 bg-blue-600 rounded-lg mx-auto mb-2 flex items-center justify-center">
          <span className="text-white font-bold">U</span>
        </div>
        <h1 className="text-base font-semibold text-gray-900">Umbrella Legal AI</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        autoComplete="username"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        autoComplete="current-password"
        onKeyDown={(e) => e.key === "Enter" && void handleUmbrellaLogin()}
      />

      <button
        onClick={() => void handleUmbrellaLogin()}
        disabled={loading || !email || !password}
        className="w-full bg-blue-600 text-white rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase text-gray-400">
          <span className="bg-white px-2">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void openSocialDialog("google")}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => void openSocialDialog("apple")}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        <AppleIcon />
        Continue with Apple
      </button>

      <button
        onClick={() => void handleSso()}
        disabled={loading}
        className="w-full text-gray-600 text-xs hover:text-gray-800 disabled:opacity-50"
      >
        Sign in with Microsoft
      </button>

      <button
        type="button"
        onClick={() => setShowDev((v) => !v)}
        className="text-[11px] text-gray-400 hover:text-gray-600"
      >
        {showDev ? "Hide developer sign-in" : "Developer sign-in"}
      </button>

      {showDev && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <input
            type="password"
            placeholder="Dev secret"
            value={devSecret}
            onChange={(e) => setDevSecret(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => void handleDevLogin()}
            disabled={loading || !email || !devSecret}
            className="w-full border border-blue-300 text-blue-700 rounded-lg px-3 py-2 text-sm hover:bg-blue-50 disabled:opacity-50"
          >
            Dev sign in
          </button>
        </div>
      )}
    </div>
  );
}
