/** Real Nest worker graph initialization. Never connects to a hosted database. */
import assert from 'node:assert/strict';
import { closeWorkerServices, getWorkerServices } from '../src/jobs/workers/worker-context';
async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  const redis = new URL(process.env.REDIS_URL ?? '');
  assert(['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname.startsWith('/umbrella_execution'), 'Local QA database required');
  assert(['127.0.0.1', 'localhost'].includes(redis.hostname), 'Local QA Redis required');
  try {
    const services = await getWorkerServices();
    assert(services.aiGateway && services.artifactAccess && services.llmCompletion);
    console.log(JSON.stringify({ actualWorkerGraphInitialized: true, researchServicesResolved: true }));
  } finally { await closeWorkerServices(); }
}
void main().catch(error => { console.error(error.name); process.exitCode = 1; });
