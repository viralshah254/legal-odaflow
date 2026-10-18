import {
  KENYA_DRAFT_CATALOG,
  getKenyaDraftCatalogEntry,
  resolveKenyaDraftKind,
} from '@/config/templates/kenya-drafting-catalog';
import { PLATFORM_DRAFT_PLAYBOOKS } from '@/ai/drafting/platform/platform-playbooks.registry';
import { buildTemplateLibrarySeeds } from '@/config/templates/build-seeds';

describe('Kenya drafting catalog', () => {
  it('defines the initial document set without claiming advocate review', () => {
    expect(KENYA_DRAFT_CATALOG.map((entry) => entry.kind)).toEqual([
      'kenya_civil_plaint',
      'kenya_notice_of_motion',
      'kenya_supporting_affidavit',
      'kenya_memorandum_of_claim',
      'kenya_demand_letter',
    ]);
    expect(
      KENYA_DRAFT_CATALOG.every(
        (entry) =>
          entry.advocateReview.status === 'pending' &&
          entry.requiredAuthorityFields.some((field) => field.required),
      ),
    ).toBe(true);
  });

  it('resolves canonical document kinds to Kenya kinds', () => {
    expect(resolveKenyaDraftKind('civil_plaint')).toBe('kenya_civil_plaint');
    expect(resolveKenyaDraftKind('notice_of_motion')).toBe('kenya_notice_of_motion');
    expect(resolveKenyaDraftKind('unknown')).toBe('kenya_form_catalog');
    expect(getKenyaDraftCatalogEntry('kenya_demand_letter')?.documentKind).toBe(
      'demand_letter',
    );
  });

  it('registers pending-review unified drafting playbooks', () => {
    const kenyaPlaybooks = PLATFORM_DRAFT_PLAYBOOKS.filter(
      (playbook) => playbook.jurisdiction === 'KE',
    );
    expect(kenyaPlaybooks).toHaveLength(KENYA_DRAFT_CATALOG.length);
    expect(
      kenyaPlaybooks.every(
        (playbook) =>
          playbook.lawyerApproved === false &&
          playbook.advocateReview?.status === 'pending' &&
          Boolean(playbook.requiredAuthorityFields?.length),
      ),
    ).toBe(true);
  });

  it('builds Kenya-specific templates for the initial set', () => {
    const seeds = buildTemplateLibrarySeeds().filter(
      (seed) =>
        seed.countryCode === 'KE' &&
        KENYA_DRAFT_CATALOG.some((entry) => entry.documentKind === seed.documentKind),
    );
    expect(new Set(seeds.map((seed) => seed.documentKind))).toEqual(
      new Set(KENYA_DRAFT_CATALOG.map((entry) => entry.documentKind)),
    );
    expect(seeds.every((seed) => seed.jurisdiction === 'Kenya')).toBe(true);
  });
});
