/** Paid provider smoke test. Disposable LOCAL tenant only; no confidential facts. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { resolveJwtSecret } from '../src/auth/auth-secrets.util';

export const EMPLOYMENT_RESEARCH_QUESTION = `Under India’s Employment law, what is the required notice period for an employee who is not working (i.e., discontinuing work) under the applicable Employment Act, and what rules apply to such notice?
- Parties: Employer and employee (unspecified)
- Jurisdiction/Context: India (IN)
- What I want: the applicable notice-period rule and any related requirements under the Employment Act`;

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.startsWith('/umbrella_execution'), 'Isolated local test DB required');
  const countryCode = process.env.VERIFIED_QA_COUNTRY ?? 'IN';
  assert(['IN', 'KE', 'US'].includes(countryCode), 'Public research QA supports India, Kenya and the US');
  const query = process.env.VERIFIED_QA_QUESTION ?? EMPLOYMENT_RESEARCH_QUESTION;
  const prisma = new PrismaClient(), suffix = randomUUID();
  const tenantId = `verified-latency-${suffix}`, userId = `verified-lawyer-${suffix}`;
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: 'LOCAL VERIFIED LATENCY QA', primaryCountry: countryCode, defaultCurrency: countryCode === 'KE' ? 'KES' : countryCode === 'US' ? 'USD' : 'INR', aiCreditsRemaining: 100000 } });
    await prisma.user.create({ data: { id: userId, email: `${suffix}@example.invalid`, userType: 'LAWYER', countryCode } });
    await prisma.tenantUser.create({ data: { tenantId, userId, role: 'FIRM_ADMIN' } });
    const token = new JwtService().sign({ sub: userId, email: `${suffix}@example.invalid`, userType: 'LAWYER', tenantId }, { secret: resolveJwtSecret(new ConfigService()), expiresIn: '10m' });
    const started = Date.now();
    const asyncMode = process.env.VERIFIED_QA_ASYNC === '1';
    const response = await fetch('http://127.0.0.1:4001/api/v1/ai/research' + (asyncMode ? '/async' : ''), {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, countryCode, ...(process.env.VERIFIED_QA_AS_OF ? { asOfDate: process.env.VERIFIED_QA_AS_OF, eventDate: process.env.VERIFIED_QA_AS_OF } : {}), researchMode: 'DEEP', aiModelMode: 'PREMIUM', desiredOutput: 'ANSWER', knowledgeSources: ['statutes', 'case_law', 'web', 'regulations'] }),
      signal: AbortSignal.timeout(100000),
    });
    let result = await response.json() as Record<string, any>;
    const phases: string[] = [];
    if (asyncMode && response.ok) {
      const jobId = result.jobId;
      while (Date.now() - started < 95000) {
        const poll = await fetch(`http://127.0.0.1:4001/api/v1/agents/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId }, signal: AbortSignal.timeout(10000) });
        assert(poll.ok, 'Job polling must stay authorized');
        const job = await poll.json() as Record<string, any>;
        const phase = job.payload?.researchProgress?.phase ?? job.payload?.progress?.phase;
        if (phase && phases.at(-1) !== phase) phases.push(phase);
        if (job.status === 'FAILED') throw Error('Async research failed');
        if (job.status === 'COMPLETED') { result = job.result; break; }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    const elapsedMs = Date.now() - started, markdown = String(result.outputMarkdown ?? '');
    if (process.env.VERIFIED_QA_OUTPUT) writeFileSync(process.env.VERIFIED_QA_OUTPUT, JSON.stringify({ elapsedMs, result }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ status: response.status, asyncMode, phases, elapsedMs, researchMode: result.researchMode, model: result.modelName,
      publicationState: result.publicationState, verificationStatus: result.verificationStatus, stageTimings: result.stageTimings,
      requiresLawyerReview: result.requiresLawyerReview, outputChars: markdown.length, degraded: result.degraded,
      addressesMissingContext: /state|contract|resign|terminat|clarif/i.test(markdown) }));
    assert(response.ok, `Research failed: ${response.status}`);
    assert.equal(result.researchMode, 'DEEP', 'Never silently downgrade the selected mode');
    assert(!result.degraded && result.provider !== 'fallback', 'A timeout fallback is not a passing benchmark');
    if (process.env.VERIFIED_QA_REQUIRE_GROUNDED === '1') {
      assert((result.citations?.length ?? 0) > 0, 'Verified research must retrieve relevant sources when providers are available');
      assert(result.citations.every((citation: any) => citation.verified === true || citation.sourceVerified === true), 'Every displayed citation needs a successful source verification, independent of current-law caveats');
      assert(['RESEARCH_BACKED', 'READY_FOR_LAWYER_REVIEW', 'VERIFIED_WITH_LIMITATIONS'].includes(result.publicationState), 'The grounded quality gate requires an audited research result, not an unverified draft');
      assert(result.dimensions?.relevance?.state && result.dimensions.relevance.state !== 'NOT_APPLICABLE', 'Verified mode must execute source verification rather than a model-only bypass');
      assert(result.dimensions?.identity?.state && result.dimensions.identity.state !== 'NOT_APPLICABLE', 'Citation identity checks are required');
    }
    if (countryCode === 'KE' && /Employment Act 2007/i.test(query) && /Kenfreight/i.test(query)) {
      assert(/(?:twenty[- <]?eight|28)[ -]*(?:day|days)/i.test(markdown), 'Kenya answer must state the supported monthly notice period');
      assert(/\b35\b/.test(markdown) && /\b36\b/.test(markdown), 'Kenya notice and payment-in-lieu provisions must both be addressed');
      assert(/(?:appeal[^.]{0,100}dismiss|dismiss[^.]{0,100}appeal)/is.test(markdown), 'Kenfreight actual appeal outcome must be correct');
    }
    if (countryCode === 'US' && /Brown v/i.test(query)) {
      assert(/equal protection/i.test(markdown) && /(?:restor[^.]{0,100}docket|further argument)/is.test(markdown), 'Brown must distinguish the constitutional merits from the reserved remedy');
      assert(/PDF p\.|page|para\./i.test(markdown), 'US opinion requires real source pinpoints');
    }
    assert(markdown.length > 1000, 'A useful answer or clarification is required');
    assert(!/unable to generate a response/i.test(markdown));
    assert(elapsedMs < (asyncMode ? 90000 : 65000), 'Verified research must finish within the bounded request budget');
  } finally {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}
if (require.main === module) main().catch(error => { console.error(error.name, error.message); process.exitCode = 1; });
