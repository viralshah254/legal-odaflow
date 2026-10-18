#!/usr/bin/env node
/**
 * Generates GITHUB_WEBHOOK_SECRET and DEV_WEBHOOK_SECRET in deployment/.env
 * (gitignored). Does not overwrite existing non-placeholder values.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEPLOYMENT_DIR = path.join(__dirname, '..', 'deployment');
const ENV_PATH = path.join(DEPLOYMENT_DIR, '.env');
const EXAMPLE_PATH = path.join(DEPLOYMENT_DIR, '.env.example');

const PLACEHOLDERS = new Set([
  '',
  'your-webhook-secret',
  'your-dev-webhook-secret',
  'your-secret-key',
]);

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function parseEnv(content) {
  const vars = new Map();
  for (const line of content.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    vars.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return vars;
}

function serializeEnv(vars, templateLines) {
  const seen = new Set();
  const lines = [];

  for (const line of templateLines) {
    if (!line || line.startsWith('#')) {
      lines.push(line);
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) {
      lines.push(line);
      continue;
    }
    const key = line.slice(0, idx).trim();
    seen.add(key);
    lines.push(`${key}=${vars.get(key) ?? ''}`);
  }

  for (const [key, value] of vars) {
    if (!seen.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  return lines.join('\n').replace(/\n?$/, '\n');
}

function needsSecret(value) {
  return PLACEHOLDERS.has(value ?? '');
}

function main() {
  const template = fs.existsSync(EXAMPLE_PATH)
    ? fs.readFileSync(EXAMPLE_PATH, 'utf8').split('\n')
    : ['GITHUB_WEBHOOK_SECRET=', 'DEV_WEBHOOK_SECRET='];

  const existing = fs.existsSync(ENV_PATH)
    ? parseEnv(fs.readFileSync(ENV_PATH, 'utf8'))
    : new Map();

  const generated = {};

  if (needsSecret(existing.get('GITHUB_WEBHOOK_SECRET'))) {
    generated.GITHUB_WEBHOOK_SECRET = generateSecret();
    existing.set('GITHUB_WEBHOOK_SECRET', generated.GITHUB_WEBHOOK_SECRET);
  }

  if (needsSecret(existing.get('DEV_WEBHOOK_SECRET'))) {
    generated.DEV_WEBHOOK_SECRET = generateSecret();
    existing.set('DEV_WEBHOOK_SECRET', generated.DEV_WEBHOOK_SECRET);
  }

  if (Object.keys(generated).length === 0) {
    console.log('deployment/.env already has webhook secrets — nothing generated.');
    console.log(`File: ${ENV_PATH}`);
    return;
  }

  fs.writeFileSync(ENV_PATH, serializeEnv(existing, template), 'utf8');
  console.log(`Wrote ${ENV_PATH}`);
  for (const key of Object.keys(generated)) {
    console.log(`  ${key}=<generated — see file>`);
  }
  console.log('');
  console.log('Next: follow deployment/WEBHOOK_SECRET_MANUAL_STEPS.md');
}

main();
