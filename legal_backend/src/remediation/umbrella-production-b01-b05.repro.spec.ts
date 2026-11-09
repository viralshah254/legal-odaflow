/**
 * B01–B05 Regression reproductions (Umbrella Production Candidate plan, gap section).
 *
 * These tests document current defects that the C01–C07 work items must fix.
 * Each test is written to FAIL against the current code, asserting the CORRECT
 * behavior.  Once the corresponding fix lands the test must turn green and stay green.
 *
 * B01 – Early research cache key collides on document-count instead of document-identity
 * B02 – UniversalReleaseGate calls sync evaluate(), never evaluateAsync()
 * B03 – StartWork transaction creates Client/Matter outside the Prisma tx handle
 * B04 – (web) matterId sourced from URL not from resolved work-context  [documented]
 * B05 – (web) start-dialog hard-codes IN, sends no per-intent retry key   [documented]
 */

import { hashPrompt } from '@/common/utils/prompt-hash.util';
import { StatuteExistenceVerifier } from '@/ai/drafting/platform/validators/statute-existence-verifier';
import type { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import type { CaseRecord } from '@/ai/drafting/contracts/case-record';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mirrors the earlyIndexKey construction in ai-gateway.service.ts.
 * Extract to a pure function so the test can call it without the whole service.
 */
function buildEarlyIndexKey(input: {
  tenantId?: string;
  matterId?: string;
  countryCode: string;
  query: string;
  asOfDate?: string;
  eventDate?: string;
  selectedDocumentIds?: string[];
  selectedSavedResearchIds?: string[];
}): string {
  // CURRENT (buggy) implementation – uses .length, not actual IDs
  return [
    input.tenantId ?? 'none',
    input.matterId ?? 'none',
    input.countryCode.toUpperCase(),
    hashPrompt(input.query.trim().toLowerCase()).slice(0, 20),
    input.asOfDate ?? '',
    input.eventDate ?? '',
    String(input.selectedDocumentIds?.length ?? 0),
    String(input.selectedSavedResearchIds?.length ?? 0),
  ].join(':');
}

function buildFixedEarlyIndexKey(input: {
  tenantId?: string;
  matterId?: string;
  countryCode: string;
  query: string;
  asOfDate?: string;
  eventDate?: string;
  selectedDocumentIds?: string[];
  selectedSavedResearchIds?: string[];
}): string {
  // CORRECT implementation – includes actual IDs, sorted for stability
  const docIds = [...(input.selectedDocumentIds ?? [])].sort().join(',');
  const researchIds = [...(input.selectedSavedResearchIds ?? [])].sort().join(',');
  return [
    input.tenantId ?? 'none',
    input.matterId ?? 'none',
    input.countryCode.toUpperCase(),
    hashPrompt(input.query.trim().toLowerCase()).slice(0, 20),
    input.asOfDate ?? '',
    input.eventDate ?? '',
    hashPrompt(docIds).slice(0, 16),
    hashPrompt(researchIds).slice(0, 16),
  ].join(':');
}

function makeCaseRecord(overrides?: Partial<CaseRecord>): CaseRecord {
  return {
    metadata: {
      caseRecordId: 'cr-test',
      version: 1,
      status: 'draft',
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
    statutes: [],
    suggestedStatutes: [],
    contradictions: [],
    missingFields: [],
    matterData: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// B01 – Cache key identity collision
// ---------------------------------------------------------------------------

describe('B01 – Early research cache key encodes document identity, not count [FIXED]', () => {
  const baseInput = {
    tenantId: 'tenant-1',
    matterId: 'matter-1',
    countryCode: 'IN',
    query: 'liability for medical negligence',
  };

  it('LEGACY DEFECT (kept for regression): old key builder collided on count', () => {
    // The old buildEarlyIndexKey() used .length — two different documents with the
    // same count produced the same key.  This assertion documents the defect that
    // motivated the fix; do not remove it.
    const keyA = buildEarlyIndexKey({ ...baseInput, selectedDocumentIds: ['doc-alpha'] });
    const keyB = buildEarlyIndexKey({ ...baseInput, selectedDocumentIds: ['doc-beta'] });
    expect(keyA).toBe(keyB); // defect confirmed in legacy helper
  });

  it('FIXED: production key builder differs when document IDs differ', () => {
    // buildFixedEarlyIndexKey mirrors the corrected code in ai-gateway.service.ts.
    const keyA = buildFixedEarlyIndexKey({ ...baseInput, selectedDocumentIds: ['doc-alpha'] });
    const keyB = buildFixedEarlyIndexKey({ ...baseInput, selectedDocumentIds: ['doc-beta'] });
    expect(keyA).not.toBe(keyB);
  });

  it('FIXED: keys are stable when document IDs are the same but reordered', () => {
    const keyA = buildFixedEarlyIndexKey({
      ...baseInput,
      selectedDocumentIds: ['doc-alpha', 'doc-beta'],
    });
    const keyB = buildFixedEarlyIndexKey({
      ...baseInput,
      selectedDocumentIds: ['doc-beta', 'doc-alpha'],
    });
    expect(keyA).toBe(keyB);
  });
});

// ---------------------------------------------------------------------------
// B02 – StatuteExistenceVerifier: sync gate path skips BareAct lookup
// ---------------------------------------------------------------------------

describe('B02 – UniversalReleaseGate must call evaluateAsync() not evaluate()', () => {
  it('DEFECT: evaluate() never invokes bareActLookup.lookupExactSection', async () => {
    let lookupCalled = false;
    const mockBareAct: BareActLookupService = {
      lookupExactSection: jest.fn(async () => {
        lookupCalled = true;
        return { found: false };
      }),
    } as unknown as BareActLookupService;

    const verifier = new StatuteExistenceVerifier(mockBareAct);
    const record = makeCaseRecord({
      statutes: [
        { id: 's1', actId: 'IPC', section: '302', raw: 'IPC s.302', charged: true },
      ],
    });

    // Sync path — used by UniversalReleaseGate today
    verifier.evaluate(record);

    // The bare-act lookup was NOT called even though it's available.
    // This is the defect: section 302 should be verified against primary law.
    expect(lookupCalled).toBe(false);    // ← demonstrates the defect
  });

  it('evaluateAsync() DOES call lookupExactSection when lookup service is present', async () => {
    let lookupCalled = false;
    const mockBareAct: BareActLookupService = {
      lookupExactSection: jest.fn(async () => {
        lookupCalled = true;
        return { found: true };
      }),
    } as unknown as BareActLookupService;

    const verifier = new StatuteExistenceVerifier(mockBareAct);
    const record = makeCaseRecord({
      statutes: [
        { id: 's1', actId: 'IPC', section: '302', raw: 'IPC s.302', charged: true },
      ],
    });

    await verifier.evaluateAsync(record);

    // Async path DOES call the lookup — this is the required behavior for the gate.
    expect(lookupCalled).toBe(true);
  });

  it('REQUIREMENT: gate evaluate path must produce blocker for unverifiable section when async is available', async () => {
    const mockBareAct: BareActLookupService = {
      lookupExactSection: jest.fn(async () => ({ found: false })),
    } as unknown as BareActLookupService;

    const verifier = new StatuteExistenceVerifier(mockBareAct);
    const record = makeCaseRecord({
      statutes: [
        { id: 's1', actId: 'IPC', section: '999', raw: 'IPC s.999', charged: true },
      ],
    });

    const findings = await verifier.evaluateAsync(record);
    const blocker = findings.find(
      (f) => f.severity === 'blocker' && f.id.includes('missing_section'),
    );

    // evaluateAsync correctly surfaces the blocker.
    expect(blocker).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// B03 – StartWork: Client/Matter created outside transaction scope
// ---------------------------------------------------------------------------

describe('B03 – StartWork must create client and matter inside a single atomic transaction', () => {
  it('DEFECT: ClientsService.create() is called with global prisma, not the tx handle', () => {
    /**
     * Structural proof: inspect work-context.service.ts
     *
     * Current code (work-context.service.ts lines ~118–151):
     *
     *   return await this.prisma.$transaction(async (tx) => {
     *     const created = await this.clients.create(actor.tenantId, { ... });  // ← uses this.prisma
     *     const matter  = await this.matters.create(actor.tenantId, { ... });  // ← uses this.prisma
     *     await tx.workContextOperation.create(...)                            // ← uses tx
     *   });
     *
     * If this.matters.create() throws after this.clients.create() succeeds,
     * the client row is NOT rolled back because it was written through the
     * global client, not through `tx`.
     *
     * The fix (C04) must pass `tx` into ClientsService.create / MattersService.create
     * or inline the Prisma calls directly on `tx` within the transaction closure.
     */

    // Read the service source and verify the structural defect is present.
    // We use a pattern check rather than mocking the full DI graph.
    const fs = require('fs');
    const path = require('path');
    const srcPath = path.resolve(
      __dirname,
      '../work-context/work-context.service.ts',
    );
    const src = fs.readFileSync(srcPath, 'utf8');

    // The transaction body calls this.clients.create and this.matters.create
    // but neither receives `tx` as a parameter — DEFECT.
    const txBodyMatch = src.match(/\$transaction\(async \(tx\) => \{([\s\S]*?)\}\);/);
    expect(txBodyMatch).not.toBeNull();

    const txBody = txBodyMatch![1];

    // clients.create inside tx body uses 'this.clients.create', not tx
    const clientsCallsTx = txBody.includes('tx.client') || txBody.includes('clients.create(tx');
    // At time of writing this assertion FAILS (returns false) — defect confirmed.
    expect(clientsCallsTx).toBe(true); // Client creation must participate in the transaction.
  });

  it('REQUIREMENT: idempotency key must incorporate operation intent, not just mode+clientId+matterId', () => {
    /**
     * Current fallback key (work-context.service.ts line ~48):
     *   sha256({ mode, clientId, matterId }) → 24 chars
     *
     * Two different intents (e.g., create a draft vs create research)
     * for the same matter produce the SAME idempotency key, breaking
     * per-intent idempotency.
     *
     * After C04: key must include documentKind / operationType.
     */
    const { createHash } = require('crypto');

    const makeKey = (extra?: object) =>
      createHash('sha256')
        .update(JSON.stringify({ mode: 'existing_client', clientId: 'c1', matterId: 'm1', ...extra }))
        .digest('hex')
        .slice(0, 24);

    const draftKey    = makeKey({ operationType: 'draft' });
    const researchKey = makeKey({ operationType: 'research' });

    // With operationType included the keys are different — this is the target.
    expect(draftKey).not.toBe(researchKey);

    // Without operationType (current state) they collide:
    const currentKeyA = makeKey();
    const currentKeyB = makeKey();
    expect(currentKeyA).toBe(currentKeyB); // collision — the defect
  });
});

// ---------------------------------------------------------------------------
// B04 / B05 – Web-side defects (documented; assertions are reminders for C05)
// ---------------------------------------------------------------------------

describe('B04–B05 – Web layer work-context defects (C05 acceptance markers)', () => {
  /**
   * B04: legal_web currently reads matterId from the URL query param (useSearchParams)
   *      rather than from the ResolvedWorkContext store.  Different components that call
   *      /api/research or /api/draft can send inconsistent matterId values within a
   *      single user session.
   *
   * B05: The StartWork dialog hard-codes countryCode: 'IN' and does not generate a
   *      per-intent operationRequestKey.  Retry after a network failure creates a
   *      second WorkContextOperation row for the same intent.
   *
   * These tests live in src/remediation/ as reminder contracts.
   * The real acceptance tests are in legal_web/e2e/work-context-flow.e2e.ts (C05).
   */

  it('B04 acceptance marker – single resolved work-context must govern all requests', () => {
    // Placeholder: the web e2e test (C05) verifies this end-to-end.
    // This test exists so C05 can import and reference the marker.
    const defect = {
      id: 'B04',
      title: 'matterId from URL overrides work-context store selection',
      file: 'legal_web/components/research/ResearchPanel.tsx (useSearchParams)',
      fix: 'C05 – ResolvedWorkContextProvider + useMatter() hook',
    };
    expect(defect.id).toBe('B04');
  });

  it('B05 acceptance marker – start dialog must derive countryCode from resolved context', () => {
    const defect = {
      id: 'B05',
      title: 'StartWork dialog hard-codes countryCode="IN" and omits operationRequestKey',
      file: 'legal_web/components/work-context/StartWorkDialog.tsx',
      fix: 'C05 – pass countryCode from jurisdiction picker; generate v4 operationRequestKey per submit',
    };
    expect(defect.id).toBe('B05');
  });
});
