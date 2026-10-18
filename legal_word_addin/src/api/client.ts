import axios from "axios";
import { getStoredToken } from "../auth/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://api.yourdomain.com";

export const apiClient = axios.create({ baseURL: `${API_BASE}/api/v1` });

apiClient.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function tenantHeaders(tenantId: string) {
  return { "x-tenant-id": tenantId };
}

export interface RedlineEditOp {
  id: string;
  changeType: "replace" | "delete" | "insert";
  anchorText: string;
  originalText: string;
  proposedText: string;
  rationale: string;
  severity: string;
  sectionRef: string;
  paragraphIndex?: number;
  addComment: boolean;
}

export interface InlineReviewResult {
  workspaceId: string;
  findings: Array<{ id: string; title: string; severity: string; description: string }>;
  redlines: Array<{ id: string; originalText: string; proposedText: string; reason: string }>;
  editOps: RedlineEditOp[];
  playbookResults: PlaybookCompareResult[];
  playbookSummary: PlaybookSummary;
  riskScore: number;
}

export interface PlaybookCompareResult {
  clauseType: string;
  playbookId: string;
  found: boolean;
  status: string;
  matchedText?: string;
  issue?: string;
  suggestedReplacement?: string;
}

export interface PlaybookSummary {
  unacceptable: number;
  fallback: number;
  preferred: number;
  missing: number;
  total: number;
}

export interface DraftAmendment {
  id: string;
  clauseLabel: string;
  originalText: string;
  proposedText: string;
  rationale: string;
  anchorText: string;
}

export async function getMatterContext(matterId: string) {
  const res = await apiClient.get(`/add-in/context/matter?matterId=${matterId}`);
  return res.data;
}

export async function listMatters(tenantId: string) {
  const res = await apiClient.get("/matters", {
    headers: tenantHeaders(tenantId),
    params: { limit: 20 },
  });
  return res.data;
}

export async function runClauseAssist(input: {
  selectedText: string;
  documentType: string;
  countryCode: string;
  matterId?: string;
  tenantId: string;
}) {
  const res = await apiClient.post(
    "/ai/document-review",
    {
      extractedText: input.selectedText,
      documentType: input.documentType,
      countryCode: input.countryCode,
      matterId: input.matterId,
    },
    { headers: tenantHeaders(input.tenantId) },
  );
  return res.data;
}

export async function runCopilotChat(input: {
  message: string;
  matterId?: string;
  tenantId: string;
}) {
  const res = await apiClient.post(
    "/ai/copilot/chat",
    { message: input.message, matterId: input.matterId },
    { headers: tenantHeaders(input.tenantId) },
  );
  return res.data;
}

export async function runResearch(input: {
  query: string;
  countryCode: string;
  tenantId: string;
  matterId?: string;
}) {
  const res = await apiClient.post(
    "/ai/research",
    {
      query: input.query,
      countryCode: input.countryCode,
      matterId: input.matterId,
    },
    { headers: tenantHeaders(input.tenantId) },
  );
  return res.data;
}

export async function runInlineReview(input: {
  rawText: string;
  matterId?: string;
  title?: string;
  documentType?: string;
  tenantId: string;
}): Promise<InlineReviewResult> {
  const res = await apiClient.post(
    "/document-review/run-inline",
    {
      rawText: input.rawText,
      matterId: input.matterId,
      title: input.title,
      documentType: input.documentType,
    },
    { headers: tenantHeaders(input.tenantId) },
  );
  return res.data;
}

export async function exportRedlineOps(workspaceId: string, tenantId: string) {
  const res = await apiClient.post(
    `/document-review/workspaces/${workspaceId}/redlines/export`,
    {},
    { headers: tenantHeaders(tenantId) },
  );
  return res.data as { editOps: RedlineEditOp[]; redlines: unknown[] };
}

