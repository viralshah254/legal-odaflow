import type { MatterTaskGraph } from './matter-intelligence.types';

/** Maps TaskGraph.recommendedActions → firm playbook keys (P14 scaffold). */
export const ACTION_TO_PLAYBOOK_KEY: Record<string, string> = {
  'Send legal notice': 'demand_notice',
  'File petition': 'litigation_intake',
  'Draft contract': 'transactional_intake',
  'Collect evidence': 'evidence_gathering',
  'Schedule client call': 'client_intake',
};

export function resolvePlaybookKeysFromTaskGraph(taskGraph?: MatterTaskGraph): string[] {
  if (!taskGraph?.recommendedActions?.length) return [];
  const keys = new Set<string>();
  for (const action of taskGraph.recommendedActions) {
    const mapped = ACTION_TO_PLAYBOOK_KEY[action];
    if (mapped) keys.add(mapped);
    else keys.add(action.toLowerCase().replace(/\W+/g, '_').slice(0, 48));
  }
  return [...keys];
}

export function resolvePlaybookKeyForAction(action: string): string {
  return (
    ACTION_TO_PLAYBOOK_KEY[action] ??
    action.toLowerCase().replace(/\W+/g, '_').slice(0, 48)
  );
}
