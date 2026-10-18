import { AI_JOB_TYPES } from './jobs.constants';

/** Covers the 60s Verified deadline plus abort + persist. */
export const RESEARCH_LOCK_DURATION_MS = 180_000;
export const RESEARCH_STALLED_INTERVAL_MS = 30_000;
export const RESEARCH_MAX_STALLED_COUNT = 2;

/** Hung LLM retries are what turn a 30–60s miss into a 300s stall. */
export function bullmqAttemptsForJobType(jobType: string): number {
  return jobType === AI_JOB_TYPES.LEGAL_RESEARCH_MEMO ? 1 : 3;
}
