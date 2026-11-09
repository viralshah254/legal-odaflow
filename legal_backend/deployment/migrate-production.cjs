'use strict';

const { spawnSync } = require('node:child_process');

function migrationDatabaseUrl(env) {
  const selected = env.MIGRATION_DATABASE_URL || env.DATABASE_URL_UNPOOLED || env.DIRECT_URL;
  let migration;
  let runtime;
  try {
    migration = new URL(selected || env.DATABASE_URL);
    runtime = env.DATABASE_URL ? new URL(env.DATABASE_URL) : null;
  } catch {
    throw new Error('A valid migration database connection is required.');
  }
  if (!['postgres:', 'postgresql:'].includes(migration.protocol)) {
    throw new Error('Migration tooling requires a PostgreSQL connection.');
  }
  if (migration.hostname.endsWith('.neon.tech')) {
    if (selected && migration.hostname.includes('-pooler.')) {
      throw new Error('The explicit migration connection must be unpooled.');
    }
    migration.hostname = migration.hostname.replace('-pooler.', '.');
  }
  if (runtime?.hostname.endsWith('.neon.tech') && (runtime.hostname.replace('-pooler.', '.') !== migration.hostname || runtime.pathname !== migration.pathname)) {
    throw new Error('Migration and application connections must target the same Neon database.');
  }
  return migration.toString();
}

function runProductionMigrations(env = process.env, run = spawnSync) {
  const databaseUrl = migrationDatabaseUrl(env);
  const result = run(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  if (result.error) throw new Error('Migration tooling could not start.');
  return Number.isInteger(result.status) ? result.status : 1;
}

module.exports = { migrationDatabaseUrl, runProductionMigrations };

if (require.main === module) {
  require('dotenv').config();
  try {
    // Keep connection values out of logs and process arguments. The app keeps its runtime URL.
    process.exitCode = runProductionMigrations();
  } catch (error) {
    console.error('[migration] ' + error.message);
    process.exitCode = 1;
  }
}
