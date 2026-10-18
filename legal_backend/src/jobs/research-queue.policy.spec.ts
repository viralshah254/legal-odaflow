import { AI_JOB_TYPES } from './jobs.constants';
import {
  bullmqAttemptsForJobType,
  RESEARCH_LOCK_DURATION_MS,
  RESEARCH_MAX_STALLED_COUNT,
  RESEARCH_STALLED_INTERVAL_MS,
} from './research-queue.policy';

describe('research-queue.policy', () => {
  it('gives research jobs a lock longer than the Verified deadline and a single attempt', () => {
    expect(RESEARCH_LOCK_DURATION_MS).toBe(180_000);
    expect(RESEARCH_STALLED_INTERVAL_MS).toBe(30_000);
    expect(RESEARCH_MAX_STALLED_COUNT).toBe(2);
    expect(bullmqAttemptsForJobType(AI_JOB_TYPES.LEGAL_RESEARCH_MEMO)).toBe(1);
    expect(bullmqAttemptsForJobType(AI_JOB_TYPES.OPPONENT_ANALYZER)).toBe(3);
    expect(bullmqAttemptsForJobType(AI_JOB_TYPES.SUMMARIZE_MATTER)).toBe(3);
  });
});
