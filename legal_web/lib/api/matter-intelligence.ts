import { apiFetch } from "./client"

export interface MatterFact {
  id: string
  tenantId: string
  matterId: string
  factText: string
  sourceType: string
  sourceId: string | null
  confidence: number
  isDisputed: boolean
  approvedByLawyer: boolean
  createdAt: string
  updatedAt: string
}

export interface MatterIssue {
  id: string
  tenantId: string
  matterId: string
  title: string
  description: string | null
  status: string
  priority: string | null
  createdAt: string
  updatedAt: string
}

export interface MatterArgument {
  id: string
  tenantId: string
  matterId: string
  title: string
  side: string | null
  content: string | null
  strength: string | null
  createdAt: string
  updatedAt: string
}

export interface MatterStrategyMemo {
  id: string
  tenantId: string
  matterId: string
  title: string
  content: string
  status: string
  createdAt: string
  updatedAt: string
}

// --- Facts ---

export async function listMatterFacts(
  tenantId: string,
  matterId: string,
): Promise<MatterFact[]> {
  return apiFetch<MatterFact[]>(`/matters/${matterId}/facts`, { tenantId })
}

export async function getMatterFact(
  tenantId: string,
  matterId: string,
  factId: string,
): Promise<MatterFact> {
  return apiFetch<MatterFact>(`/matters/${matterId}/facts/${factId}`, {
    tenantId,
  })
}

