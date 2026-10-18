#!/usr/bin/env node
/**
 * Generates JWT_SECRET, REFRESH_TOKEN_SECRET, and SESSION_COOKIE_SECRET in legal_backend/.env
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

const PLACEHOLDERS = new Set([
  '',
  'change_me_dev_secret',
  'change_me_jwt_secret',
  'change_me_refresh_secret',
  'dev_jwt_secret_change_in_production',
  'dev_refresh_secret_change_in_production',
  'change_me_session_secret',
  'dev_session_secret',
]);

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function upsertEnvKey(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const jwtBlock = content.match(/^JWT_SECRET=.*$/m);
  if (jwtBlock && key === 'REFRESH_TOKEN_SECRET') {
    return content.replace(/^JWT_SECRET=.*$/m, (match) => `${match}\n${line}`);
  }
  return `${content.replace(/\n?$/, '\n')}${line}\n`;
}

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`Missing ${ENV_PATH}`);
    process.exit(1);
  }

  let content = fs.readFileSync(ENV_PATH, 'utf8');
  const generated = {};

  const currentJwt = content.match(/^JWT_SECRET=(.*)$/m)?.[1] ?? '';
  const currentRefresh = content.match(/^REFRESH_TOKEN_SECRET=(.*)$/m)?.[1] ?? '';
  const currentSession = content.match(/^SESSION_COOKIE_SECRET=(.*)$/m)?.[1] ?? '';

  if (PLACEHOLDERS.has(currentJwt)) {
    generated.JWT_SECRET = generateSecret();
    content = upsertEnvKey(content, 'JWT_SECRET', generated.JWT_SECRET);
  }

  if (PLACEHOLDERS.has(currentRefresh)) {
    generated.REFRESH_TOKEN_SECRET = generateSecret();
    content = upsertEnvKey(content, 'REFRESH_TOKEN_SECRET', generated.REFRESH_TOKEN_SECRET);
  }

  if (PLACEHOLDERS.has(currentSession)) {
    generated.SESSION_COOKIE_SECRET = generateSecret();
    content = upsertEnvKey(content, 'SESSION_COOKIE_SECRET', generated.SESSION_COOKIE_SECRET);
  }

  if (Object.keys(generated).length === 0) {
    console.log('.env already has non-placeholder auth secrets — not overwriting.');
    process.exit(0);
  }

  fs.writeFileSync(ENV_PATH, content, 'utf8');
  console.log(JSON.stringify(generated, null, 2));
}

main();
