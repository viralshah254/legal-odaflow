export interface AdminAiDateFilters {
  from?: string;
  to?: string;
  tenantId?: string;
  userId?: string;
  taskType?: string;
  modelName?: string;
  modelProvider?: string;
  limit?: number;
  offset?: number;
}

export function buildDateRange(filters: Pick<AdminAiDateFilters, 'from' | 'to'>) {
  if (!filters.from && !filters.to) return undefined;
  return {
    gte: filters.from ? new Date(filters.from) : undefined,
    lte: filters.to ? new Date(filters.to) : undefined,
  };
}

/** Per-run quality telemetry as stored on AIUsageLog.telemetry, defensively read. */
export interface RunTelemetry {
  flow?: 'research' | 'drafting';
  countryCode?: string;
  taskKind?: string;
  legalDomain?: string;
  clarificationReason?: string;
  authoritiesRetrieved?: number;
  authoritiesAfterPack?: number;
  citationsStripped?: number;
  verificationStatus?: string;
  llmVerifierRan?: boolean;
  requiresLawyerReview?: boolean;
  similarCasesOutcome?: string;
  connectorHealth?: Array<{ source?: string; status?: string }>;
  routedModel?: string;
  actualModel?: string;
  modelFellBack?: boolean;
  durationMs?: number;
}

export function parseRunTelemetry(telemetry: unknown): RunTelemetry | null {
  if (!telemetry || typeof telemetry !== 'object' || Array.isArray(telemetry)) {
    return null;
  }
  const t = telemetry as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);

  const connectorHealth = Array.isArray(t.connectorHealth)
    ? t.connectorHealth
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({ source: str(c.source), status: str(c.status) }))
    : undefined;

  return {
    flow: t.flow === 'drafting' ? 'drafting' : 'research',
    countryCode: str(t.countryCode),
    taskKind: str(t.taskKind),
    legalDomain: str(t.legalDomain),
    clarificationReason: str(t.clarificationReason),
    authoritiesRetrieved: num(t.authoritiesRetrieved),
    authoritiesAfterPack: num(t.authoritiesAfterPack),
    citationsStripped: num(t.citationsStripped),
    verificationStatus: str(t.verificationStatus) ?? str(t.certificationLabel),
    llmVerifierRan: bool(t.llmVerifierRan),
    requiresLawyerReview: bool(t.requiresLawyerReview) ?? (bool(t.lawyerReady) === false || undefined),
    similarCasesOutcome: str(t.similarCasesOutcome),
    connectorHealth,
    routedModel: str(t.routedModel),
    actualModel: str(t.actualModel),
    modelFellBack: bool(t.modelFellBack),
    durationMs: num(t.durationMs),
  };
}

export function parseLedgerMetadata(metadata: unknown): {
  modelName?: string;
  inputTokens?: number;
  outputTokens?: number;
  providerCostUsd?: number;
  chargeMode?: string;
} {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const m = metadata as Record<string, unknown>;
  return {
    modelName: typeof m.modelName === 'string' ? m.modelName : undefined,
    inputTokens: typeof m.inputTokens === 'number' ? m.inputTokens : undefined,
    outputTokens: typeof m.outputTokens === 'number' ? m.outputTokens : undefined,
    providerCostUsd:
      typeof m.providerCostUsd === 'number' ? m.providerCostUsd : undefined,
    chargeMode: typeof m.chargeMode === 'string' ? m.chargeMode : undefined,
  };
}
