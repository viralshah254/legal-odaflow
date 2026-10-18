import {
  buildResearchAuditPacket,
  hashResearchAuditValue,
  validateResearchAuditReplay,
  type BuildResearchAuditPacketInput,
} from './research-audit-packet';

function input(): BuildResearchAuditPacketInput {
  return {
    packetId: 'packet-1',
    createdAt: '2026-07-27T00:00:00.000Z',
    normalizedRequest: {
      query: '  Is   section 69 applicable? ',
      countryCode: 'in',
      researchMode: 'DEEP',
    },
    capability: { id: 'legal-research', version: '2' },
    task: { id: 'task-1', type: 'statute_interpretation' },
    plan: { id: 'plan-1', issues: ['section-69'] },
    queries: [{ id: 'q1', text: 'section 69 dissolution exception' }],
    sources: [
      {
        id: 'source-1',
        title: 'Indian Partnership Act',
        content: 'Section 69(3)(a)',
      },
    ],
    decisions: [
      {
        candidateId: 'source-1',
        decision: 'admitted',
        reasonCodes: ['PRIMARY_AUTHORITY'],
      },
      {
        candidateId: 'source-2',
        decision: 'rejected',
        reasonCodes: ['IDENTITY_UNVERIFIED'],
      },
    ],
    passages: [
      {
        id: 'passage-1',
        sourceId: 'source-1',
        text: 'The disabilities do not affect dissolution proceedings.',
        propositionIds: ['proposition-1'],
      },
    ],
    issueGraph: {
      nodes: [{ id: 'section-69' }],
      edges: [],
    },
    authorityGraph: {
      nodes: [{ id: 'source-1' }],
      edges: [],
    },
    temporalResults: [{ authorityId: 'source-1', status: 'current' }],
    conflictResults: [{ issueId: 'section-69', status: 'resolved' }],
    verification: { safeForReliance: true },
    publication: { state: 'published' },
    output: 'Section 69 contains a dissolution exception.',
    models: [{ id: 'synthesis', version: 'model-1' }],
    prompts: [{ id: 'research', version: 'prompt-3' }],
    dependencySet: { corpus: 'india-2026-07', code: 'commit-1' },
    confidence: 0.91,
    humanApproval: { status: 'pending' },
    privacy: {
      classification: 'confidential',
      containsPersonalData: false,
      redactionApplied: true,
      redactionPolicyVersion: '2',
      redactedFields: ['normalizedRequest.matterId'],
    },
  };
}

describe('ResearchAuditPacket', () => {
  it('builds a normalized, hash-linked packet and separates approval from confidence', () => {
    const packet = buildResearchAuditPacket(input());

    expect(packet.normalizedRequest).toMatchObject({
      query: 'Is section 69 applicable?',
      countryCode: 'IN',
      researchMode: 'deep',
    });
    expect(packet.sources[0]).not.toHaveProperty('content');
    expect(packet.sources[0].contentHash).toBe(
      hashResearchAuditValue('Section 69(3)(a)'),
    );
    expect(packet.admissions).toHaveLength(1);
    expect(packet.rejections).toHaveLength(1);
    expect(packet.confidence).toBe(0.91);
    expect(packet.humanApproval.status).toBe('pending');
    expect(validateResearchAuditReplay(packet)).toEqual({
      valid: true,
      failures: [],
    });
  });

  it('detects replay drift in outputs, sources, dependencies, and versions', () => {
    const packet = buildResearchAuditPacket(input());
    const result = validateResearchAuditReplay(packet, {
      output: 'A changed answer',
      sourceContents: { 'source-1': 'Changed source' },
      dependencySet: { corpus: 'india-older', code: 'commit-1' },
      models: [{ id: 'synthesis', version: 'model-2' }],
      prompts: [{ id: 'research', version: 'prompt-4' }],
    });

    expect(result.valid).toBe(false);
    expect(result.failures.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'OUTPUT_HASH_MISMATCH',
        'SOURCE_HASH_MISMATCH',
        'DEPENDENCY_SET_MISMATCH',
        'MODEL_VERSION_MISMATCH',
        'PROMPT_VERSION_MISMATCH',
      ]),
    );
  });

  it('detects packet mutation and invalid passage references', () => {
    const packet = buildResearchAuditPacket(input());
    packet.publication.state = 'blocked';
    packet.passages[0].sourceId = 'missing-source';

    const result = validateResearchAuditReplay(packet);

    expect(result.failures.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['PACKET_HASH_MISMATCH', 'INVALID_REFERENCE']),
    );
  });
});
