import { apiFetch } from "./client";

export type DocumentRecommendation = {
  id: string;
  category: "work_product" | "matter_evidence" | "legal_authority";
  catalogId?: string;
  title: string;
  action: "draft" | "collect" | "research" | "review";
  reason: string;
  status: string;
  priority: string;
  questions: string[];
};

export async function fetchDocumentRecommendations(body: {
  countryCode: string;
  matterId?: string;
  documentKind?: string;
  rawFacts?: string;
  researchJobId?: string;
}) {
  return apiFetch<DocumentRecommendation[]>("/ai/document-recommendations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
