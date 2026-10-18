import { getStoredToken, API_BASE } from "../auth/auth";

export interface Matter {
  id: string;
  title: string;
  clientName?: string;
  status: string;
  jurisdiction?: string;
}

export interface ExtractedEmailData {
  subject: string;
  parties: string[];
  issueType: string;
  jurisdiction: string;
  summary: string;
  clientName: string;
  clientEmail: string;
  urgency: "LOW" | "MEDIUM" | "HIGH";
}

export interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
  type: "summarize" | "reply" | "cross_check" | "custom";
}

export interface AgreementCrossCheck {
  name: string;
  foundInMatter: boolean;
  documentId?: string;
  documentTitle?: string;
  mismatch?: string;
}

export interface EmailContextResponse {
  summary: string;
  parties: string[];
  agreementNames: string[];
  suggestedActions: SuggestedAction[];
  crossChecks: AgreementCrossCheck[];
}

export interface EmailNarrative {
  id: string;
  minutes: number;
  narrative: string;
  activityType: "email" | "research" | "drafting" | "call" | "review";
}

export interface EmailNarrativesResponse {
  narratives: EmailNarrative[];
  savedSuggestionIds?: string[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getStoredToken();
  if (!token) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function get<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `POST ${path} failed`);
  }
  return res.json() as Promise<T>;
}

export async function listMatters(): Promise<Matter[]> {
  const data = await get<{ items: Matter[] }>("/matters?limit=50");
  return data.items ?? [];
}

export async function searchMatters(query: string): Promise<Matter[]> {
  const data = await get<{ items: Matter[] }>(
    `/matters?search=${encodeURIComponent(query)}&limit=20`,
  );
  return data.items ?? [];
}

export async function createMatterFromEmail(payload: {
  title: string;
  clientName: string;
  clientEmail: string;
  jurisdiction: string;
  description: string;
  emailSubject: string;
  emailBody: string;
}): Promise<Matter> {
  return post<Matter>("/matters", payload);
}

export async function linkEmailToMatter(
  matterId: string,
  payload: {
    type: string;
    title: string;
    description: string;
    emailSubject: string;
    emailFrom: string;
    emailBody: string;
  },
): Promise<void> {
  await post<void>(`/matters/${matterId}/timeline`, payload);
}

export async function extractEmailData(
  emailBody: string,
  emailSubject: string,
): Promise<ExtractedEmailData> {
  return post<ExtractedEmailData>("/ai/copilot/extract-email", {
    emailBody,
    emailSubject,
  });
}

export async function generateDraftReply(payload: {
  matterId?: string;
  emailBody: string;
  emailSubject: string;
  instruction?: string;
  tone?: string;
}): Promise<{ draft: string }> {
  return post<{ draft: string }>("/ai/copilot/draft-reply", payload);
}

export async function analyzeEmailContext(payload: {
  subject: string;
  body: string;
  matterId?: string;
}): Promise<EmailContextResponse> {
  return post<EmailContextResponse>("/ai/office/email-context", payload);
}

export async function generateEmailNarratives(payload: {
  subject: string;
  body: string;
  matterId?: string;
  saveSuggestions?: boolean;
}): Promise<EmailNarrativesResponse> {
  return post<EmailNarrativesResponse>("/ai/office/email-narratives", payload);
}

export function getEmailItem(): Office.MessageRead | null {
  try {
    return Office.context.mailbox.item as Office.MessageRead;
  } catch {
    return null;
  }
}

export function getEmailSubject(): Promise<string> {
  return new Promise((resolve) => {
    const item = Office.context.mailbox.item;
    resolve(item?.subject ?? "");
  });
}

export function getEmailFrom(): Promise<string> {
  return new Promise((resolve) => {
    const item = Office.context.mailbox.item as Office.MessageRead | undefined;
    if (!item?.from) {
      resolve("");
      return;
    }
    resolve(item.from.emailAddress ?? item.from.displayName ?? "");
  });
}

export function getEmailBody(): Promise<string> {
  return new Promise((resolve, reject) => {
    const item = Office.context.mailbox.item;
    if (!item) {
      reject(new Error("No email item"));
      return;
    }
    (item as Office.MessageRead).body.getAsync(
      Office.CoercionType.Text,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value);
        } else {
          reject(new Error(result.error?.message ?? "Failed to get body"));
        }
      },
    );
  });
}

export function insertDraftReply(draft: string): Promise<void> {
  return insertDraftReplyHtml(draft.replace(/\n/g, "<br/>"));
}

export function insertDraftReplyHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const item = Office.context.mailbox.item as Office.MessageCompose;
    item.body.setAsync(
      html,
      { coercionType: Office.CoercionType.Html },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(new Error(result.error?.message ?? "Failed to insert draft"));
        }
      },
    );
  });
}
