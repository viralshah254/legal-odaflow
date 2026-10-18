import { getCreditCost } from '@/ai-credits/credit-costs';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';

export function automaticResearchEvidenceCredits(input: {
  casesAdded: number;
  sectionsAdded: number;
}): number {
  if (input.casesAdded <= 0 && input.sectionsAdded <= 0) return 0;
  return getCreditCost(AI_TASK_TYPES.RESEARCH_ENRICH_BOTH);
}
