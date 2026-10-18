import { apiFetch } from "./client";

export interface ContractPlaybook {
  id: string;
  tenantId?: string | null;
  name: string;
  contractType: string;
  clauseType: string;
  description?: string | null;
  preferredText?: string | null;
  acceptableText?: string | null;
  prohibitedPatterns: string[];
  flaggedPatterns: string[];
  negotiationGuide?: string | null;
  riskLevel: string;
  jurisdiction?: string | null;
  active: boolean;
}

export async function listContractPlaybooks(
  tenantId: string,
  contractType?: string,
): Promise<ContractPlaybook[]> {
  const qs = contractType ? `?contractType=${encodeURIComponent(contractType)}` : "";
  return apiFetch<ContractPlaybook[]>(`/contract-playbooks${qs}`, { tenantId });
}

export async function createContractPlaybook(
  tenantId: string,
  body: {
    name: string;
    contractType: string;
    clauseType: string;
    description?: string;
    preferredText?: string;
    acceptableText?: string;
    prohibitedPatterns?: string[];
    flaggedPatterns?: string[];
    negotiationGuide?: string;
    riskLevel?: string;
    jurisdiction?: string;
  },
): Promise<ContractPlaybook> {
  return apiFetch<ContractPlaybook>("/contract-playbooks", {
    tenantId,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteContractPlaybook(
  tenantId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/contract-playbooks/${id}`, {
    tenantId,
    method: "DELETE",
  });
}