export async function createMatterFact(
  tenantId: string,
  matterId: string,
  data: {
    factText: string
    sourceType: string
    sourceId?: string
    confidence?: number
    isDisputed?: boolean
    approvedByLawyer?: boolean
  },
): Promise<MatterFact> {
  return apiFetch<MatterFact>(`/matters/${matterId}/facts`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateMatterFact(
  tenantId: string,
  matterId: string,
  factId: string,
  data: Partial<{
    factText: string
    sourceType: string
    sourceId: string
    confidence: number
    isDisputed: boolean
    approvedByLawyer: boolean
  }>,
): Promise<MatterFact> {
  return apiFetch<MatterFact>(`/matters/${matterId}/facts/${factId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deleteMatterFact(
  tenantId: string,
  matterId: string,
  factId: string,
): Promise<MatterFact> {
  return apiFetch<MatterFact>(`/matters/${matterId}/facts/${factId}`, {
    method: "DELETE",
    tenantId,
  })
}

// --- Issues ---

export async function listMatterIssues(
  tenantId: string,
  matterId: string,
): Promise<MatterIssue[]> {
  return apiFetch<MatterIssue[]>(`/matters/${matterId}/issues`, { tenantId })
}

export async function getMatterIssue(
  tenantId: string,
  matterId: string,
  issueId: string,
): Promise<MatterIssue> {
  return apiFetch<MatterIssue>(`/matters/${matterId}/issues/${issueId}`, {
    tenantId,
  })
}

export async function createMatterIssue(
  tenantId: string,
  matterId: string,
  data: {
    title: string
    description?: string
    status?: string
    priority?: string
  },
): Promise<MatterIssue> {
  return apiFetch<MatterIssue>(`/matters/${matterId}/issues`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateMatterIssue(
  tenantId: string,
  matterId: string,
  issueId: string,
  data: Partial<{
    title: string
    description: string
    status: string
    priority: string
  }>,
): Promise<MatterIssue> {
  return apiFetch<MatterIssue>(`/matters/${matterId}/issues/${issueId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deleteMatterIssue(
  tenantId: string,
  matterId: string,
  issueId: string,
): Promise<MatterIssue> {
  return apiFetch<MatterIssue>(`/matters/${matterId}/issues/${issueId}`, {
    method: "DELETE",
    tenantId,
  })
}

// --- Arguments ---

export async function listMatterArguments(
  tenantId: string,
  matterId: string,
): Promise<MatterArgument[]> {
  return apiFetch<MatterArgument[]>(`/matters/${matterId}/arguments`, {
    tenantId,
  })
}

export async function getMatterArgument(
  tenantId: string,
  matterId: string,
  argumentId: string,
): Promise<MatterArgument> {
  return apiFetch<MatterArgument>(
    `/matters/${matterId}/arguments/${argumentId}`,
    { tenantId },
  )
}

export async function createMatterArgument(
  tenantId: string,
  matterId: string,
  data: {
    title: string
    side?: string
    content?: string
    strength?: string
  },
): Promise<MatterArgument> {
  return apiFetch<MatterArgument>(`/matters/${matterId}/arguments`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateMatterArgument(
  tenantId: string,
  matterId: string,
  argumentId: string,
  data: Partial<{
    title: string
    side: string
    content: string
    strength: string
  }>,
): Promise<MatterArgument> {
  return apiFetch<MatterArgument>(
    `/matters/${matterId}/arguments/${argumentId}`,
    {
      method: "PATCH",
      tenantId,
      body: data,
    },
  )
}

export async function deleteMatterArgument(
  tenantId: string,
  matterId: string,
  argumentId: string,
): Promise<MatterArgument> {
  return apiFetch<MatterArgument>(
    `/matters/${matterId}/arguments/${argumentId}`,
    {
      method: "DELETE",
      tenantId,
    },
  )
}

// --- Strategy memos ---

export async function listMatterStrategyMemos(
  tenantId: string,
  matterId: string,
): Promise<MatterStrategyMemo[]> {
  return apiFetch<MatterStrategyMemo[]>(
    `/matters/${matterId}/strategy-memos`,
    { tenantId },
  )
}

export async function getMatterStrategyMemo(
  tenantId: string,
  matterId: string,
  memoId: string,
): Promise<MatterStrategyMemo> {
  return apiFetch<MatterStrategyMemo>(
    `/matters/${matterId}/strategy-memos/${memoId}`,
    { tenantId },
  )
}

export async function createMatterStrategyMemo(
  tenantId: string,
  matterId: string,
  data: {
    title: string
    content: string
    status?: string
  },
): Promise<MatterStrategyMemo> {
  return apiFetch<MatterStrategyMemo>(
    `/matters/${matterId}/strategy-memos`,
    {
      method: "POST",
      tenantId,
      body: data,
    },
  )
}

export async function updateMatterStrategyMemo(
  tenantId: string,
  matterId: string,
  memoId: string,
  data: Partial<{
    title: string
    content: string
    status: string
  }>,
): Promise<MatterStrategyMemo> {
  return apiFetch<MatterStrategyMemo>(
    `/matters/${matterId}/strategy-memos/${memoId}`,
    {
      method: "PATCH",
      tenantId,
      body: data,
    },
  )
}

export async function deleteMatterStrategyMemo(
  tenantId: string,
  matterId: string,
  memoId: string,
): Promise<MatterStrategyMemo> {
  return apiFetch<MatterStrategyMemo>(
    `/matters/${matterId}/strategy-memos/${memoId}`,
    {
      method: "DELETE",
      tenantId,
    },
  )
}

export interface ApiLegalTimelineEvent {
  id: string
  matterId: string
  tenantId: string
  eventDate: string
  eventType: string
  title: string
  description?: string | null
  significance: string
  factIds: string[]
  documentIds: string[]
  source: string
}

export async function listLegalTimelineEvents(
  tenantId: string,
  matterId: string,
): Promise<ApiLegalTimelineEvent[]> {
  return apiFetch<ApiLegalTimelineEvent[]>(
    `/matter-intelligence/v2/matters/${matterId}/legal-timeline`,
    { tenantId },
  )
}

export async function createLegalTimelineEvent(
  tenantId: string,
  matterId: string,
  data: Omit<ApiLegalTimelineEvent, "id" | "matterId" | "tenantId">,
): Promise<ApiLegalTimelineEvent> {
  return apiFetch<ApiLegalTimelineEvent>(
    `/matter-intelligence/v2/matters/${matterId}/legal-timeline`,
    { method: "POST", tenantId, body: data },
  )
}
