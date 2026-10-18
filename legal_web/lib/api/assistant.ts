import { apiFetch } from "./client";
import {
  createCopilotSession,
  listCopilotSessions,
  sendCopilotMessage,
  getCopilotSessionMessages,
  type CopilotSessionApi,
} from "./copilot";

export type DeliverableType =
  | "key_issues_list"
  | "clause_summary"
  | "research_memo"
  | "redline_report";

export interface DeliverableResult {
  type: string;
  content: string;
  generatedAt: string;
}

export {
  createCopilotSession,
  listCopilotSessions,
  sendCopilotMessage,
  getCopilotSessionMessages,
  type CopilotSessionApi,
};

export async function generateDeliverable(
  tenantId: string,
  sessionId: string,
  body: { deliverableType?: DeliverableType; documentText?: string },
): Promise<DeliverableResult> {
  return apiFetch<DeliverableResult>(
    `/ai/copilot/sessions/${sessionId}/generate-deliverable`,
    {
      tenantId,
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
