const API_BASE = import.meta.env.VITE_API_URL ?? "https://api.yourdomain.com";
const STORAGE_KEY = "umbrella_addin_token";
const REFRESH_KEY = "umbrella_addin_refresh";

export interface AddInTokenResponse {
  accessToken: string;
  expiresIn: number;
  userId: string;
  tenantId: string;
  displayName: string;
  refreshToken?: string;
}

async function storageGet(key: string): Promise<string | null> {
  try {
    return await OfficeRuntime.storage.getItem(key);
  } catch {
    return localStorage.getItem(key);
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    await OfficeRuntime.storage.setItem(key, value);
  } catch {
    localStorage.setItem(key, value);
  }
}

async function storageRemove(key: string): Promise<void> {
  try {
    await OfficeRuntime.storage.removeItem(key);
  } catch {
    localStorage.removeItem(key);
  }
}

export async function getStoredToken(): Promise<string | null> {
  return storageGet(STORAGE_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return storageGet(REFRESH_KEY);
}

export async function storeSession(data: AddInTokenResponse): Promise<void> {
  await storageSet(STORAGE_KEY, data.accessToken);
  if (data.refreshToken) {
    await storageSet(REFRESH_KEY, data.refreshToken);
  }
}

export async function storeToken(token: string): Promise<void> {
  await storageSet(STORAGE_KEY, token);
}

export async function clearToken(): Promise<void> {
  await storageRemove(STORAGE_KEY);
  await storageRemove(REFRESH_KEY);
}

function toAddInResponse(data: {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; name: string | null; tenantId?: string };
}): AddInTokenResponse {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
    tenantId: data.user.tenantId ?? "",
    displayName: data.user.name ?? data.user.email,
    expiresIn: 0,
  };
}

export async function refreshUmbrellaSession(): Promise<AddInTokenResponse | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearToken();
    return null;
  }

  const data = await response.json() as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string | null; tenantId?: string };
  };

  const session = toAddInResponse(data);
  await storeSession(session);
  return session;
}

export async function exchangeOfficeToken(): Promise<AddInTokenResponse> {
  const officeToken = await Office.auth.getAccessToken({
    allowSignInPrompt: true,
    allowConsentPrompt: true,
    forMSGraphAccess: false,
  });

  const response = await fetch(`${API_BASE}/api/v1/add-in/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ officeToken }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  const data: AddInTokenResponse = await response.json();
  await storeToken(data.accessToken);
  return data;
}

/** Umbrella email + password (same as web app). */
export async function umbrellaLogin(
  email: string,
  password: string,
): Promise<AddInTokenResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message ?? "Invalid email or password");
  }

  const data = await response.json() as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string | null; tenantId?: string };
  };

  const session = toAddInResponse(data);
  await storeSession(session);
  return session;
}

/** Google / Apple via Office dialog + Umbrella web auth (redirect flow). */
export function loginViaUmbrellaDialog(
  provider?: "google" | "apple",
): Promise<AddInTokenResponse> {
  return new Promise((resolve, reject) => {
    if (typeof Office === "undefined") {
      reject(new Error("Office APIs are not available"));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    Office.onReady(() => {
      const origin = window.location.origin;
      const handoffUrl = `${origin}/auth-bridge.html`;

      let startUrl: string;
      if (provider) {
        const params = new URLSearchParams({
          returnUrl: handoffUrl,
          provider,
        });
        // displayDialogAsync requires HTTPS on the add-in origin — redirect to web app inside the dialog.
        startUrl = `${origin}/oauth-launch.html?${params.toString()}`;
      } else {
        const params = new URLSearchParams({ returnUrl: handoffUrl });
        startUrl = `${origin}/office-auth.html?${params.toString()}`;
      }

      Office.context.ui.displayDialogAsync(
        startUrl,
        { height: 65, width: 45, displayInIframe: false },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            const code = "error" in result ? result.error?.code : undefined;
            const detail =
              code === 12005
                ? " Dialog must start on HTTPS (add-in origin)."
                : code === 12004
                  ? " Domain not trusted — check manifest AppDomains."
                  : code
                    ? ` (Office error ${code})`
                    : "";
            finish(() =>
              reject(new Error(`Could not open the Umbrella sign-in window.${detail}`)),
            );
            return;
          }

          const dialog = result.value;
          dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
            if (!("message" in arg)) return;
            dialog.close();
            try {
              const msg = JSON.parse(arg.message) as AddInTokenResponse & {
                refreshToken?: string;
              };
              if (!msg.accessToken) {
                finish(() => reject(new Error("Sign-in did not return a token")));
                return;
              }
              void storeSession({
                accessToken: msg.accessToken,
                refreshToken: msg.refreshToken,
                userId: msg.userId,
                tenantId: msg.tenantId,
                displayName: msg.displayName,
                expiresIn: 0,
              }).then(() => finish(() => resolve(msg)));
            } catch (err) {
              finish(() =>
                reject(err instanceof Error ? err : new Error("Sign-in failed")),
              );
            }
          });

          dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
            if ("error" in arg && arg.error === 12006) {
              finish(() => reject(new Error("Sign-in window closed before completing.")));
            }
          });
        },
      );
    });
  });
}

/** Dev mode: email + addinSecret login */
export async function devLogin(
  email: string,
  addinSecret: string,
): Promise<AddInTokenResponse> {
  const response = await fetch(`${API_BASE}/api/v1/add-in/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, addinSecret }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message ?? "Login failed");
  }

  const data: AddInTokenResponse = await response.json();
  await storeToken(data.accessToken);
  return data;
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() / 1000 > payload.exp - 300;
  } catch {
    return true;
  }
}

export function sessionFromToken(accessToken: string): AddInTokenResponse {
  const payload = JSON.parse(atob(accessToken.split(".")[1]));
  return {
    accessToken,
    userId: payload.sub ?? "",
    tenantId: payload.tenantId ?? "",
    displayName: payload.email ?? "",
    expiresIn: 0,
  };
}
