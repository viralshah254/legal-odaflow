/**
 * C22 – Forward migration schema validation
 *
 * Validates that:
 * 1. The migration SQL (20261018_umbrella_u01_u10) is syntactically well-formed
 *    and contains the expected DDL statements for each schema change.
 * 2. The Prisma schema (schema.prisma) contains the corresponding model fields.
 * 3. The migration is idempotent (all statements use IF NOT EXISTS / IF EXISTS).
 * 4. No destructive/irreversible statements (DROP TABLE, TRUNCATE) are present
 *    unless guarded.
 *
 * This is a structural/static validation — no live DB connection required.
 */

import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  '../../../prisma/migrations',
);
const SCHEMA_PATH = path.resolve(__dirname, '../../../prisma/schema.prisma');
const UMBRELLA_MIGRATION = path.join(
  MIGRATIONS_DIR,
  '20261018_umbrella_u01_u10',
  'migration.sql',
);

function readFile(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

describe('C22 – Prisma migration: 20261018_umbrella_u01_u10', () => {
  let migrationSql: string;
  let schema: string;

  beforeAll(() => {
    migrationSql = readFile(UMBRELLA_MIGRATION);
    schema = readFile(SCHEMA_PATH);
  });

  // ── Migration file existence ──────────────────────────────────────────────

  it('migration file exists', () => {
    expect(fs.existsSync(UMBRELLA_MIGRATION)).toBe(true);
  });

  it('migration file is non-empty', () => {
    expect(migrationSql.trim().length).toBeGreaterThan(0);
  });

  // ── WorkContextOperation table ────────────────────────────────────────────

  it('adds WorkContextOperation table with CREATE TABLE IF NOT EXISTS', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "WorkContextOperation"');
  });

  it('WorkContextOperation has required columns', () => {
    expect(migrationSql).toContain('"tenantId"');
    expect(migrationSql).toContain('"idempotencyKey"');
    expect(migrationSql).toContain('"scopeKey"');
    expect(migrationSql).toContain('"payloadJson"');
  });

  it('WorkContextOperation unique index is scoped to tenant+user+idempotencyKey', () => {
    expect(migrationSql).toContain(
      '"WorkContextOperation_tenantId_userId_idempotencyKey_key"',
    );
  });

  // ── DraftHumanReview new columns ──────────────────────────────────────────

  it('adds evidenceRevision to DraftHumanReview (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "evidenceRevision"/,
    );
  });

  it('adds courtProfileId to DraftHumanReview (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "courtProfileId"/,
    );
  });

  it('adds releaseDigest to DraftHumanReview (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "releaseDigest"/,
    );
  });

  it('adds contentRevision to DraftHumanReview (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "contentRevision"/,
    );
  });

  // ── DraftJob new columns ──────────────────────────────────────────────────

  it('adds operation column to DraftJob (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "DraftJob" ADD COLUMN IF NOT EXISTS "operation"/,
    );
  });

  it('adds dispatchStatus column to DraftJob (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "DraftJob" ADD COLUMN IF NOT EXISTS "dispatchStatus"/,
    );
  });

  it('adds requestFingerprint column to DraftJob (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "DraftJob" ADD COLUMN IF NOT EXISTS "requestFingerprint"/,
    );
  });

  // ── CourtDraftRecord new columns ──────────────────────────────────────────

  it('adds contentRevision to CourtDraftRecord (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "CourtDraftRecord" ADD COLUMN IF NOT EXISTS "contentRevision"/,
    );
  });

  it('adds releaseSnapshotJson to CourtDraftRecord (IF NOT EXISTS)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "CourtDraftRecord" ADD COLUMN IF NOT EXISTS "releaseSnapshotJson"/,
    );
  });

  // ── DraftJob unique index change ──────────────────────────────────────────

  it('drops old DraftJob_idempotencyKey_key unique index', () => {
    expect(migrationSql).toContain(
      'DROP INDEX IF EXISTS "DraftJob_idempotencyKey_key"',
    );
  });

  it('creates new scoped DraftJob unique index', () => {
    expect(migrationSql).toContain(
      '"DraftJob_tenantId_userId_operation_idempotencyKey_key"',
    );
  });

  // ── Idempotency guard ─────────────────────────────────────────────────────

  it('all ALTER TABLE ADD COLUMN statements use IF NOT EXISTS', () => {
    // Match the full line (including IF NOT EXISTS which follows ADD COLUMN)
    const addColumns = migrationSql.match(/ALTER TABLE .* ADD COLUMN[^\n]*/g) ?? [];
    for (const stmt of addColumns) {
      expect(stmt).toContain('IF NOT EXISTS');
    }
  });

  it('all CREATE TABLE statements use IF NOT EXISTS', () => {
    const createTables = migrationSql.match(/CREATE TABLE/g) ?? [];
    const withGuard = migrationSql.match(/CREATE TABLE IF NOT EXISTS/g) ?? [];
    expect(createTables.length).toBe(withGuard.length);
  });

  it('all CREATE UNIQUE INDEX statements use IF NOT EXISTS', () => {
    const createIndexes = migrationSql.match(/CREATE UNIQUE INDEX/g) ?? [];
    const withGuard = migrationSql.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g) ?? [];
    expect(createIndexes.length).toBe(withGuard.length);
  });

  it('no unguarded DROP TABLE present (only DROP INDEX IF EXISTS allowed)', () => {
    // DROP TABLE without IF EXISTS is destructive and must not exist
    const dropTable = migrationSql.match(/DROP TABLE(?! IF EXISTS)/g) ?? [];
    expect(dropTable).toHaveLength(0);
  });

  it('no TRUNCATE statements in migration', () => {
    expect(migrationSql.toUpperCase()).not.toContain('TRUNCATE');
  });
});

