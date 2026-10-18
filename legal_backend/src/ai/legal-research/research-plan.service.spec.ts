import { ResearchPlanService } from './research-plan.service';
import { ResearchRequestNormalizerService } from './research-request-normalizer.service';
import { routeResearchTaskDeterministically } from './research-task-router.service';
import type { ResearchCapabilitySnapshot } from './research-planning.types';

describe('ResearchPlanService', () => {
  const normalizer = new ResearchRequestNormalizerService();
  const service = new ResearchPlanService();

  const capabilities: ResearchCapabilitySnapshot = {
    generatedAt: '2026-07-28T00:00:00.000Z',
    jurisdiction: 'IN',
    sources: [],
    availableCapabilities: ['CASE_LAW', 'STATUTES', 'CURRENT_LAW', 'TREATMENT'],
    unavailableCapabilities: ['LIVE_WEB'],
    failClosed: false,
    confidenceCeiling: 'HIGH',
    coveredJurisdictions: ['IN'],
    courtCoverage: [],
    statuteEditions: [],
    treatmentGraphAvailable: true,
    pinpointSupport: true,
    officialSourceAccess: true,
    fullTextSupport: true,
    ocrSupport: false,
    languageSupport: ['en'],
    connectorAvailability: {},
    limitations: [],
  };

  it('generates dependency-aware issues and positive, negative, and contrary queries', () => {
    const request = normalizer.normalize({
      query: 'What is the current law on interpretation of section 11 of the Arbitration Act?',
      countryCode: 'IN',
      asOfDate: '2026-07-28',
    });
    const task = routeResearchTaskDeterministically(request);
    const plan = service.build(request, task, capabilities);

    expect(plan.executable).toBe(true);
    expect(plan.issues.find((issue) => issue.id === 'law')?.status).toBe('PLANNED');
    expect(plan.issues.find((issue) => issue.id === 'authority')).toEqual(
      expect.objectContaining({ dependencies: ['law'], status: 'PLANNED' }),
    );
    expect(plan.queries.map((query) => query.family)).toEqual(
      expect.arrayContaining(['POSITIVE', 'NEGATIVE', 'CONTRARY_AUTHORITY', 'TREATMENT']),
    );
    expect(plan.contraryChecks.every((check) => check.queryIds.length > 0)).toBe(true);
    expect(plan.stoppingConditions.map((condition) => condition.metric)).toContain(
      'CURRENT_LAW_CHECK_COMPLETE',
    );
  });

  it('fails closed before execution when a required capability is unavailable', () => {
    const request = normalizer.normalize({
      query: 'Find adverse authority against the proposition',
      countryCode: 'IN',
    });
    const task = routeResearchTaskDeterministically(request);
    const plan = service.build(request, task, {
      ...capabilities,
      availableCapabilities: ['CASE_LAW'],
      unavailableCapabilities: ['STATUTES', 'CURRENT_LAW', 'LIVE_WEB', 'TREATMENT'],
      failClosed: true,
    });

    expect(task.kind).toBe('ADVERSE_AUTHORITY');
    expect(plan.executable).toBe(false);
    expect(plan.blockers).toContain('Required capability TREATMENT is unavailable or unverified.');
    expect(plan.stoppingConditions).toEqual([
      expect.objectContaining({ metric: 'CAPABILITY_UNAVAILABLE', hard: true }),
    ]);
  });

  it('uses citation-specific issues and stopping conditions', () => {
    const request = normalizer.normalize({
      query: 'Provide the neutral citation for Kesavananda Bharati',
      countryCode: 'IN',
    });
    const task = routeResearchTaskDeterministically(request);
    const plan = service.build(request, task, capabilities);

    expect(task.kind).toBe('CITATION_VERIFICATION');
    expect(plan.issues).toHaveLength(1);
    expect(plan.queries).toEqual([
      expect.objectContaining({ family: 'CITATION', issueId: 'citation' }),
    ]);
    expect(plan.stoppingConditions[0].metric).toBe('CITATION_RESOLVED');
  });

  it('builds an executable CASE_SURVEY without licensed treatment capability', () => {
    const request = normalizer.normalize({
      query:
        'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
      countryCode: 'IN',
      desiredOutput: 'AUTHORITY_LIST',
    });
    const task = routeResearchTaskDeterministically(request);
    const plan = service.build(request, task, {
      ...capabilities,
      availableCapabilities: ['CASE_LAW', 'STATUTES'],
      unavailableCapabilities: ['CURRENT_LAW', 'LIVE_WEB', 'TREATMENT'],
      treatmentGraphAvailable: false,
      limitations: ['Licensed subsequent-treatment graph is unavailable.'],
    });

    expect(task.kind).toBe('CASE_SURVEY');
    expect(plan.executable).toBe(true);
    expect(plan.blockers).not.toContain(
      'Required capability TREATMENT is unavailable or unverified.',
    );
    expect(plan.issues.map((issue) => issue.id)).toEqual([
      'case-discovery',
      'case-outcomes',
    ]);
    expect(plan.queries.slice(0, 3).map((query) => query.priority)).toEqual([1, 1, 1]);
    expect(plan.queries.map((query) => query.query).join('\n')).not.toMatch(
      /verify the identity|contrary-authority protocol/i,
    );
    expect(plan.stoppingConditions).toEqual([
      expect.objectContaining({
        id: 'case-survey-coverage',
        threshold: 2,
        hard: false,
      }),
    ]);
    expect(plan.contraryChecks.every((check) => check.required === false)).toBe(true);
  });
});
