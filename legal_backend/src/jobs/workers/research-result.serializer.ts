import type { LawyerResearchResult } from '@/ai/ai-gateway.service';

export function serializeResearchJobResult(
  research: LawyerResearchResult,
  context: {
    toolName?: string;
    query: string;
    countryCode: string;
    jurisdiction?: string;
    matterId?: unknown;
    queueWaitMs: number;
    requestedTaskKind?: string;
  },
): Record<string, unknown> {
  const resolvedTaskKind = research.taskProfile?.kind;
  if (
    context.requestedTaskKind &&
    resolvedTaskKind &&
    context.requestedTaskKind !== resolvedTaskKind
  ) {
    throw new Error(
      `Research task drift: requested ${context.requestedTaskKind}, resolved ${resolvedTaskKind}`,
    );
  }
  const citations =
    'citations' in research && research.citations != null ? research.citations : [];
  return {
    toolName: context.toolName,
    phase: 'completed',
    query: context.query,
    outputMarkdown: research.outputMarkdown,
    draftMarkdown: research.outputMarkdown,
    structuredDraft: research.structuredDraft ?? null,
    citations,
    countryCode: research.countryCode ?? context.countryCode,
    jurisdiction: research.jurisdiction ?? context.jurisdiction,
    matterId: context.matterId,
    provider: research.provider,
    modelName: research.modelName,
    researchMode: research.researchMode,
    degraded: research.degraded ?? false,
    verificationStatus: research.verificationStatus,
    citationAudit: research.citationAudit ?? null,
    findings: research.findings ?? [],
    propositions: research.propositions ?? [],
    dimensions: research.dimensions ?? null,
    publicationState: research.publicationState ?? null,
    outputHash: research.outputHash ?? null,
    caseLawSearchStatus: research.caseLawSearchStatus ?? null,
    issueGaps: research.issueGaps ?? [],
    sourceDiagnostics: research.sourceDiagnostics ?? [],
    connectorDiagnostics: research.connectorDiagnostics ?? [],
    rejectedCandidates: research.rejectedCandidates ?? [],
    requestedTaskKind: context.requestedTaskKind ?? null,
    resolvedTaskKind: resolvedTaskKind ?? null,
    taskProfile: research.taskProfile ?? null,
    researchPlan: research.researchPlan ?? null,
    capabilitySnapshot: research.capabilitySnapshot ?? null,
    sourceProvenance: research.sourceProvenance ?? [],
    conflicts: research.conflicts ?? [],
    confidenceAssessment: research.confidenceAssessment ?? null,
    publicationDecision: research.publicationDecision ?? null,
    factSummaries: research.factSummaries ?? [],
    propositionSummaries: research.propositionSummaries ?? [],
    auditMetadata: research.auditMetadata ?? null,
    auditPacket: research.auditPacket ?? null,
    userAuthorityChecks: research.userAuthorityChecks ?? [],
    factLedger: research.factLedger ?? [],
    propositionGraph: research.propositionGraph ?? null,
    requiresLawyerReview: research.requiresLawyerReview,
    similarCases: research.similarCases ?? [],
    sectionChecks: research.sectionChecks ?? null,
    creditsUsed: research.creditsUsed,
    fromCache: research.fromCache ?? false,
    aiOutputId: research.aiOutputId,
    stageTimings: {
      queueWait: context.queueWaitMs,
      ...(research.stageTimings ?? {}),
    },
  };
}
