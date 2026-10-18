export const INTAKE_CASE_BRIEF_KEY = 'intakeCaseBrief';

export type IntakeToolPlanItem = 'retrieve' | 'section_finder' | 'draft' | 'strategy';

export interface IntakeCaseBrief {
  suggestedOutcomes?: string[];
  parties?: string;
  toolPlan?: IntakeToolPlanItem[];
  missingSlots?: string[];
  recommendedNextTool?: IntakeToolPlanItem;
}

const TOOL_PLAN_ITEMS = new Set<IntakeToolPlanItem>([
  'retrieve',
  'section_finder',
  'draft',
  'strategy',
]);

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function asToolPlan(value: unknown): IntakeToolPlanItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is IntakeToolPlanItem =>
    TOOL_PLAN_ITEMS.has(item as IntakeToolPlanItem),
  );
  return items.length > 0 ? items : undefined;
}

export function readIntakeCaseBrief(planningAnswers: unknown): IntakeCaseBrief | null {
  const root = asObject(planningAnswers);
  if (!root) return null;
  const raw = asObject(root[INTAKE_CASE_BRIEF_KEY]);
  if (!raw) return null;

  const recommended = raw.recommendedNextTool;
  const brief: IntakeCaseBrief = {
    suggestedOutcomes: asStringList(raw.suggestedOutcomes),
    parties: typeof raw.parties === 'string' && raw.parties.trim() ? raw.parties.trim() : undefined,
    toolPlan: asToolPlan(raw.toolPlan),
    missingSlots: asStringList(raw.missingSlots),
    recommendedNextTool: TOOL_PLAN_ITEMS.has(recommended as IntakeToolPlanItem)
      ? (recommended as IntakeToolPlanItem)
      : undefined,
  };

  if (
    !brief.suggestedOutcomes &&
    !brief.parties &&
    !brief.toolPlan &&
    !brief.missingSlots &&
    !brief.recommendedNextTool
  ) {
    return null;
  }
  return brief;
}

export function mergeIntakeCaseBrief(
  planningAnswers: Record<string, unknown> | null | undefined,
  brief: IntakeCaseBrief,
): Record<string, unknown> {
  const existing = readIntakeCaseBrief(planningAnswers) ?? {};
  return {
    ...(planningAnswers ?? {}),
    [INTAKE_CASE_BRIEF_KEY]: {
      ...existing,
      ...Object.fromEntries(
        Object.entries(brief).filter(([, value]) => value !== undefined && value !== null),
      ),
    },
  };
}

export function partiesFromIntakeBrief(
  brief: IntakeCaseBrief | null | undefined,
  extras: Array<{ name?: string | null; email?: string | null }> = [],
): Array<{ name?: string; email?: string }> {
  const parties: Array<{ name?: string; email?: string }> = [];
  const seen = new Set<string>();
  const seenNames = new Set<string>();

  const push = (party: { name?: string | null; email?: string | null }) => {
    const name = party.name?.trim();
    const email = party.email?.trim();
    if (!name && !email) return;
    const nameKey = name?.toLowerCase();
    if (nameKey && seenNames.has(nameKey)) return;
    const key = `${nameKey ?? ''}|${email?.toLowerCase() ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (nameKey) seenNames.add(nameKey);
    parties.push({ name: name || undefined, email: email || undefined });
  };

  for (const extra of extras) push(extra);

  const raw = brief?.parties?.trim();
  if (raw) {
    for (const part of raw.split(/\s+(?:vs\.?|v\.|and|&|,|;)\s+/i)) {
      push({ name: part });
    }
  }

  return parties;
}
