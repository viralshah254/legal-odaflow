import type { LawyerResearchResult } from '@/ai/ai-gateway.service';
import { serializeResearchJobResult } from './research-result.serializer';

describe('serializeResearchJobResult', () => {
  it('preserves verification and case-law publication fields', () => {
    const research = {
      outputMarkdown: '# Memo',
      citations: [],
      provider: 'structured-research',
      modelName: 'test-model',
      countryCode: 'IN',
      findings: [{ checkId: 'relevance:1' }],
      propositions: [{ claimId: 'claim_1' }],
      dimensions: { relevance: { state: 'PASS' } },
      publicationState: 'VERIFIED_WITH_LIMITATIONS',
      outputHash: 'abc123',
      caseLawSearchStatus: 'searched',
      issueGaps: [{ issueId: 'i1', issue: 'scope', missingDimension: 'BINDING_AUTHORITY' }],
      sourceDiagnostics: [{ provider: 'india-kanoon', status: 'searched', hitCount: 2 }],
      connectorDiagnostics: [{ provider: 'india-live', status: 'searched', durationMs: 10, hitCount: 2 }],
      rejectedCandidates: [{ authorityId: 'off-topic', gate: 'case_relevance', reason: 'missing anchor' }],
      taskProfile: { kind: 'CASE_COMPARISON' },
      researchPlan: { version: 1, issues: [{ id: 'identity', status: 'SUPPORTED' }] },
      capabilitySnapshot: { confidenceCeiling: 'MEDIUM' },
      confidenceAssessment: { level: 'CORROBORATED' },
      publicationDecision: { decision: 'PARTIAL', blockers: ['Treatment unavailable'] },
      factLedger: [{ id: 'fact_1', statement: 'Fact', status: 'UNVERIFIED' }],
      propositionGraph: { tenantId: 't1', matterId: 'm1', nodes: [], edges: [] },
      auditMetadata: { packetId: 'packet_1', packetHash: 'packet_hash' },
      auditPacket: { schemaVersion: '1.0', packetId: 'packet_1', packetHash: 'packet_hash' },
    } as unknown as LawyerResearchResult;

    const result = serializeResearchJobResult(research, {
      toolName: 'legal_research',
      query: 'partnership arbitration',
      countryCode: 'IN',
      queueWaitMs: 10,
    });

    expect(result).toEqual(
      expect.objectContaining({
        findings: research.findings,
        propositions: research.propositions,
        dimensions: research.dimensions,
        publicationState: 'VERIFIED_WITH_LIMITATIONS',
        outputHash: 'abc123',
        caseLawSearchStatus: 'searched',
        issueGaps: research.issueGaps,
        sourceDiagnostics: research.sourceDiagnostics,
        connectorDiagnostics: research.connectorDiagnostics,
        rejectedCandidates: research.rejectedCandidates,
        taskProfile: research.taskProfile,
        researchPlan: research.researchPlan,
        capabilitySnapshot: research.capabilitySnapshot,
        confidenceAssessment: research.confidenceAssessment,
        publicationDecision: research.publicationDecision,
        factLedger: research.factLedger,
        propositionGraph: research.propositionGraph,
        auditMetadata: research.auditMetadata,
        auditPacket: research.auditPacket,
      }),
    );
  });
});
