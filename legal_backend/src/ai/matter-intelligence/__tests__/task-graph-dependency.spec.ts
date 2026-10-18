import { DocumentDependencyService } from '../document-dependency.service';
import { MatterTaskGraphService } from '../matter-task-graph.service';
import { ARJUN_WRONGFUL_TERMINATION_FACTS } from './golden-fixtures';
import { MatterIntelligenceService } from '../matter-intelligence.service';
import { ConfidenceGateService } from '../confidence-gate.service';

describe('MatterTaskGraphService', () => {
  const dependency = new DocumentDependencyService();
  const service = new MatterTaskGraphService(dependency);
  const classifier = new MatterIntelligenceService(
    { isProviderConfigured: () => false } as never,
    new ConfidenceGateService(),
  );

  it('builds recommended actions and missing documents for wrongful termination', () => {
    const { profile } = classifier.classifyHeuristic(ARJUN_WRONGFUL_TERMINATION_FACTS, 'IN');
    const graph = {
      parties: [],
      claims: [],
      defences: [],
      statutes: [],
      precedents: [],
      evidence: [],
      documents: [],
      timeline: [],
    };
    const taskGraph = service.build(profile, graph);

    expect(taskGraph.recommendedActions.length).toBeGreaterThan(0);
    expect(taskGraph.nextBestAction).toBeTruthy();
    expect(taskGraph.missingDocuments.length).toBeGreaterThan(0);
  });
});

describe('DocumentDependencyService', () => {
  const service = new DocumentDependencyService();

  it('blocks labour court application without termination letter', () => {
    const result = service.checkPreDraft('india_labour_court_application', []);
    expect(result.canProceed).toBe(false);
    expect(result.missingInputs.length).toBeGreaterThan(0);
  });

  it('allows when termination evidence provided', () => {
    const result = service.checkPreDraft('india_labour_court_application', [
      'termination letter',
      'employment records',
    ]);
    expect(result.canProceed).toBe(true);
  });

  it('accepts interim order described in facts as impugned order context', () => {
    const result = service.checkPreDraft('maintenance_order_revision', [
      'Interim order was issued to pay 100000 per month. Ram challenges the order.',
    ]);
    expect(result.canProceed).toBe(true);
  });
});
