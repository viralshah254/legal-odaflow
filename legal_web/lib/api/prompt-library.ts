import { apiFetch } from "./client";

export interface PromptLibraryEntry {
  id: string;
  tenantId?: string | null;
  title: string;
  description?: string | null;
  promptText: string;
  category: string;
  deliverableType?: string | null;
}

export async function listPromptLibrary(
  tenantId: string,
  category?: string,
): Promise<PromptLibraryEntry[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<PromptLibraryEntry[]>(`/ai/prompt-library${qs}`, { tenantId });
}

export async function createPromptLibraryEntry(
  tenantId: string,
  body: {
    title: string;
    description?: string;
    promptText: string;
    category?: string;
    deliverableType?: string;
  },
): Promise<PromptLibraryEntry> {
  return apiFetch<PromptLibraryEntry>("/ai/prompt-library", {
    tenantId,
    method: "POST",
    body: JSON.stringify(body),
  });
}
