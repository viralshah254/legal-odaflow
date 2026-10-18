const API_BASE = import.meta.env.VITE_API_URL ?? "https://api.yourdomain.com";
const STORAGE_KEY = "umbrella_outlook_addin_token";

export interface AddInTokenResponse {
  accessToken: string;
  expiresIn: number;
  userId: string;
  tenantId: string;
  displayName: string;
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await OfficeRuntime.storage.getItem(STORAGE_KEY);
  } catch {
    return localStorage.getItem(STORAGE_KEY);
  }
}

export async function storeToken(token: string): Promise<void> {
  try {
    await OfficeRuntime.storage.setItem(STORAGE_KEY, token);
  } catch {
    localStorage.setItem(STORAGE_KEY, token);
  }
}

export async function clearToken(): Promise<void> {
  try {
    await OfficeRuntime.storage.removeItem(STORAGE_KEY);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
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
    throw new Error((err as { message?: string }).message ?? "Login failed");
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

export { API_BASE };
