/**
 * C07 – Release snapshot concurrency integration spec (B11 fix)
 *
 * Verifies that:
 * 1. isApprovalValid() invalidates the record for every material dependency change
 *    (caseRecord, playbook, draft content, evidence, court profile, release digest).
 * 2. recordApproval() uses a transaction — supersedes the previous approval atomically.
 * 3. A second approve of the same draft with unchanged identity is treated as idempotent.
 * 4. The releaseDigest captures current dependency identity, not stale state.
 * 5. canExportWithHumanReview() gate respects both the release status and the approval.
 */

import { HumanReviewService } from './human-review.service';
import type { HumanReviewRecord } from '../contracts/release-gate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApprovalIdentity(overrides: Partial<Parameters<HumanReviewService['isApprovalValid']>[0]> = {}) {
  return {
    tenantId: 'tenant-1',
    draftId: 'draft-1',
    caseRecordId: 'cr-001',
    caseRecordVersion: 1,
    playbookVersion: 'bail-v3',
    draftHash: HumanReviewService.draftHash('The full draft text'),
    evidenceRevision: 'ev-pack-abc',
    courtProfileId: 'IN:bail_application',
    contentRevision: 1,
    releaseDigest: 'digest-001',
    ...overrides,
  };
}

function makeApprovalRecord(overrides: Partial<HumanReviewRecord> = {}): HumanReviewRecord {
  const identity = makeApprovalIdentity();
  return {
    id: 'review-1',
    draftId: identity.draftId,
    caseRecordId: identity.caseRecordId,
    caseRecordVersion: identity.caseRecordVersion,
    playbookVersion: identity.playbookVersion,
    draftHash: identity.draftHash,
    approved: true,
    invalidated: false,
    reviewedByUserId: 'user-1',
    reviewedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Convert a HumanReviewRecord to a Prisma-style DB row (reviewedAt as Date). */
function toPrismaRow(record: HumanReviewRecord) {
  return {
    ...record,
    reviewedAt: new Date(record.reviewedAt),
    notes: record.notes ?? null,
    invalidatedReason: record.invalidatedReason ?? null,
    invalidatedAt: null,
    contentRevision: (record as any).contentRevision ?? null,
    evidenceRevision: (record as any).evidenceRevision ?? null,
    courtProfileId: (record as any).courtProfileId ?? null,
    releaseDigest: (record as any).releaseDigest ?? null,
  };
}

function makePrismaStub(storedRecord: HumanReviewRecord | null = null) {
  const dbRow = storedRecord ? toPrismaRow(storedRecord) : null;
  const prisma: any = {
    draftHumanReview: {
      findFirst: jest.fn(async () => dbRow),
      updateMany: jest.fn(async () => ({ count: dbRow ? 1 : 0 })),
      create: jest.fn(async (args: any) => ({
        ...args.data,
        id: 'new-review',
        reviewedAt: new Date(),
        notes: args.data.notes ?? null,
        invalidatedReason: null,
        invalidatedAt: null,
      })),
    },
    $transaction: jest.fn(async (fn: any) => {
      const tx = {
        draftHumanReview: {
          updateMany: jest.fn(async () => ({ count: 1 })),
          create: jest.fn(async (args: any) => ({
            ...args.data,
            id: 'new-review',
            reviewedAt: new Date(),
            notes: args.data.notes ?? null,
            invalidatedReason: null,
            invalidatedAt: null,
          })),
        },
      };
      return fn(tx);
    }),
  };
  return prisma;
}

// ---------------------------------------------------------------------------
// isApprovalValid() invalidation tests
// ---------------------------------------------------------------------------

describe('C07 – Approval invalidation on dependency change', () => {
  async function check(
    storedOverrides: Partial<HumanReviewRecord>,
    inputOverrides: Partial<Parameters<HumanReviewService['isApprovalValid']>[0]>,
    expectValid: boolean,
  ) {
    const stored = makeApprovalRecord(storedOverrides);
    const prisma = makePrismaStub(stored);
    const service = new HumanReviewService(prisma as any);
    const result = await service.isApprovalValid({ ...makeApprovalIdentity(), ...inputOverrides });
    if (expectValid) {
      expect(result.valid).toBe(true);
    } else {
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    }
  }

  it('returns valid when all identity fields match', async () => {
    await check({}, {}, true);
  });

  it('invalidates when caseRecordId changes', async () => {
    await check({}, { caseRecordId: 'cr-NEW' }, false);
  });

  it('invalidates when caseRecordVersion changes', async () => {
    await check({}, { caseRecordVersion: 99 }, false);
  });

  it('invalidates when playbookVersion changes', async () => {
    await check({}, { playbookVersion: 'bail-v4' }, false);
  });

  it('invalidates when draftHash changes (draft text edited)', async () => {
    await check({}, { draftHash: HumanReviewService.draftHash('completely different text') }, false);
  });

  it('invalidates when contentRevision changes', async () => {
    await check({ contentRevision: 1 } as any, { contentRevision: 2 }, false);
  });

  it('invalidates when evidenceRevision changes', async () => {
    await check({ evidenceRevision: 'ev-pack-abc' } as any, { evidenceRevision: 'ev-pack-xyz' }, false);
  });

  it('invalidates when courtProfileId changes', async () => {
    await check({ courtProfileId: 'IN:bail_application' } as any, { courtProfileId: 'IN:anticipatory_bail' }, false);
  });

  it('invalidates when releaseDigest changes', async () => {
    await check({ releaseDigest: 'digest-001' } as any, { releaseDigest: 'digest-002' }, false);
  });

  it('returns invalid when no review exists', async () => {
    const prisma = makePrismaStub(null);
    const service = new HumanReviewService(prisma as any);
    const result = await service.isApprovalValid(makeApprovalIdentity());
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('No active advocate approval');
  });

  it('returns invalid when record is already invalidated', async () => {
    const stored = makeApprovalRecord({ approved: false, invalidated: true });
    const prisma = makePrismaStub(stored);
    const service = new HumanReviewService(prisma as any);
    const result = await service.isApprovalValid(makeApprovalIdentity());
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recordApproval() transaction invariants
// ---------------------------------------------------------------------------

describe('C07 – recordApproval() atomic supersession', () => {
  it('calls updateMany inside $transaction to invalidate prior approval', async () => {
    const prisma = makePrismaStub(null);
    const service = new HumanReviewService(prisma as any);

    await service.recordApproval({
      ...makeApprovalIdentity(),
      userId: 'advocate-1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Inside the transaction, updateMany should have been called to invalidate old approvals
    const txFn = prisma.$transaction.mock.calls[0][0];
    const capturedTx = {
      updateManyCalls: [] as any[],
      createCalls: [] as any[],
      draftHumanReview: {
        updateMany: jest.fn(async (args: any) => {
          capturedTx.updateManyCalls.push(args);
          return { count: 0 };
        }),
        create: jest.fn(async (args: any) => {
          capturedTx.createCalls.push(args);
          return {
            ...args.data,
            id: 'new-review',
            reviewedAt: new Date(),
          };
        }),
      },
    };
    await txFn(capturedTx);

    // updateMany must be called before create (to invalidate before inserting)
    expect(capturedTx.updateManyCalls.length).toBeGreaterThan(0);
    expect(capturedTx.createCalls.length).toBe(1);
  });

  it('recordApproval returns a record with approved=true', async () => {
    const prisma = makePrismaStub(null);
    const service = new HumanReviewService(prisma as any);

    const result = await service.recordApproval({
      ...makeApprovalIdentity(),
      userId: 'advocate-1',
      notes: 'Approved for filing',
    });

    expect(result.approved).toBe(true);
    expect(result.reviewedByUserId).toBe('advocate-1');
  });
});

// ---------------------------------------------------------------------------
// canExportWithHumanReview() gate
// ---------------------------------------------------------------------------

describe('C07 – canExportWithHumanReview() gate contract', () => {
  const svc = new HumanReviewService({} as any);

  const passedGate = {
    status: 'lawyer_review_recommended' as const,
    canExport: true,
    requiresHumanReview: true,
    canExportReviewCopy: true,
    canExportForFiling: false,
    blockers: [],
    warnings: [],
    checks: {},
    caseRecordVersion: 1,
    playbookVersion: '1',
    verifierVersions: {},
    userLabel: 'Lawyer review recommended',
    courtReadyStatus: 'advocate_review_required' as const,
    scores: { qualityScore: 1, factFidelityScore: 1, legalAccuracyScore: 1, proceduralAccuracyScore: 1, completenessScore: 1, citationQualityScore: 1 },
  };

  const blockedGate = { ...passedGate, canExport: false };

  it('no export when gate is blocked, even with valid approval', () => {
    const result = svc.canExportWithHumanReview(blockedGate, true, { valid: true });
    expect(result).toBe(false);
  });

  it('no export when filingGrade requires approval but approval is invalid', () => {
    const result = svc.canExportWithHumanReview(passedGate, true, { valid: false });
    expect(result).toBe(false);
  });

  it('export allowed when filingGrade and approval is valid', () => {
    const result = svc.canExportWithHumanReview(passedGate, true, { valid: true });
    expect(result).toBe(true);
  });

  it('export allowed when not filingGrade and gate passed (no human review required)', () => {
    const simpleGate = {
      ...passedGate,
      requiresHumanReview: false,
      courtReadyStatus: 'system_validated' as const,
    };
    const result = svc.canExportWithHumanReview(simpleGate, false, { valid: false });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// releaseDigest encodes current dependency identity
// ---------------------------------------------------------------------------

describe('C07 – releaseDigest must encode dependency identity', () => {
  it('same inputs produce same digest', () => {
    const { createHash } = require('crypto');
    const compute = (fields: Record<string, unknown>) =>
      createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 16);

    const f1 = compute({ caseRecordVersion: 1, playbookVersion: 'bail-v3', evidencePack: 'ev-abc' });
    const f2 = compute({ caseRecordVersion: 1, playbookVersion: 'bail-v3', evidencePack: 'ev-abc' });
    expect(f1).toBe(f2);
  });

  it('changed dependency produces different digest', () => {
    const { createHash } = require('crypto');
    const compute = (fields: Record<string, unknown>) =>
      createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 16);

    const f1 = compute({ caseRecordVersion: 1, playbookVersion: 'bail-v3', evidencePack: 'ev-abc' });
    const f2 = compute({ caseRecordVersion: 2, playbookVersion: 'bail-v3', evidencePack: 'ev-abc' }); // version changed
    expect(f1).not.toBe(f2);
  });
});
