const { migrationDatabaseUrl, runProductionMigrations } = require('../../deployment/migrate-production.cjs');

describe('Production migration connection', () => {
  const pooled = 'postgresql://test-user:fake-password@ep-example-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

  it('uses an unpooled Neon endpoint only for the migration child process', () => {
    const env = { DATABASE_URL: pooled };
    const run = jest.fn().mockReturnValue({ status: 0 });
    expect(runProductionMigrations(env, run)).toBe(0);
    expect(new URL(run.mock.calls[0][2].env.DATABASE_URL).hostname).toBe('ep-example.us-east-1.aws.neon.tech');
    expect(env.DATABASE_URL).toBe(pooled);
    expect(run.mock.calls[0][1].slice(-2)).toEqual(['migrate', 'deploy']);
    expect(JSON.stringify(run.mock.calls[0][1])).not.toContain('fake-password');
  });

  it('accepts a separate migration credential for the same Neon database', () => {
    const direct = 'postgresql://migration-role:fake-password@ep-example.us-east-1.aws.neon.tech/neondb';
    expect(migrationDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: direct })).toBe(direct);
  });

  it('rejects explicit pooled or different-branch migration targets', () => {
    expect(() => migrationDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: pooled })).toThrow('unpooled');
    expect(() => migrationDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: pooled.replace('ep-example-pooler', 'ep-other') })).toThrow('same Neon database');
    expect(() => migrationDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: 'postgresql://test:fake-password@other.example/neondb' })).toThrow('same Neon database');
  });

  it('leaves an explicitly configured non-Neon connection unchanged', () => {
    const local = 'postgresql://test-user:fake-password@127.0.0.1:5438/test_db';
    expect(migrationDatabaseUrl({ DATABASE_URL: local })).toBe(local);
  });

  it('fails closed for missing configuration and preserves migration failures', () => {
    const run = jest.fn().mockReturnValue({ status: 17 });
    expect(() => runProductionMigrations({}, run)).toThrow('valid migration');
    expect(run).not.toHaveBeenCalled();
    expect(runProductionMigrations({ DATABASE_URL: pooled }, run)).toBe(17);
    run.mockReturnValue({ status: null });
    expect(runProductionMigrations({ DATABASE_URL: pooled }, run)).toBe(1);
  });
});
