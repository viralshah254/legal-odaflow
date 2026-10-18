/**
 * Pure intent-routing utility — no BullMQ, Prisma, or NestJS dependencies.
 * Maps free-text messages to AI pattern IDs used by the agentic workflow engine
 * and the copilot system prompt.
 *
 * Exported here so it can be safely imported by both CopilotService (NestJS API
 * process) and agentic-workflow.worker (BullMQ worker process) without creating
 * a circular module dependency.
 */

const INTENT_MAP: Array<{ keywords: RegExp; patterns: string[] }> = [
  { keywords: /\b(research|precedent|case law|statute|regulation|find.*law)\b/i, patterns: ['case-law-research', 'regulatory-research'] },
  { keywords: /\b(draft|write|generate|create.*document|letter|agreement|contract)\b/i, patterns: ['draft-generation'] },
  { keywords: /\b(review|diligence|clause|redline|amend|edit|revise)\b/i, patterns: ['clause-extraction', 'redline-amend'] },
  { keywords: /\b(outcome|probability|win|settle|predict|risk)\b/i, patterns: ['outcome-analysis'] },
  { keywords: /\b(evidence|missing|gap|discovery)\b/i, patterns: ['evidence-gap'] },
  { keywords: /\b(deadline|sla|court date|filing date)\b/i, patterns: ['deadline-sla'] },
  { keywords: /\b(meeting|transcript|notes|action items)\b/i, patterns: ['meeting-facts'] },
  { keywords: /\b(memory|precedent|firm.*position|playbook|prior.*work)\b/i, patterns: ['firm-memory-retrieve', 'playbook-compare'] },
  { keywords: /\b(citation|authority|good law|overruled|challenged)\b/i, patterns: ['citation-audit'] },
  { keywords: /\b(compare|contrast|similar.*case|analogous)\b/i, patterns: ['compare-contrast-cases'] },
];

/**
 * Maps a free-text user message to a list of AI pattern IDs.
 * Falls back to ['case-law-research', 'synthesis-to-facts'] when no pattern matches.
 */
export async function routeIntent(message: string): Promise<string[]> {
  const matched = new Set<string>();
  for (const entry of INTENT_MAP) {
    if (entry.keywords.test(message)) {
      entry.patterns.forEach((p) => matched.add(p));
    }
  }

  if (matched.size === 0) {
    matched.add('case-law-research');
    matched.add('synthesis-to-facts');
  }

  return [...matched];
}
