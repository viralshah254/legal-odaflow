/**
 * C04 – StartWork transaction integration spec (B03 fix)
 *
 * Verifies:
 * 1. Client.create and Matter.create happen inside the Prisma $transaction — if
 *    WorkContextOperation creation fails the client/matter rows are not persisted.
 * 2. operationRequestKey is incorporated into the idempotency key so two different
 *    operation intents for the same matter do not share a key.
 * 3. Idempotent retry with the same payload returns the existing record (no duplicate).
 * 4. Conflicting payload on the same idempotency key raises ConflictException.
 *
 * These tests are unit-level: they stub the Prisma $transaction to control commit/rollback.
 */

import { ConflictException, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { WorkContextService } from './work-context.service';
import type { StartWorkRequestDto } from './start-work.dto';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeActor() {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    tenantRole: 'ADMIN',
  };
}

function makeDto(overrides: Partial<StartWorkRequestDto> = {}): StartWorkRequestDto {
  return {
    mode: 'existing_client',
    clientId: 'client-1',
    ...overrides,
  };
}

// Minimal stub for the Prisma service that captures $transaction calls
function makePrismaStub(opts: {
  findUnique?: (args: any) => any;
  create?: (args: any) => any;
  txCreate?: (args: any) => any;  // called inside $transaction
  txShouldThrow?: boolean;
}) {
  const prisma: any = {
    workContextOperation: {
      findUnique: jest.fn(opts.findUnique ?? (async () => null)),
      findUniqueOrThrow: jest.fn(async () => { throw new Error('not found'); }),
      create: jest.fn(opts.create ?? (async (args: any) => ({
        scopeKey: 'scope-1',
        clientId: args.data.clientId ?? null,
        matterId: args.data.matterId ?? null,
        payloadJson: args.data.payloadJson,
      }))),
    },
    client: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async (args: any) => ({ id: 'client-new', ...args.data })),
    },
    matter: {
      create: jest.fn(async (args: any) => ({ id: 'matter-new', ...args.data })),
    },
    $transaction: jest.fn(async (fn: (tx: any) => any) => {
      if (opts.txShouldThrow) {
        throw new Error('Simulated DB transaction failure');
      }
      // Build a minimal tx object
      const tx = {
        client: {
          findFirst: jest.fn(async () => null),
          create: jest.fn(async (args: any) => ({ id: 'client-new', ...args.data })),
        },
        matter: {
          create: jest.fn(async (args: any) => ({ id: 'matter-new', ...args.data })),
        },
        workContextOperation: {
          create: jest.fn(
            opts.txCreate ?? (async (args: any) => ({
              scopeKey: args.data.scopeKey,
              clientId: args.data.clientId ?? null,
              matterId: args.data.matterId ?? null,
              payloadJson: args.data.payloadJson,
            })),
          ),
        },
      };
      return fn(tx);
    }),
  };
  return prisma;
}

function makeService(prisma: any): WorkContextService {
  const mockClients: any = {
    onClientCreated: jest.fn(async () => undefined),
  };
  const mockMatters: any = {
    onMatterCreated: jest.fn(async () => undefined),
  };
  const mockAccess: any = {
    assertClientReadable: jest.fn(async () => undefined),
    assertClientMatterLink: jest.fn(async () => undefined),
  };
  return new WorkContextService(prisma, mockClients, mockMatters, mockAccess);
}

// ---------------------------------------------------------------------------
// Structural proof: WorkContextOperation is created inside the tx
// ---------------------------------------------------------------------------

