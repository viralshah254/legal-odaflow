export const queryKeys = {
  clients: {
    root: ['clients'] as const,
    lists: (tenantId?: string | null) => ['clients', 'list', tenantId] as const,
    list: (tenantId?: string | null, search?: string) =>
      ['clients', 'list', tenantId, { search: search ?? '' }] as const,
    details: (tenantId?: string | null) => ['clients', 'detail', tenantId] as const,
    detail: (tenantId: string | null | undefined, clientId: string) =>
      ['clients', 'detail', tenantId, clientId] as const,
    activity: (tenantId: string | null | undefined, clientId: string) =>
      ['clients', 'detail', tenantId, clientId, 'activity'] as const,
    kyc: (tenantId: string | null | undefined, clientId: string) =>
      ['clients', 'detail', tenantId, clientId, 'kyc'] as const,
    documents: (tenantId: string | null | undefined, clientId: string) =>
      ['clients', 'detail', tenantId, clientId, 'documents'] as const,
    matters: (tenantId: string | null | undefined, clientId: string) =>
      ['clients', 'detail', tenantId, clientId, 'matters'] as const,
  },
  matters: {
    root: ['matters'] as const,
    lists: (tenantId?: string | null) => ['matters', 'list', tenantId] as const,
    list: (tenantId?: string | null, filters: Record<string, unknown> = {}) =>
      ['matters', 'list', tenantId, filters] as const,
    details: (tenantId?: string | null) => ['matters', 'detail', tenantId] as const,
    detail: (tenantId: string | null | undefined, matterId: string) =>
      ['matters', 'detail', tenantId, matterId] as const,
    all: (tenantId?: string | null) => ['matters', 'list', tenantId] as const,
    one: (id: string) => ['matters', 'detail', undefined, id] as const,
    facts: (matterId: string) => ['matters', matterId, 'facts'] as const,
    operationalTimeline: (tenantId: string | null | undefined, matterId: string) =>
      ['matters', 'detail', tenantId, matterId, 'operational-timeline'] as const,
    legalTimeline: (tenantId: string | null | undefined, matterId: string) =>
      ['matters', 'detail', tenantId, matterId, 'legal-timeline'] as const,
    timeline: (matterId: string) =>
      ['matters', 'detail', undefined, matterId, 'operational-timeline'] as const,
    documents: (tenantId: string | null | undefined, matterId: string) =>
      ['matters', 'detail', tenantId, matterId, 'documents'] as const,
    shares: (tenantId: string | null | undefined, matterId: string) =>
      ['matters', 'detail', tenantId, matterId, 'shares'] as const,
    deadlines: (matterId: string) => ['matters', matterId, 'deadlines'] as const,
    issues: (matterId: string) => ['matters', matterId, 'issues'] as const,
    contradictions: (matterId: string) => ['matters', matterId, 'contradictions'] as const,
  },
  research: {
    all: () => ['research', 'workspaces'] as const,
    one: (id: string) => ['research', 'workspaces', id] as const,
    results: (id: string) => ['research', 'workspaces', id, 'results'] as const,
    saved: (
      tenantId?: string | null,
      filters: { clientId?: string; matterId?: string } = {},
    ) => ['research', 'saved', tenantId, filters] as const,
  },
  drafting: {
    all: () => ['drafting', 'workspaces'] as const,
    one: (id: string) => ['drafting', 'workspaces', id] as const,
    sections: (id: string) => ['drafting', 'workspaces', id, 'sections'] as const,
    filingReadiness: (id: string) => ['drafting', 'workspaces', id, 'filing-readiness'] as const,
  },
  documentReview: {
    all: () => ['document-review', 'workspaces'] as const,
    one: (id: string) => ['document-review', 'workspaces', id] as const,
    findings: (id: string) => ['document-review', 'workspaces', id, 'findings'] as const,
    redlines: (id: string) => ['document-review', 'workspaces', id, 'redlines'] as const,
  },
  contracts: {
    all: (tenantId?: string) => ['contracts', tenantId] as const,
    one: (id: string) => ['contracts', id] as const,
    clauses: (id: string) => ['contracts', id, 'clauses'] as const,
    obligations: (id: string) => ['contracts', id, 'obligations'] as const,
  },
  workflows: {
    all: (filter?: string) => ['workflows', filter] as const,
    one: (id: string) => ['workflows', id] as const,
  },
  legalMemory: {
    all: () => ['legal-memory'] as const,
  },
  knowledgeGraph: {
    node: (id: string) => ['knowledge-graph', 'nodes', id] as const,
  },
} as const
