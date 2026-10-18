import { EvidenceConfidenceService } from './evidence-confidence.service';
import { FactLedgerService } from './fact-ledger.service';
import type {
  ApplicationNode,
  FactPropositionNode,
  LegalRuleNode,
  PropositionGraph,
  PropositionNode,
} from './high-confidence-research.types';
import { PropositionGraphValidatorService } from './proposition-graph-validator.service';
import { ResearchPublicationDecisionService } from './research-publication-decision.service';

describe('high-confidence legal research foundation', () => {
  const scope = { tenantId: 'tenant-a', matterId: 'matter-1' };
  let confidence: EvidenceConfidenceService;
  let ledger: FactLedgerService;
  let validator: PropositionGraphValidatorService;
  let publication: ResearchPublicationDecisionService;

  beforeEach(() => {
    confidence = new EvidenceConfidenceService();
    ledger = new FactLedgerService();
    validator = new PropositionGraphValidatorService(ledger);
    publication = new ResearchPublicationDecisionService(validator);
  });

  function verifiedLegal(nodeId = 'rule'): LegalRuleNode {
    return {
      ...scope,
      nodeId,
      kind: 'LEGAL_RULE',
      statement: 'A claimant must prove duty, breach, causation, and damage.',
      materiality: 'MATERIAL',
      qualifiers: {
        jurisdiction: 'IN',
        court: 'Supreme Court of India',
        asOfDate: '2026-07-28',
        currentLawStatus: 'CURRENT',
        conditions: ['The claim sounds in negligence'],
      },
      confidence: confidence.assessLegal({
        authorityIdentity: 'VERIFIED',
        pinpointSupport: 'VERIFIED',
        passageEntailment: 'VERIFIED',
        treatment: 'VERIFIED',
        currentLaw: 'VERIFIED',
      }),
    };
  }

  function createFact(
    factId = 'fact',
    status: 'VERIFIED' | 'DISPUTED' | 'ASSUMED' | 'UNVERIFIED' = 'VERIFIED',
    materiality: 'DISPOSITIVE' | 'MATERIAL' | 'CONTEXT' = 'MATERIAL',
  ): FactPropositionNode {
    if (status === 'VERIFIED') {
      ledger.registerSource(scope, {
        sourceId: `source-${factId}`,
        kind: 'COURT_RECORD',
        title: `Record for ${factId}`,
      });
    }
    ledger.createRecord({
      ...scope,
      factId,
      statement: `The record establishes ${factId}.`,
      status,
      materiality,
      sources:
        status === 'VERIFIED'
          ? [
              {
                sourceId: `source-${factId}`,
                pinpoint: { page: 4, quote: `Evidence of ${factId}` },
                supports: true,
              },
            ]
          : [],
    });
    return {
      ...scope,
      nodeId: `node-${factId}`,
      kind: 'FACT',
      factId,
      statement: `The record establishes ${factId}.`,
      materiality,
    };
  }

  function application(nodeId = 'application'): ApplicationNode {
    return {
      ...scope,
      nodeId,
      kind: 'APPLICATION',
      statement: 'The verified rule applies to the verified facts.',
      materiality: 'MATERIAL',
    };
  }

  function graph(
    nodes: PropositionNode[],
    dependencies: Array<[string, string]>,
    conflicts: Array<[string, string]> = [],
  ): PropositionGraph {
    return {
      ...scope,
      nodes,
      edges: [
        ...dependencies.map(([fromNodeId, toNodeId], index) => ({
          edgeId: `dependency-${index}`,
          fromNodeId,
          toNodeId,
          kind: 'DEPENDS_ON' as const,
        })),
        ...conflicts.map(([fromNodeId, toNodeId], index) => ({
          edgeId: `conflict-${index}`,
          fromNodeId,
          toNodeId,
          kind: 'CONFLICTS_WITH' as const,
        })),
      ],
    };
  }

  it('uses the weakest evidence dimension and applies a conflict ceiling', () => {
    const weakProfile = confidence.assessLegal({
      authorityIdentity: 'VERIFIED',
      pinpointSupport: 'CORROBORATED',
      passageEntailment: 'VERIFIED',
      treatment: 'VERIFIED',
      currentLaw: 'VERIFIED',
    });
    const conflictedProfile = confidence.assessLegal({
      authorityIdentity: 'VERIFIED',
      pinpointSupport: 'VERIFIED',
      passageEntailment: 'VERIFIED',
      treatment: 'VERIFIED',
      currentLaw: 'VERIFIED',
      conflicts: ['Two authenticated reports state incompatible holdings'],
    });

    expect(weakProfile.level).toBe('CORROBORATED');
    expect(conflictedProfile.level).toBe('TENTATIVE');
    expect(conflictedProfile.ceiling).toBe('TENTATIVE');
  });

  it('isolates fact records by tenant and matter and requires pinpoints', () => {
    ledger.registerSource(scope, {
      sourceId: 'pleading',
      kind: 'COURT_RECORD',
      title: 'Filed pleading',
    });
    expect(() =>
      ledger.createRecord({
        ...scope,
        factId: 'filing-date',
        statement: 'The claim was filed on 1 July.',
        status: 'VERIFIED',
        materiality: 'MATERIAL',
        sources: [
          { sourceId: 'pleading', pinpoint: {}, supports: true },
        ],
      }),
    ).toThrow('requires a page, paragraph, section, timestamp, or quote');

    ledger.createRecord({
      ...scope,
      factId: 'filing-date',
      statement: 'The claim was filed on 1 July.',
      status: 'VERIFIED',
      materiality: 'MATERIAL',
      sources: [
        { sourceId: 'pleading', pinpoint: { page: 1 }, supports: true },
      ],
    });
    expect(
      ledger.getRecord(
        { tenantId: 'tenant-b', matterId: scope.matterId },
        'filing-date',
      ),
    ).toBeUndefined();

    ledger.createRecord({
      ...scope,
      factId: 'unsupported-assumption',
      statement: 'An unsupported assumption.',
      status: 'ASSUMED',
      materiality: 'CONTEXT',
    });
    expect(() =>
      ledger.updateStatus(scope, 'unsupported-assumption', 'VERIFIED'),
    ).toThrow('A verified fact requires at least one supporting source');
  });

  it('returns VERIFIED only for applications with verified legal and factual dependencies', () => {
    const rule = verifiedLegal();
    const fact = createFact();
    const apply = application();
    const result = publication.evaluate(
      graph(
        [rule, fact, apply],
        [
          [apply.nodeId, rule.nodeId],
          [apply.nodeId, fact.nodeId],
        ],
      ),
    );

    expect(result.decision).toBe('VERIFIED');
    expect(result.publishableNodeIds).toEqual([apply.nodeId]);
    expect(result.issues).toEqual([]);
  });

  it('fails closed when Kenya Verified citation requirements are incomplete', () => {
    const rule = verifiedLegal();
    const fact = createFact();
    const apply = application();
    const result = publication.evaluate(
      graph(
        [rule, fact, apply],
        [
          [apply.nodeId, rule.nodeId],
          [apply.nodeId, fact.nodeId],
        ],
      ),
      {
        jurisdiction: 'KE',
        kenyaVerifiedRequested: true,
        citationAudit: {
          verifiedMarkdown: '',
          claims: [],
          unsupportedClaims: [],
          citationCount: 1,
          verifiedCitationCount: 0,
          warnings: [],
          kenyaVerified: false,
          verificationDowngradeReasons: ['Exact Kenya source deep link is missing.'],
        },
      },
    );

    expect(result.decision).toBe('GAP');
    expect(result.publishableNodeIds).toEqual([]);
    expect(result.reasons).toContain('Exact Kenya source deep link is missing.');
  });

  it('downgrades material conflicts to PARTIAL even when an application is independently verified', () => {
    const rule = verifiedLegal();
    const adverseRule = verifiedLegal('adverse-rule');
    const fact = createFact();
    const apply = application();
    const result = publication.evaluate(
      graph(
        [rule, adverseRule, fact, apply],
        [
          [apply.nodeId, rule.nodeId],
          [apply.nodeId, fact.nodeId],
        ],
        [[rule.nodeId, adverseRule.nodeId]],
      ),
    );

    expect(result.decision).toBe('PARTIAL');
    expect(result.publishableNodeIds).toEqual([apply.nodeId]);
    expect(result.issues.map((issue) => issue.code)).toContain(
      'MATERIAL_CONFLICT',
    );
  });

  it('returns GAP when the current-law status of a required rule is unknown', () => {
    const rule = verifiedLegal();
    rule.qualifiers.currentLawStatus = 'UNKNOWN';
    rule.confidence = confidence.assessLegal({
      authorityIdentity: 'VERIFIED',
      pinpointSupport: 'VERIFIED',
      passageEntailment: 'VERIFIED',
      treatment: 'VERIFIED',
      currentLaw: 'UNKNOWN',
    });
    const fact = createFact();
    const apply = application();
    const result = publication.evaluate(
      graph(
        [rule, fact, apply],
        [
          [apply.nodeId, rule.nodeId],
          [apply.nodeId, fact.nodeId],
        ],
      ),
    );

    expect(result.decision).toBe('GAP');
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'CURRENT_LAW_UNKNOWN',
        'APPLICATION_UNVERIFIED_LEGAL_DEPENDENCY',
      ]),
    );
  });

  it('returns GAP for an assumed dispositive fact', () => {
    const rule = verifiedLegal();
    const fact = createFact('causation', 'ASSUMED', 'DISPOSITIVE');
    const apply = application();
    const result = publication.evaluate(
      graph(
        [rule, fact, apply],
        [
          [apply.nodeId, rule.nodeId],
          [apply.nodeId, fact.nodeId],
        ],
      ),
    );

    expect(result.decision).toBe('GAP');
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'MISSING_DISPOSITIVE_FACT',
        'APPLICATION_UNVERIFIED_FACTUAL_DEPENDENCY',
      ]),
    );
  });

  it('abstains from publication when dependencies are circular', () => {
    const rule = verifiedLegal();
    const fact = createFact();
    const apply = application();
    const result = publication.evaluate(
      graph(
        [rule, fact, apply],
        [
          [apply.nodeId, rule.nodeId],
          [apply.nodeId, fact.nodeId],
          [rule.nodeId, apply.nodeId],
        ],
      ),
    );

    expect(result.decision).toBe('ABSTAIN');
    expect(result.publishableNodeIds).toEqual([]);
    expect(result.issues.map((issue) => issue.code)).toContain(
      'CIRCULAR_DEPENDENCY',
    );
  });
});