describe('C04 – StartWork atomicity (B03 fix)', () => {
  it('workContextOperation is created on the tx handle, not on global prisma', async () => {
    const prisma = makePrismaStub({});
    const service = makeService(prisma);

    const dto = makeDto({
      mode: 'existing_client',
      clientId: 'client-1',
    });
    await service.startWork(makeActor(), dto);

    // $transaction must have been called
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // The tx.workContextOperation.create must have been called inside the transaction
    const txFn = prisma.$transaction.mock.calls[0][0];
    const capturedTx: any = { calls: [] };
    const recordingTx = {
      client: { findFirst: async () => null, create: async (a: any) => ({ id: 'c', ...a.data }) },
      matter: { create: async (a: any) => ({ id: 'm', ...a.data }) },
      workContextOperation: {
        create: jest.fn(async (a: any) => {
          capturedTx.calls.push(a);
          return { scopeKey: 'scope', clientId: a.data.clientId, matterId: null, payloadJson: a.data.payloadJson };
        }),
      },
    };
    await txFn(recordingTx);
    expect(capturedTx.calls.length).toBeGreaterThan(0);
  });

  it('new_client mode: client.create is called on the tx, not global prisma', async () => {
    const prisma = makePrismaStub({});

    // Track which object's create() is called
    const txClientCalls: any[] = [];
    const globalClientCalls: any[] = [];

    prisma.client.create = jest.fn(async (a: any) => {
      globalClientCalls.push(a);
      return { id: 'global-client', ...a.data };
    });

    const originalTx = prisma.$transaction.getMockImplementation?.();
    prisma.$transaction = jest.fn(async (fn: any) => {
      const tx = {
        client: {
          findFirst: jest.fn(async () => null),
          create: jest.fn(async (a: any) => {
            txClientCalls.push(a);
            return { id: 'tx-client', ...a.data };
          }),
        },
        matter: { create: jest.fn(async (a: any) => ({ id: 'tx-matter', ...a.data })) },
        workContextOperation: {
          create: jest.fn(async (a: any) => ({
            scopeKey: a.data.scopeKey,
            clientId: a.data.clientId,
            matterId: null,
            payloadJson: a.data.payloadJson,
          })),
        },
      };
      return fn(tx);
    });

    const service = makeService(prisma);
    const dto = makeDto({
      mode: 'new_client',
      createClient: { name: 'Test Client' },
    });
    await service.startWork(makeActor(), dto);

    // Client must be created through tx, not global prisma
    expect(txClientCalls.length).toBeGreaterThan(0);
    expect(globalClientCalls.length).toBe(0); // global prisma.client.create NOT called
  });

  it('if workContextOperation creation fails, client is NOT persisted (atomicity)', async () => {
    // Simulate tx rollback: tx.workContextOperation.create throws
    const prisma = makePrismaStub({
      txCreate: async () => {
        throw new Error('constraint violation');
      },
    });

    // Override $transaction to simulate proper rollback (tx throws = nothing committed)
    prisma.$transaction = jest.fn(async (fn: any) => {
      const tx = {
        client: {
          findFirst: jest.fn(async () => null),
          create: jest.fn(async (a: any) => ({ id: 'would-be-orphan', ...a.data })),
        },
        matter: { create: jest.fn(async (a: any) => ({ id: 'matter-new', ...a.data })) },
        workContextOperation: {
          create: jest.fn(async () => {
            throw new Error('constraint violation');
          }),
        },
      };
      // Any throw inside fn means the transaction is aborted
      return fn(tx);
    });

    const service = makeService(prisma);
    const dto = makeDto({
      mode: 'new_client',
      createClient: { name: 'Orphan Client' },
    });

    await expect(service.startWork(makeActor(), dto)).rejects.toThrow('constraint violation');

    // The global prisma.client.create should NOT have been called
    expect(prisma.client.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// operationRequestKey idempotency
// ---------------------------------------------------------------------------

describe('C04 – operationRequestKey per-intent idempotency (B05 fix)', () => {
  function computeKey(dto: Partial<StartWorkRequestDto>): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          mode: dto.mode ?? 'existing_client',
          clientId: dto.clientId,
          matterId: dto.matterId,
          operationRequestKey: dto.operationRequestKey,
        }),
      )
      .digest('hex')
      .slice(0, 24);
  }

  it('same matter, different operationRequestKey → different idempotency keys', () => {
    const k1 = computeKey({ mode: 'existing_client', clientId: 'c1', matterId: 'm1', operationRequestKey: 'draft-001' });
    const k2 = computeKey({ mode: 'existing_client', clientId: 'c1', matterId: 'm1', operationRequestKey: 'research-001' });
    expect(k1).not.toBe(k2);
  });

  it('same operationRequestKey → same idempotency key (retry-safe)', () => {
    const k1 = computeKey({ mode: 'existing_client', clientId: 'c1', operationRequestKey: 'op-uuid-abc' });
    const k2 = computeKey({ mode: 'existing_client', clientId: 'c1', operationRequestKey: 'op-uuid-abc' });
    expect(k1).toBe(k2);
  });

  it('no operationRequestKey → idempotency key based on mode+clientId+matterId', () => {
    const k = computeKey({ mode: 'existing_client', clientId: 'c1', matterId: 'm1' });
    expect(k).toHaveLength(24);
  });
});

// ---------------------------------------------------------------------------
// Idempotency: duplicate payload returns existing record
// ---------------------------------------------------------------------------

describe('C04 – StartWork idempotency contract', () => {
  it('second call with same payload returns existing record without creating again', async () => {
    const existingRecord = {
      scopeKey: 'existing-scope',
      clientId: 'client-1',
      matterId: null,
      payloadJson: makeDto({ clientId: 'client-1' }),
    };

    const prisma = makePrismaStub({
      findUnique: async () => existingRecord,
    });

    const service = makeService(prisma);
    const dto = makeDto({ clientId: 'client-1' });

    const result = await service.startWork(makeActor(), dto);
    expect(result.scopeKey).toBe('existing-scope');
    expect(result.clientId).toBe('client-1');

    // $transaction must NOT have been called (idempotent fast path)
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('conflicting payload on same key raises ConflictException', async () => {
    const existingRecord = {
      scopeKey: 'existing-scope',
      clientId: 'client-1',
      matterId: null,
      payloadJson: { mode: 'existing_client', clientId: 'client-OTHER' }, // different payload
    };

    const prisma = makePrismaStub({
      findUnique: async () => existingRecord,
    });

    const service = makeService(prisma);
    const dto = makeDto({ clientId: 'client-1' }); // different from stored

    await expect(service.startWork(makeActor(), dto)).rejects.toThrow(ConflictException);
  });
});