export async function comparePlaybooksInline(input: {
  rawText: string;
  documentType?: string;
  tenantId: string;
}) {
  const res = await apiClient.post(
    "/document-review/playbook-compare-inline",
    { rawText: input.rawText, documentType: input.documentType },
    { headers: tenantHeaders(input.tenantId) },
  );
  return res.data as { results: PlaybookCompareResult[]; summary: PlaybookSummary };
}

export async function draftAmendments(input: {
  documentText: string;
  instruction: string;
  matterId?: string;
  countryCode?: string;
  tenantId: string;
}) {
  const res = await apiClient.post(
    "/ai/office/draft-amendments",
    {
      documentText: input.documentText,
      instruction: input.instruction,
      matterId: input.matterId,
      countryCode: input.countryCode,
    },
    { headers: tenantHeaders(input.tenantId) },
  );
  return res.data as { amendments: DraftAmendment[]; editOps: RedlineEditOp[] };
}

export interface DraftLibraryTemplate {
  id: string;
  name: string;
  content: string;
  practiceArea?: string | null;
  category?: string | null;
  countryCode?: string | null;
  source?: string;
  provisioned?: boolean;
}

export async function listDraftLibraryTemplates(tenantId: string, practiceArea?: string) {
  const res = await apiClient.get("/templates/library", {
    headers: tenantHeaders(tenantId),
    params: {
      allPracticeAreas: practiceArea ? undefined : "true",
      practiceArea: practiceArea || undefined,
    },
  });
  return res.data as DraftLibraryTemplate[];
}

export async function listFirmTemplates(tenantId: string) {
  const res = await apiClient.get("/templates", {
    headers: tenantHeaders(tenantId),
    params: { isActive: "true" },
  });
  const data = res.data as { templates?: DraftLibraryTemplate[] };
  return data.templates ?? (res.data as DraftLibraryTemplate[]);
}

export async function getTemplateContent(tenantId: string, templateId: string) {
  const res = await apiClient.get(`/templates/${templateId}`, {
    headers: tenantHeaders(tenantId),
  });
  return res.data as DraftLibraryTemplate;
}

// ---------------------------------------------------------------------------
// Work Context (C18) — matches web/Flutter StartWorkPayload contract
// ---------------------------------------------------------------------------

export interface StartWorkPayload {
  mode: "new_client" | "existing_client" | "unassigned";
  clientId?: string;
  matterId?: string;
  createClient?: { name: string; email?: string };
  createMatter?: { title: string; jurisdiction?: string; matterType?: string };
  countryCode?: string;
  /** Per-intent UUID — remains constant across retries (B05 parity). */
  operationRequestKey?: string;
}

export interface StartWorkResult {
  scopeKey: string;
  standalone: boolean;
  clientId: string | null;
  matterId: string | null;
}

/**
 * Establishes an authorized work context (client + matter) before performing
 * research or document drafting from within Word.
 *
 * The `operationRequestKey` prevents duplicate records on network retry.
 * Generate it once per user intent (e.g. button click) and persist until
 * a terminal success or deliberate cancellation.
 */
export async function startWork(
  payload: StartWorkPayload,
  tenantId: string,
): Promise<StartWorkResult> {
  const res = await apiClient.post(
    "/work-context/start",
    payload,
    { headers: tenantHeaders(tenantId) },
  );
  return res.data as StartWorkResult;
}

let _opKeyCounter = 0;

/** Convenience: generates a new per-intent UUID without external dependencies. */
export function newOperationKey(): string {
  const bytes: number[] = [];
  // Monotonic counter prevents collisions when called in rapid succession
  let seed = (Date.now() ^ ((++_opKeyCounter) * 0x5deece66d)) >>> 0;
  seed ^= Math.floor(Math.random() * 0xffffffff);
  for (let i = 0; i < 16; i++) {
    seed = ((seed * 1664525) + 1013904223) >>> 0;
    bytes.push(seed & 0xff);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
