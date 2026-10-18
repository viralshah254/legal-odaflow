/**
 * C03 – Statute release path integration spec (B02 fix)
 *
 * Verifies that:
 * 1. UniversalReleaseGateService.evaluateAsync() invokes StatuteExistenceVerifier.evaluateAsync()
 * 2. A missing primary-law section surfaces as a 'blocker' in the gate result
 * 3. A section confirmed by BareActLookup does NOT produce a blocker
 * 4. The sync evaluate() path still works (backwards compatibility)
 */
import { StatuteExistenceVerifier } from './validators/statute-existence-verifier';
import type { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import type { CaseRecord } from '../contracts/case-record';
import type { ReleaseGateEvaluateInput } from './universal-release-gate.service';

// ---------------------------------------------------------------------------
// Minimal stubs for the gate's heavy dependencies
// ---------------------------------------------------------------------------

function noop() { return []; }

function makeGateStubs() {
  return {
    chronologyDeterministic: { evaluate: noop, version: 'det-v1' },
    chronologySemantic: { evaluate: noop, version: 'sem-v1' },
    partyConsistency: { evaluate: noop, version: 'party-v1' },
    factEntailment: { evaluate: noop, version: 'ent-v1' },
    leakSanitizer: {
      sanitize: () => ({ findings: [], hadLeaks: false }),
      version: 'leak-v1',
    },
    authorityVerification: { evaluate: noop, version: 'auth-v1' },
    sourceConflicts: { evaluate: () => ({ findings: [] }) },
    playbookRegistry: { isVerificationStale: () => false },
    metrics: { recordReleaseGate: () => undefined },
    accuracyOrchestrator: {
      evaluate: () => ({
        findings: [],
        byValidator: {},
      }),
    },
    provenance: { record: () => undefined },
  };
}

function makeMinimalCaseRecord(statutes: CaseRecord['statutes'] = []): CaseRecord {
  return {
    metadata: {
      caseRecordId: 'cr-test',
      version: 1,
      status: 'confirmed',
      extractedAt: new Date().toISOString(),
      sourceHash: 'x',
      playbookId: 'p',
      playbookVersion: '1',
    },
    jurisdiction: { countryCode: 'IN' },
    parties: [],
    facts: [],
    chronology: [],
    evidence: [],
    statutes,
    suggestedStatutes: [],
    contradictions: [],
    missingFields: [],
    matterData: {},
  };
}

function makePlaybook() {
  return {
    documentKind: 'bail_application',
    version: '1',
    jurisdiction: 'IN',
    filingGrade: false,
    minVerifiedCaseAuthorities: 0,
    issueTaxonomy: [],
    releaseChecks: [],
    requiredSections: [],
  };
}

function makeAdapter() {
  return {
    validateDraft: () => [],
    validatePrayer: () => [],
    validateVerification: () => [],
  };
}

function makeStructuredDraft() {
  return {
    id: 'draft-1',
    fullMarkdown: '# Draft\n\nTest content.',
    caseRecordVersion: 1,
    playbookVersion: '1',
  };
}

// Dynamically build a gate instance to avoid Nest DI overhead
async function buildGate(bareActLookup?: BareActLookupService) {
  const { UniversalReleaseGateService } = await import('./universal-release-gate.service');
  const stubs = makeGateStubs();
  return new (UniversalReleaseGateService as any)(
    stubs.chronologyDeterministic,
    stubs.chronologySemantic,
    stubs.partyConsistency,
    stubs.factEntailment,
    stubs.leakSanitizer,
    new StatuteExistenceVerifier(bareActLookup),
    stubs.authorityVerification,
    stubs.sourceConflicts,
    stubs.playbookRegistry,
    stubs.metrics,
    stubs.accuracyOrchestrator,
    stubs.provenance,
  ) as InstanceType<typeof UniversalReleaseGateService>;
}

function makeInput(overrides: Partial<ReleaseGateEvaluateInput> = {}): ReleaseGateEvaluateInput {
  return {
    caseRecord: makeMinimalCaseRecord(),
    structuredDraft: makeStructuredDraft() as any,
    playbook: makePlaybook() as any,
    adapter: makeAdapter() as any,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('C03 – Statute release path: evaluateAsync() uses BareActLookup', () => {
  it('evaluateAsync calls BareActLookup.lookupExactSection for known acts', async () => {
    const lookupCalls: string[] = [];
    const mockBareAct: BareActLookupService = {
      lookupExactSection: jest.fn(async (actId, section) => {
        lookupCalls.push(`${actId}:${section}`);
        return { found: true };
      }),
    } as unknown as BareActLookupService;

    const gate = await buildGate(mockBareAct);
    const input = makeInput({
      caseRecord: makeMinimalCaseRecord([
        { id: 's1', actId: 'IPC', section: '302', raw: 'IPC s.302', charged: true },
      ]),
    });

    await gate.evaluateAsync(input);

    expect(lookupCalls).toContain('IPC:302');
  });

  it('evaluateAsync surfaces a blocker when section is not found in primary law', async () => {
    const mockBareAct: BareActLookupService = {
      lookupExactSection: jest.fn(async () => ({ found: false })),
    } as unknown as BareActLookupService;

    const gate = await buildGate(mockBareAct);
    const input = makeInput({
      caseRecord: makeMinimalCaseRecord([
        { id: 's1', actId: 'IPC', section: '999', raw: 'IPC s.999', charged: true },
      ]),
    });

    const result = await gate.evaluateAsync(input);

    const sectionCheck = result.checks['section_existence'];
    expect(sectionCheck).toBeDefined();
    const hasBlocker = sectionCheck.findings.some(
      (f) => f.severity === 'blocker' && f.id.includes('missing_section'),
    );
    expect(hasBlocker).toBe(true);
    expect(result.status).toBe('draft_blocked');
  });

  it('evaluateAsync does NOT produce section blocker when lookup confirms section', async () => {
    const mockBareAct: BareActLookupService = {
      lookupExactSection: jest.fn(async () => ({ found: true })),
    } as unknown as BareActLookupService;

    const gate = await buildGate(mockBareAct);
    const input = makeInput({
      caseRecord: makeMinimalCaseRecord([
        { id: 's1', actId: 'IPC', section: '302', raw: 'IPC s.302', charged: true },
      ]),
    });

    const result = await gate.evaluateAsync(input);

    const sectionBlockers = (result.checks['section_existence']?.findings ?? []).filter(
      (f) => f.severity === 'blocker' && f.id.includes('missing_section'),
    );
    expect(sectionBlockers).toHaveLength(0);
  });

  it('sync evaluate() does NOT call BareActLookup (expected limitation, B02 document)', () => {
    // The sync path is kept for callers that cannot await; evaluateAsync is preferred.
    let lookupCalled = false;
    const mockBareAct: BareActLookupService = {
      lookupExactSection: jest.fn(async () => {
        lookupCalled = true;
        return { found: false };
      }),
    } as unknown as BareActLookupService;

    // Build synchronously — we can't use the async builder here
    const { UniversalReleaseGateService } = require('./universal-release-gate.service');
    const stubs = makeGateStubs();
    const gate = new UniversalReleaseGateService(
      stubs.chronologyDeterministic,
      stubs.chronologySemantic,
      stubs.partyConsistency,
      stubs.factEntailment,
      stubs.leakSanitizer,
      new StatuteExistenceVerifier(mockBareAct),
      stubs.authorityVerification,
      stubs.sourceConflicts,
      stubs.playbookRegistry,
      stubs.metrics,
      stubs.accuracyOrchestrator,
      stubs.provenance,
    );

    gate.evaluate(makeInput({
      caseRecord: makeMinimalCaseRecord([
        { id: 's1', actId: 'IPC', section: '999', raw: 'IPC s.999', charged: true },
      ]),
    }));

    // Sync path does not invoke bare act lookup — this is documented behavior.
    // All release routes must use evaluateAsync().
    expect(lookupCalled).toBe(false);
  });

  it('evaluateAsync without BareActLookup still returns a result (graceful degradation)', async () => {
    const gate = await buildGate(undefined); // no lookup service
    const input = makeInput({
      caseRecord: makeMinimalCaseRecord([
        { id: 's1', actId: 'IPC', section: '302', raw: 'IPC s.302', charged: true },
      ]),
    });

    const result = await gate.evaluateAsync(input);
    expect(result.status).toBeDefined();
    // No blocker from missing_section because bare-act service is absent
    const blockers = (result.checks['section_existence']?.findings ?? []).filter(
      (f) => f.id.includes('missing_section'),
    );
    expect(blockers).toHaveLength(0);
  });

  it('evaluateAsync produces unknown_act warning for unrecognized act IDs', async () => {
    const gate = await buildGate(undefined);
    const input = makeInput({
      caseRecord: makeMinimalCaseRecord([
        { id: 's1', actId: 'FAKEACT', section: '99', raw: 'FAKEACT s.99', charged: true },
      ]),
    });

    const result = await gate.evaluateAsync(input);
    const unknownWarning = (result.checks['section_existence']?.findings ?? []).some(
      (f) => f.message.includes('Unrecognized actId'),
    );
    expect(unknownWarning).toBe(true);
  });
});
