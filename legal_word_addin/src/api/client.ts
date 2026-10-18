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
