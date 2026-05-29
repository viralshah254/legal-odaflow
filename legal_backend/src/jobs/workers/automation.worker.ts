import { Worker, Job } from 'bullmq';
import { AutomationRunPayload } from '@/automations/automation.types';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function processAutomationJob(job: Job<AutomationRunPayload>) {
  const { automationEngine } = await getWorkerServices();
  return automationEngine.executeRun(job.data);
}

export function createAutomationWorker() {
  return new Worker<AutomationRunPayload>(
    QUEUE_NAMES.AUTOMATIONS,
    processAutomationJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3,
    },
  );
}
