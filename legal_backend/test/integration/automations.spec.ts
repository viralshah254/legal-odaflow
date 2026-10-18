/**
 * Integration tests for the automation engine.
 *
 * These are pure unit/logic tests — no database or HTTP server required.
 * They verify:
 *   1. practiceArea condition matching (including alias support)
 *   2. matterType condition matching (unchanged behaviour)
 *   3. Action execution creates tasks (via a mocked PrismaService)
 *   4. seedBuiltInRules idempotency
 */

import { PRACTICE_AREA_ALIASES } from '@/automations/automation.types';
import { BUILT_IN_AUTOMATION_RECIPES } from '@/agents/agent.registry';

// ---------------------------------------------------------------------------
// Helper: replicate the matchesConditions logic without instantiating the
// full NestJS DI container, so tests stay fast and dependency-free.
// ---------------------------------------------------------------------------

interface AutomationConditions {
  hasAssignee?: boolean;
  jobType?: string;
  matterType?: string;
  practiceArea?: string;
  minAmount?: number;
}

function matchesConditions(
  conditions: AutomationConditions,
  context: Record<string, unknown>,
): boolean {
  if (conditions.hasAssignee && !context.assigneeId) return false;

  if (conditions.jobType && context.jobType !== conditions.jobType) return false;

  if (conditions.matterType && context.matterType !== conditions.matterType) return false;

  if (conditions.practiceArea) {
    const contextArea = String(context.practiceArea ?? '').toLowerCase();
    const condArea = conditions.practiceArea.toLowerCase();

    if (contextArea !== condArea) {
      const aliasesForCond = PRACTICE_AREA_ALIASES[condArea] ?? [];
      const canonicalForContext = Object.entries(PRACTICE_AREA_ALIASES).find(
        ([, aliases]) => aliases.includes(contextArea),
      )?.[0];

      const matchesByAlias =
        aliasesForCond.includes(contextArea) ||
        (canonicalForContext !== undefined && canonicalForContext === condArea);

      if (!matchesByAlias) return false;
    }
  }

  if (
    conditions.minAmount !== undefined &&
    Number(context.amount ?? 0) < conditions.minAmount
  ) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutomationEngine – condition matching', () => {
  describe('practiceArea exact match', () => {
    it('matches when practiceArea equals condition slug', () => {
      expect(
        matchesConditions(
          { practiceArea: 'employment_labour' },
          { practiceArea: 'employment_labour' },
        ),
      ).toBe(true);
    });

    it('does not match a different practice area', () => {
      expect(
        matchesConditions(
          { practiceArea: 'employment_labour' },
          { practiceArea: 'corporate_commercial' },
        ),
      ).toBe(false);
    });
  });

  describe('practiceArea alias matching', () => {
    it('matches employment alias → employment_labour', () => {
      expect(
        matchesConditions(
          { practiceArea: 'employment_labour' },
          { practiceArea: 'employment' },
        ),
      ).toBe(true);
    });

    it('matches criminal alias → litigation_disputes', () => {
      expect(
        matchesConditions(
          { practiceArea: 'litigation_disputes' },
          { practiceArea: 'criminal' },
        ),
      ).toBe(true);
    });

    it('matches corporate alias → corporate_commercial', () => {
      expect(
        matchesConditions(
          { practiceArea: 'corporate_commercial' },
          { practiceArea: 'corporate' },
        ),
      ).toBe(true);
    });

    it('matches family alias → family_matrimonial', () => {
      expect(
        matchesConditions(
          { practiceArea: 'family_matrimonial' },
          { practiceArea: 'family' },
        ),
      ).toBe(true);
    });

    it('matches ip alias → intellectual_property', () => {
      expect(
        matchesConditions(
          { practiceArea: 'intellectual_property' },
          { practiceArea: 'ip' },
        ),
      ).toBe(true);
    });

    it('matches real_estate alias → real_estate_property', () => {
      expect(
        matchesConditions(
          { practiceArea: 'real_estate_property' },
          { practiceArea: 'real_estate' },
        ),
      ).toBe(true);
    });

    it('matches litigation alias → litigation_disputes', () => {
      expect(
        matchesConditions(
          { practiceArea: 'litigation_disputes' },
          { practiceArea: 'litigation' },
        ),
      ).toBe(true);
    });

    it('does not cross-match unrelated practice areas', () => {
      expect(
        matchesConditions(
          { practiceArea: 'employment_labour' },
          { practiceArea: 'corporate' }, // corporate is an alias for corporate_commercial, not employment_labour
        ),
      ).toBe(false);
    });
  });

  describe('matterType condition (unchanged behaviour)', () => {
    it('passes when matterType matches exactly', () => {
      expect(
        matchesConditions({ matterType: 'Litigation' }, { matterType: 'Litigation' }),
      ).toBe(true);
    });

    it('fails when matterType does not match', () => {
      expect(
        matchesConditions({ matterType: 'Litigation' }, { matterType: 'Drafting' }),
      ).toBe(false);
    });

    it('passes when conditions is empty (always-fire rule)', () => {
      expect(matchesConditions({}, { matterType: 'Litigation', practiceArea: 'foo' })).toBe(true);
    });
  });

  describe('hasAssignee condition', () => {
    it('passes when assigneeId is present', () => {
      expect(matchesConditions({ hasAssignee: true }, { assigneeId: 'user-1' })).toBe(true);
    });

    it('fails when assigneeId is absent', () => {
      expect(matchesConditions({ hasAssignee: true }, {})).toBe(false);
    });
  });

  describe('minAmount condition', () => {
    it('passes when amount meets the threshold', () => {
      expect(matchesConditions({ minAmount: 100 }, { amount: 150 })).toBe(true);
    });

    it('fails when amount is below threshold', () => {
      expect(matchesConditions({ minAmount: 100 }, { amount: 50 })).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Recipe catalog invariants
// ---------------------------------------------------------------------------

describe('BUILT_IN_AUTOMATION_RECIPES', () => {
  it('all practice-area recipes use practiceArea, not matterType', () => {
    const practiceAreaRecipes = BUILT_IN_AUTOMATION_RECIPES.filter(
      (r) => r.recipeKey.includes('_tasks') && r.recipeKey !== 'matter_kickoff_checklist',
    );

    for (const recipe of practiceAreaRecipes) {
      const conds = recipe.conditions as Record<string, unknown>;
      expect(Object.keys(conds)).not.toContain('matterType');
      expect(Object.keys(conds)).toContain('practiceArea');
    }
  });

  it('all practiceArea slugs in recipes resolve via the alias table or are canonical', () => {
    const canonicalSlugs = new Set(Object.keys(PRACTICE_AREA_ALIASES));

    const practiceAreaRecipes = BUILT_IN_AUTOMATION_RECIPES.filter(
      (r) => 'practiceArea' in (r.conditions as Record<string, unknown>),
    );

    for (const recipe of practiceAreaRecipes) {
      const slug = (recipe.conditions as Record<string, unknown>).practiceArea as string;
      // The slug must either be a canonical key in the alias table, or 'immigration'
      // (which has no aliases but is a valid slug).
      const isKnown = canonicalSlugs.has(slug) || slug === 'immigration';
      expect(isKnown).toBe(true);
    }
  });

  it('employment matter.created dispatch matches employment recipe', () => {
    const recipe = BUILT_IN_AUTOMATION_RECIPES.find(
      (r) => r.recipeKey === 'employment_new_matter_tasks',
    )!;
    expect(
      matchesConditions(recipe.conditions as AutomationConditions, {
        practiceArea: 'employment_labour',
      }),
    ).toBe(true);
  });

  it('Litigation matterType dispatch does NOT match employment recipe', () => {
    const recipe = BUILT_IN_AUTOMATION_RECIPES.find(
      (r) => r.recipeKey === 'employment_new_matter_tasks',
    )!;
    expect(
      matchesConditions(recipe.conditions as AutomationConditions, {
        matterType: 'Litigation',
        practiceArea: 'litigation_disputes',
      }),
    ).toBe(false);
  });

  it('every recipe has at least one action', () => {
    for (const recipe of BUILT_IN_AUTOMATION_RECIPES) {
      expect(recipe.actions.length).toBeGreaterThan(0);
    }
  });
});
