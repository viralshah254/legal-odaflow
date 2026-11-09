import { researchCacheIdentity, type ResearchCacheIdentity } from './research-cache-identity';
/**
 * C02 – Research cache context identity integration spec
 *
 * Verifies that the early research cache key correctly encodes the full
 * authorization context (tenant, matter, country, query, document IDs,
 * research IDs) so that requests with different selections never share
 * the same cache slot.
 *
 * These tests run without Redis — they exercise the pure key-construction
 * logic extracted from ai-gateway.service.ts.
 */

// ---------------------------------------------------------------------------
// Exercises the same cache identity function used by ai-gateway.service.ts.
// ---------------------------------------------------------------------------
function buildResearchCacheKey(input: Partial<ResearchCacheIdentity> & { countryCode: string; query: string }): string {
  return researchCacheIdentity({ userId: 'actor-1', ...input }, 'test-pipeline-v2');
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('Research cache context identity (C02)', () => {
  const baseInput = {
    tenantId: 'tenant-abc',
    matterId: 'matter-xyz',
    countryCode: 'IN',
    query: 'liability under section 304A IPC',
  };

  // ── Tenant isolation ──────────────────────────────────────────────────────

  it('different tenants produce different keys', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, tenantId: 'tenant-1' });
    const k2 = buildResearchCacheKey({ ...baseInput, tenantId: 'tenant-2' });
    expect(k1).not.toBe(k2);
  });

  it('missing tenant falls back to "none" and does not collide with real tenant', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, tenantId: undefined });
    const k2 = buildResearchCacheKey({ ...baseInput, tenantId: 'tenant-1' });
    expect(k1).not.toBe(k2);
  });

  // ── Matter isolation ──────────────────────────────────────────────────────

  it('different matters produce different keys', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, matterId: 'matter-A' });
    const k2 = buildResearchCacheKey({ ...baseInput, matterId: 'matter-B' });
    expect(k1).not.toBe(k2);
  });

  it('unassigned (no matter) does not collide with matter-scoped request', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, matterId: undefined });
    const k2 = buildResearchCacheKey({ ...baseInput, matterId: 'matter-A' });
    expect(k1).not.toBe(k2);
  });

  // ── Document selection identity ───────────────────────────────────────────

  it('different selectedDocumentIds produce different keys (B01 fix)', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, selectedDocumentIds: ['doc-alpha'] });
    const k2 = buildResearchCacheKey({ ...baseInput, selectedDocumentIds: ['doc-beta'] });
    expect(k1).not.toBe(k2);
  });

  it('document selection is order-stable (sort normalization)', () => {
    const k1 = buildResearchCacheKey({
      ...baseInput,
      selectedDocumentIds: ['doc-1', 'doc-2', 'doc-3'],
    });
    const k2 = buildResearchCacheKey({
      ...baseInput,
      selectedDocumentIds: ['doc-3', 'doc-1', 'doc-2'],
    });
    expect(k1).toBe(k2);
  });

  it('no documents vs one document produce different keys', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, selectedDocumentIds: [] });
    const k2 = buildResearchCacheKey({ ...baseInput, selectedDocumentIds: ['doc-1'] });
    expect(k1).not.toBe(k2);
  });

  it('two documents vs same count different IDs produce different keys', () => {
    const k1 = buildResearchCacheKey({
      ...baseInput,
      selectedDocumentIds: ['doc-a', 'doc-b'],
    });
    const k2 = buildResearchCacheKey({
      ...baseInput,
      selectedDocumentIds: ['doc-c', 'doc-d'],
    });
    expect(k1).not.toBe(k2);
  });

  // ── Research selection identity ───────────────────────────────────────────

  it('different selectedSavedResearchIds produce different keys', () => {
    const k1 = buildResearchCacheKey({
      ...baseInput,
      selectedSavedResearchIds: ['res-alpha'],
    });
    const k2 = buildResearchCacheKey({
      ...baseInput,
      selectedSavedResearchIds: ['res-beta'],
    });
    expect(k1).not.toBe(k2);
  });

  it('research selection is order-stable', () => {
    const k1 = buildResearchCacheKey({
      ...baseInput,
      selectedSavedResearchIds: ['res-1', 'res-2'],
    });
    const k2 = buildResearchCacheKey({
      ...baseInput,
      selectedSavedResearchIds: ['res-2', 'res-1'],
    });
    expect(k1).toBe(k2);
  });

  // ── Country / query / date isolation ─────────────────────────────────────

  it('different countryCode produces different key', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, countryCode: 'IN' });
    const k2 = buildResearchCacheKey({ ...baseInput, countryCode: 'KE' });
    expect(k1).not.toBe(k2);
  });

  it('country code is case-insensitive', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, countryCode: 'in' });
    const k2 = buildResearchCacheKey({ ...baseInput, countryCode: 'IN' });
    expect(k1).toBe(k2);
  });

  it('different queries produce different keys', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, query: 'question A' });
    const k2 = buildResearchCacheKey({ ...baseInput, query: 'question B' });
    expect(k1).not.toBe(k2);
  });

  it('preserves case-sensitive quoted identifiers', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, query: 'Liability under IPC' });
    const k2 = buildResearchCacheKey({ ...baseInput, query: 'liability under ipc' });
    expect(k1).not.toBe(k2);
  });

  it('different asOfDate produces different key', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, asOfDate: '2025-01-01' });
    const k2 = buildResearchCacheKey({ ...baseInput, asOfDate: '2026-01-01' });
    expect(k1).not.toBe(k2);
  });

  // ── Composite cross-actor collision guard ─────────────────────────────────

  it('two actors in same tenant with same query but different matters get different keys', () => {
    const k1 = buildResearchCacheKey({ ...baseInput, matterId: 'matter-1' });
    const k2 = buildResearchCacheKey({ ...baseInput, matterId: 'matter-2' });
    expect(k1).not.toBe(k2);
  });

  it('same actor + same query + different contexts never collide', () => {
    const scenarios = [
      { selectedDocumentIds: ['d1'] },
      { selectedDocumentIds: ['d2'] },
      { selectedSavedResearchIds: ['r1'] },
      { selectedSavedResearchIds: ['r2'] },
      { matterId: 'matter-A' },
      { matterId: 'matter-B' },
    ];
    const keys = scenarios.map((overrides) =>
      buildResearchCacheKey({ ...baseInput, ...overrides }),
    );
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

describe('Research cache privacy and freshness', () => {
  const request = { userId: 'alice', tenantId: 'firm', countryCode: 'KE', query: 'What is the remedy?' };
  it.each([
    ['actor', { userId: 'bob' }],
    ['role', { tenantRole: 'FINANCE' }],
    ['evidence revision', { authorizedMatterContext: 'order v2' }],
    ['conversation', { priorContext: 'The client is the respondent' }],
    ['depth', { researchMode: 'DEEP' }],
    ['language', { outputLanguage: 'sw' }],
    ['forum', { jurisdiction: 'High Court' }],
    ['source restrictions', { knowledgeSources: ['statutes'] }],
  ])('isolates changed %s', (_name, changes) => {
    expect(researchCacheIdentity(request, 'v2')).not.toBe(researchCacheIdentity({ ...request, ...changes }, 'v2'));
  });
  it('invalidates on verifier/prompt version and keeps sensitive text out of keys', () => {
    const key = researchCacheIdentity(request, 'v2');
    expect(key).not.toBe(researchCacheIdentity(request, 'v3'));
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});
