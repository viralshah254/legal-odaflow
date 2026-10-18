/**
 * C12 – Research/Draft/Release application service ownership spec
 *
 * Verifies:
 * 1. ResearchApplicationService is the canonical research entry point for controllers.
 * 2. ResearchApplicationService delegates to AiGatewayService (single engine, no duplicate).
 * 3. The AiController research route calls ResearchApplicationService, not AiGatewayService directly.
 * 4. No "second engine" — a parallel research implementation does not exist.
 *
 * These tests inspect the architectural invariant structurally.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// ResearchApplicationService ownership
// ---------------------------------------------------------------------------

describe('C12 – ResearchApplicationService ownership contract', () => {
  it('ResearchApplicationService delegates to AiGatewayService (no second engine)', () => {
    const src = readSrc('ai/legal-research/research-application.service.ts');

    // Must import and use AiGatewayService
    expect(src).toContain('AiGatewayService');
    expect(src).toContain('runLawyerLegalResearch');

    // Must NOT implement its own research logic (that would be a second engine)
    const hasOwnResearch =
      src.includes('retrieveAuthorities') ||
      src.includes('generateResearch') ||
      src.includes('callLlm') ||
      src.includes('buildPrompt') ||
      src.includes('runRetrieve');
    expect(hasOwnResearch).toBe(false);
  });

  it('AiController.research() calls researchApplication.runLawyerResearch(), not gateway directly', () => {
    const src = readSrc('ai/ai.controller.ts');

    // Must use the application service
    expect(src).toContain('researchApplication');
    expect(src).toContain('runLawyerResearch');

    // Must NOT call gateway.runLawyerLegalResearch() directly from the controller
    // (that would bypass the application service boundary)
    const callsGatewayDirectly =
      src.includes('aiGateway.runLawyerLegalResearch') ||
      src.includes('this.gateway.runLawyerLegalResearch');
    expect(callsGatewayDirectly).toBe(false);
  });

  it('ResearchApplicationService runLawyerResearch type matches AiGatewayService signature', () => {
    const src = readSrc('ai/legal-research/research-application.service.ts');

    // The method uses Parameters<AiGatewayService['runLawyerLegalResearch']>[0]
    // which proves the parameter type is derived from the gateway, not separately defined
    expect(src).toContain("Parameters<AiGatewayService['runLawyerLegalResearch']>");
  });
});

// ---------------------------------------------------------------------------
// DraftPipeline ownership
// ---------------------------------------------------------------------------

describe('C12 – Draft pipeline ownership contract', () => {
  it('draft-pipeline.service.ts uses UniversalReleaseGateService.evaluateAsync() (C03 fix applied)', () => {
    const src = readSrc('ai/drafting/platform/draft-pipeline.service.ts');

    // After C03 fix, must use evaluateAsync not evaluate
    expect(src).toContain('evaluateAsync');
    expect(src).not.toContain('this.releaseGate.evaluate(');
  });

  it('draft-job.service.ts stores requestSnapshot in executionPlanJson (C06 fix applied)', () => {
    const src = readSrc('ai/unified-drafting/draft-job.service.ts');

    expect(src).toContain('requestSnapshot');
    expect(src).toContain('facts: dto.facts');
  });

  it('DraftJobDispatchReconcilerService reads from requestSnapshot (not sparse fields)', () => {
    const src = readSrc('ai/unified-drafting/draft-job-dispatch-reconciler.service.ts');

    expect(src).toContain('requestSnapshot');
    expect(src).toContain('snapshot.facts');
    expect(src).toContain('snapshot.jurisdiction');
  });
});

// ---------------------------------------------------------------------------
// Release ownership
// ---------------------------------------------------------------------------

describe('C12 – Release gate ownership contract', () => {
  it('UniversalReleaseGateService has evaluateAsync() method (C03 fix applied)', () => {
    const src = readSrc('ai/drafting/platform/universal-release-gate.service.ts');
    expect(src).toContain('async evaluateAsync(');
  });

  it('HumanReviewService.toRecord() includes dependency-identity fields (C07 fix applied)', () => {
    const src = readSrc('ai/drafting/platform/human-review.service.ts');
    expect(src).toContain('releaseDigest');
    expect(src).toContain('evidenceRevision');
    expect(src).toContain('courtProfileId');
  });
});

// ---------------------------------------------------------------------------
// Work context ownership
// ---------------------------------------------------------------------------

describe('C12 – WorkContext ownership contract', () => {
  it('WorkContextService uses $transaction for client+matter creation (C04 fix applied)', () => {
    const src = readSrc('work-context/work-context.service.ts');

    // Must use tx.client.create and tx.matter.create inside the transaction
    expect(src).toContain('tx.client.create');
    expect(src).toContain('tx.matter.create');

    // Must not call this.clients.create inside the transaction
    // (that was the B03 defect)
    const txBody = src.match(/\$transaction\(async \(tx\) => \{([\s\S]*?)\}\)/);
    if (txBody) {
      expect(txBody[1]).not.toContain('this.clients.create(');
      expect(txBody[1]).not.toContain('this.matters.create(');
    }
  });

  it('StartWorkRequestDto includes operationRequestKey (C04 fix applied)', () => {
    const src = readSrc('work-context/start-work.dto.ts');
    expect(src).toContain('operationRequestKey');
  });
});
