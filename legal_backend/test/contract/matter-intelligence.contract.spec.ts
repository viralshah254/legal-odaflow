/**
 * Contract tests — Matter Intelligence response shapes for web + Flutter clients.
 */
import type {
  MatterClassificationResult,
  MatterGraph,
  MatterProfile,
  MatterTaskGraph,
} from '@/ai/matter-intelligence/matter-intelligence.types';

const MATTER_PROFILE_SHAPE: MatterProfile = {
  country: 'IN',
  practiceArea: 'employment_labour',
  subPracticeArea: 'wrongful_termination',
  nature: 'dispute',
  forum: 'labour_court',
  remedies: ['reinstatement', 'back_wages'],
  issues: ['Illegal termination without inquiry'],
  documentTypes: ['labour_court_petition'],
  documentKind: 'wrongful_termination_petition',
  curatedKinds: ['india_wrongful_termination'],
  confidence: 0.88,
  fieldConfidence: {
    practiceArea: 0.9,
    subPracticeArea: 0.85,
    nature: 0.8,
    forum: 0.7,
  },
};

const MATTER_GRAPH_SHAPE: MatterGraph = {
  parties: [{ name: 'Arjun Patel', role: 'employee', side: 'claimant' }],
  claims: [{ summary: 'Wrongful termination without domestic inquiry' }],
  defences: [],
  statutes: [{ act: 'Industrial Disputes Act', section: '25F' }],
  precedents: [],
  evidence: [{ description: 'Termination letter dated 15 Jan 2025' }],
  documents: [{ title: 'Termination letter' }],
  timeline: [{ date: '2025-01-15', description: 'Termination issued' }],
};

const MATTER_TASK_GRAPH_SHAPE: MatterTaskGraph = {
  recommendedActions: ['Send legal notice', 'File labour court petition'],
  requiredDocuments: ['Termination letter', 'Salary slips'],
  missingDocuments: ['Domestic inquiry report'],
  deadlines: [{ label: 'Limitation', description: 'Check ID Act timeline' }],
  nextBestAction: 'Send legal notice',
};

const MI_RESPONSE_SNAPSHOT: MatterClassificationResult = {
  profile: MATTER_PROFILE_SHAPE,
  graph: MATTER_GRAPH_SHAPE,
  taskGraph: MATTER_TASK_GRAPH_SHAPE,
  clarifyingQuestions: [],
  shouldProceed: true,
  recommendationMode: 'matched',
};

describe('API contract — matter intelligence', () => {
  it('matches stable MatterProfile field set', () => {
    expect(Object.keys(MI_RESPONSE_SNAPSHOT.profile).sort()).toMatchSnapshot();
  });

  it('matches stable MatterGraph field set', () => {
    expect(Object.keys(MI_RESPONSE_SNAPSHOT.graph!).sort()).toMatchSnapshot();
  });

  it('matches stable MatterTaskGraph field set', () => {
    expect(Object.keys(MI_RESPONSE_SNAPSHOT.taskGraph!).sort()).toMatchSnapshot();
  });

  it('matches full classification result snapshot', () => {
    expect(MI_RESPONSE_SNAPSHOT).toMatchSnapshot();
  });

  it('uses canonical recommendation modes', () => {
    expect(['matched', 'low_confidence', 'clarification_required']).toContain(
      MI_RESPONSE_SNAPSHOT.recommendationMode,
    );
  });
});
