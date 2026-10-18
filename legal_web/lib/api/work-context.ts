import { apiFetch } from "@/lib/api/client";

export type StartWorkPayload = {
  mode: "existing_client" | "new_client" | "unassigned";
  clientId?: string;
  matterId?: string;
  idempotencyKey?: string;
  /** Per-intent retry key (UUID v4). Prevents duplicate operations on network retry. */
  operationRequestKey?: string;
  /** Explicit ISO-2 country code for the work context. */
  countryCode?: string;
  createClient?: { name: string; email?: string; phone?: string; countryCode?: string };
  createMatter?: { title: string; jurisdiction?: string; matterType?: string; countryCode?: string };
};

export type StartWorkResult = {
  scopeKey: string;
  standalone: boolean;
  clientId: string | null;
  matterId: string | null;
};

export async function startWorkContext(payload: StartWorkPayload): Promise<StartWorkResult> {
  return apiFetch<StartWorkResult>("/work-context/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