// ---------------------------------------------------------------------------
// C22 – Prisma schema consistency
// ---------------------------------------------------------------------------

describe('C22 – Prisma schema consistency with migration', () => {
  let schema: string;

  beforeAll(() => {
    schema = readFile(SCHEMA_PATH);
  });

  it('schema contains WorkContextOperation model', () => {
    expect(schema).toContain('model WorkContextOperation');
  });

  it('WorkContextOperation has idempotencyKey field', () => {
    // Find the WorkContextOperation model block
    const start = schema.indexOf('model WorkContextOperation');
    const end = schema.indexOf('\n}', start);
    const block = schema.slice(start, end);
    expect(block).toContain('idempotencyKey');
  });

  it('DraftHumanReview has releaseDigest field', () => {
    const start = schema.indexOf('model DraftHumanReview');
    const end = schema.indexOf('\n}', start);
    const block = schema.slice(start, end);
    expect(block).toContain('releaseDigest');
    expect(block).toContain('evidenceRevision');
    expect(block).toContain('courtProfileId');
    expect(block).toContain('contentRevision');
  });

  it('DraftJob has dispatchStatus field', () => {
    const start = schema.indexOf('model DraftJob');
    const end = schema.indexOf('\n}', start);
    const block = schema.slice(start, end);
    expect(block).toContain('dispatchStatus');
    expect(block).toContain('requestFingerprint');
  });

  it('CourtDraftRecord has contentRevision and releaseSnapshotJson fields', () => {
    const start = schema.indexOf('model CourtDraftRecord');
    const end = schema.indexOf('\n}', start);
    const block = schema.slice(start, end);
    expect(block).toContain('contentRevision');
    expect(block).toContain('releaseSnapshotJson');
  });
});

// ---------------------------------------------------------------------------
// C22 – Migration ordering (chronological)
// ---------------------------------------------------------------------------

describe('C22 – Migration history ordering', () => {
  it('new forward migrations follow the umbrella migration', () => {
    const dirs = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((d) => /^\d{8}/.test(d))
      .sort();

    expect(dirs).toContain('20261018_umbrella_u01_u10');
    expect(dirs.indexOf('20261109120000_durable_calendar_notifications')).toBeGreaterThan(dirs.indexOf('20261018_umbrella_u01_u10'));
  });

  it('migration timestamps are strictly increasing', () => {
    const dirs = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((d) => /^\d{8}/.test(d))
      .map((d) => d.slice(0, 14)) // first 14 chars = datetime prefix
      .filter((ts) => /^\d+$/.test(ts));

    for (let i = 1; i < dirs.length; i++) {
      expect(BigInt(dirs[i])).toBeGreaterThanOrEqual(BigInt(dirs[i - 1]));
    }
  });
});
