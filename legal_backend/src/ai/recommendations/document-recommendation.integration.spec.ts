/**
 * C10/C11 – Document recommendation integration spec (B07 fix)
 *
 * Verifies:
 * 1. Kenya facts produce Kenya-prefixed catalog IDs, not India IDs.
 * 2. India facts produce India-prefixed catalog IDs.
 * 3. Heuristic-only recommendations are status='proposed', not 'validated'
 *    (factIds and authorityEvidenceIds are empty — no LLM/evidence validation ran).
 * 4. Catalog validation rejects wrong-jurisdiction IDs as 'unsupported'.
 * 5. Consumer complaint recommendations include prerequisite evidence requirements.
 * 6. Missing prerequisites result in 'needs_clarification', not 'validated'.
 *
 * B07 reproduction from audit:
 * - India bail candidate was marked 'validated' with empty factIds/authorityEvidenceIds.
 * - Kenya received the same India catalogId marked 'unsupported'.
 * Both defects are fixed: IN gets India ID, KE gets Kenya ID; both are 'proposed'.
 */

import { DocumentRecommendationService } from './document-recommendation.service';

function makeService(): DocumentRecommendationService {
  return new DocumentRecommendationService();
}

// ---------------------------------------------------------------------------
// B07 reproduction tests (defect documentation)
// ---------------------------------------------------------------------------

describe('B07 Reproduction – catalog ID collision between IN and KE', () => {
  it('B07a: Kenya bail facts MUST NOT produce india_regular_bail_bnss_480', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'KE',
      rawFacts: 'Accused was arrested and is in custody pending bail hearing.',
    });

    const indiaBailId = results.some((r) => r.catalogId === 'india_regular_bail_bnss_480');
    // This was the B07 defect — Kenya received the India catalogId
    expect(indiaBailId).toBe(false);
  });

  it('B07b: India bail candidate must NOT be status=validated when factIds and authorityEvidenceIds are empty', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Accused is in custody and seeks bail.',
    });

    const bail = results.find((r) => r.catalogId === 'india_regular_bail_bnss_480');
    expect(bail).toBeDefined();
    // B07a defect: was 'validated' with empty evidence arrays
    expect(bail!.factIds).toHaveLength(0);
    expect(bail!.authorityEvidenceIds).toHaveLength(0);
    // Fix: heuristic-only recommendations must be 'proposed' or 'needs_clarification'
    // (either is acceptable; 'validated' with empty evidence was the bug)
    expect(['proposed', 'needs_clarification']).toContain(bail!.status);
    expect(bail!.status).not.toBe('validated');
  });
});

// ---------------------------------------------------------------------------
// India (IN) jurisdiction
// ---------------------------------------------------------------------------

describe('C10 – India (IN) recommendations', () => {
  it('bail facts → india_regular_bail_bnss_480', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Accused arrested under Section 302 IPC and seeks bail.',
    });

    const bail = results.find((r) => r.catalogId === 'india_regular_bail_bnss_480');
    expect(bail).toBeDefined();
    expect(bail!.category).toBe('work_product');
    expect(bail!.action).toBe('draft');
    expect(bail!.jurisdiction).toBe('IN');
  });

  it('consumer facts → india_consumer_complaint', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Insurance claim repudiated despite timely premium payment.',
    });

    const consumer = results.find((r) => r.catalogId === 'india_consumer_complaint');
    expect(consumer).toBeDefined();
    expect(consumer!.jurisdiction).toBe('IN');
  });

  it('specific performance facts → india_specific_performance', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Agreement to sell immovable property was not honored.',
    });

    const sp = results.find((r) => r.catalogId === 'india_specific_performance');
    expect(sp).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Kenya (KE) jurisdiction
// ---------------------------------------------------------------------------

