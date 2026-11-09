/** Real API/DB smoke test with disposable synthetic records, no model calls.
 * Requires DATABASE_URL for an isolated local umbrella_execution database and
 * the local API on port 4000. Tokens and configuration are never printed. */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import assert from 'node:assert/strict';
import { resolveJwtSecret } from '../src/auth/auth-secrets.util';
import { EncryptionService } from '../src/security/encryption.service';

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(db.hostname) || !db.pathname.startsWith('/umbrella_execution')) throw new Error('Local test database required');
  const prisma = new PrismaClient();
  const id = randomUUID();
  const tenantId = `local-journey-${id}`;
  const userId = `local-lawyer-${id}`;
  const otherId = `local-colleague-${id}`;
  const config = new ConfigService();
  const encryption = new EncryptionService(config);
  const token = new JwtService().sign({ sub: userId, email: `${id}@example.invalid`, userType: 'LAWYER', tenantId }, { secret: resolveJwtSecret(config), expiresIn: '10m' });
  async function request(path: string, body?: unknown, expected = 200) {
    const response = await fetch(`http://127.0.0.1:4000/api/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json() as any;
    assert.equal(response.status, expected, `${path}: unexpected status ${response.status}`);
    return result;
  }
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: 'LOCAL SYNTHETIC JOURNEY', primaryCountry: 'KE', defaultCurrency: 'KES' } });
    await prisma.user.createMany({ data: [userId, otherId].map((userId, index) => ({ id: userId, email: `journey-${id}-${index}@example.invalid`, userType: 'LAWYER', countryCode: 'IN' })) });
    await prisma.tenantUser.create({ data: { tenantId, userId, role: 'FIRM_ADMIN' } });
    const matter = await prisma.matter.create({ data: { tenantId, title: 'LOCAL TEST ONLY — fictional evidence review', countryCode: 'KE', jurisdiction: 'High Court', practiceArea: 'litigation_disputes', matterType: 'Dispute' } });
    const folder = await prisma.documentFolder.create({ data: { tenantId, matterId: matter.id, name: 'Evidence' } });
    const child = await prisma.documentFolder.create({ data: { tenantId, matterId: matter.id, parentId: folder.id, name: 'Statements' } });
    for (const [index, folderId] of [folder.id, child.id].entries()) {
      const document = await prisma.document.create({ data: { tenantId, matterId: matter.id, folderId, fileName: `synthetic-evidence-${index}.txt`, fileUrl: 'https://example.invalid/not-a-real-file', uploadedById: userId } });
      await prisma.document.update({ where: { id: document.id }, data: { extractedText: encryption.encryptStringForStorage(`SYNTHETIC EVIDENCE ${index}. A witness statement and correspondence need comparison. No admission or outcome has been established.`, `document-extracted-text:${document.id}`) } });
    }
    const options = await request(`/ai/research/matter-context?matterId=${matter.id}`);
    assert.equal(options.matter.countryCode, 'KE');
    assert.equal(options.documents.length, 2);
    assert.equal(options.folders.length, 2);
    process.stdout.write('PASS authorized matter country and nested document inventory\n');
    const event = await request('/calendar', { matterId: matter.id, title: 'LOCAL TEST preparation', startAt: '2026-11-10T09:00:00Z', endAt: '2026-11-10T10:00:00Z' }, 201);
    assert.equal(event.userId, userId);
    assert((await request(`/calendar?matterId=${matter.id}`)).some((row: { id: string }) => row.id === event.id));
    process.stdout.write('PASS matter calendar create and scoped read\n');
    await request(`/notifications?userId=${otherId}`, undefined, 403);
    process.stdout.write('PASS notification recipient isolation\n');
    await prisma.ethicalWall.create({ data: { tenantId, name: 'LOCAL TEST wall', createdBy: userId, restrictedUserIds: [userId], protectedMatterIds: [matter.id] } });
    await request(`/ai/research/matter-context?matterId=${matter.id}`, undefined, 403);
    process.stdout.write('PASS restricted matter blocks administrator research access\n');
    const catalog = await request('/pricing/professional-catalog?country=US');
    assert.equal(catalog.plans[0].amount, 100);
    assert.equal(catalog.plans[0].checkoutEligible, false);
    process.stdout.write('PASS target regional catalog with unconfigured checkout disabled\n');
  } finally {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  // The failed assertion's status is useful; never dump a request or token.
  process.stderr.write(JSON.stringify({ errorType: error?.name, message: error?.message?.slice(0, 400) }) + '\n');
  process.exitCode = 1;
});