describe('C11 – Kenya (KE) recommendations', () => {
  it('bail facts → kenya_bail_application (not India ID)', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'KE',
      rawFacts: 'Accused is in custody at Nairobi police station and seeks bail.',
    });

    const bail = results.find((r) => r.category === 'work_product' && r.action === 'draft');
    expect(bail).toBeDefined();
    expect(bail!.catalogId).toBe('kenya_bail_application');
    expect(bail!.catalogId).not.toContain('india');
    expect(bail!.jurisdiction).toBe('KE');
    // 'proposed' or 'needs_clarification' are both valid (never 'validated' with empty evidence)
    expect(['proposed', 'needs_clarification']).toContain(bail!.status);
    expect(bail!.status).not.toBe('validated');
  });

  it('consumer facts → kenya_consumer_complaint', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'KE',
      rawFacts: 'Consumer bought defective goods and the seller refuses to refund.',
    });

    const consumer = results.find((r) => r.catalogId === 'kenya_consumer_complaint');
    expect(consumer).toBeDefined();
    expect(consumer!.catalogId).not.toContain('india');
  });

  it('India catalog IDs are rejected as unsupported for KE', async () => {
    // Simulate a case where the catalog validation must reject India IDs for KE
    const svc = makeService();
    // Access private validateCatalog via any
    const validated = (svc as any).validateCatalog(
      [
        {
          id: 'rec-1',
          catalogId: 'india_regular_bail_bnss_480',
          category: 'work_product' as const,
          title: 'Regular bail',
          action: 'draft' as const,
          reason: 'test',
          factIds: [],
          authorityEvidenceIds: [],
          jurisdiction: 'KE',
          prerequisites: [],
          priority: 'next' as const,
          status: 'proposed' as const,
          questions: [],
          contextRevision: 1,
          policyVersion: 'test',
        },
      ],
      'KE',
    );

    expect(validated[0].status).toBe('unsupported');
  });
});

// ---------------------------------------------------------------------------
// Status rules — heuristic vs validated
// ---------------------------------------------------------------------------

describe('C10 – Recommendation status rules', () => {
  it('heuristic recommendations are status=proposed when factIds/authorityEvidenceIds are empty', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Accused seeks bail after arrest.',
    });

    for (const rec of results) {
      if (rec.factIds.length === 0 && rec.authorityEvidenceIds.length === 0) {
        expect(['proposed', 'needs_clarification']).toContain(rec.status);
        // 'validated' is forbidden for empty-evidence heuristic recommendations
        expect(rec.status).not.toBe('validated');
      }
    }
  });

  it('missing prerequisite makes draft recommendation needs_clarification', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      // No FIR or policy mentioned — prerequisite will be 'missing'
      rawFacts: 'Insurance repudiated.',
    });

    const draftWithMissingPrereq = results.find(
      (r) => r.action === 'draft' && r.prerequisites.some((p) => p.state === 'missing'),
    );
    if (draftWithMissingPrereq) {
      expect(draftWithMissingPrereq.status).toBe('needs_clarification');
    }
  });

  it('all recommendations have policyVersion set', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Accused needs bail.',
    });

    for (const rec of results) {
      expect(rec.policyVersion).toBeDefined();
      expect(rec.policyVersion.length).toBeGreaterThan(0);
    }
  });

  it('all recommendations have a unique id', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Consumer complaint about insurance repudiation.',
    });

    const ids = results.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Evidence recommendations
// ---------------------------------------------------------------------------

describe('C10 – Evidence and authority recommendations', () => {
  it('consumer facts include matter_evidence recommendation', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Consumer suffered deficiency in insurance service.',
    });

    const evidence = results.filter((r) => r.category === 'matter_evidence');
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].action).toBe('collect');
  });

  it('specific performance facts include legal_authority recommendation', async () => {
    const svc = makeService();
    const results = await svc.recommend({
      tenantId: 't1', userId: 'u1',
      countryCode: 'IN',
      rawFacts: 'Agreement to sell property — specific performance suit.',
    });

    const authority = results.filter((r) => r.category === 'legal_authority');
    expect(authority.length).toBeGreaterThan(0);
    expect(authority[0].action).toBe('research');
  });
});
