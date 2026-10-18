/**
 * Party-aware matrimonial filing set — petitioner vs respondent paths and fact signals.
 */
import {
  resolveDocumentBundle,
  resolveMatrimonialDivorceBundle,
  resolveMatrimonialPartyRole,
} from '@/ai/draft-intent/draft-intent-bundles';
import { extractMatterFacts } from '@/ai/draft-intent/matter-fact-extractor';
import {
  NEHA_PETITIONER_FULL_INTAKE,
  ROHAN_RESPONDENT_INTAKE,
} from '@/ai/drafting/accuracy/neha-rohan-intake.fixture';

function primaryKinds(bundle: ReturnType<typeof resolveMatrimonialDivorceBundle>) {
  return bundle.filter((b) => b.bundleRole !== 'opposing_party').map((b) => b.kind);
}

function opposingKinds(bundle: ReturnType<typeof resolveMatrimonialDivorceBundle>) {
  return bundle.filter((b) => b.bundleRole === 'opposing_party').map((b) => b.kind);
}

describe('resolveMatrimonialPartyRole', () => {
  it('infers petitioner for Neha wife seeking divorce', () => {
    const extracted = extractMatterFacts(NEHA_PETITIONER_FULL_INTAKE);
    expect(resolveMatrimonialPartyRole(extracted)).toBe('petitioner');
  });

  it('infers respondent for Rohan defending divorce petition', () => {
    const extracted = extractMatterFacts(ROHAN_RESPONDENT_INTAKE);
    expect(resolveMatrimonialPartyRole(extracted)).toBe('respondent');
  });

  it('respects matrimonial_party_role clarifying answer', () => {
    const extracted = extractMatterFacts(NEHA_PETITIONER_FULL_INTAKE);
    expect(
      resolveMatrimonialPartyRole(extracted, { matrimonial_party_role: 'defending_spouse' }),
    ).toBe('respondent');
  });
});

describe('resolveMatrimonialDivorceBundle — Neha petitioner', () => {
  const extracted = extractMatterFacts(NEHA_PETITIONER_FULL_INTAKE);
  const bundle = resolveMatrimonialDivorceBundle(extracted);

  it('extracts custody, maintenance, DV, and stridhan signals', () => {
    expect(extracted.hasChildCustodyDispute).toBe(true);
    expect(extracted.seeksInterimMaintenance).toBe(true);
    expect(extracted.hasDvCase).toBe(true);
    expect(extracted.seeksStridhanRecovery).toBe(true);
    expect(extracted.inferredDivorceGround).toBe('cruelty');
    expect(extracted.inferredRepresentedParty).toBe('petitioner');
  });

  it('includes HMA §24, §26, PWDVA §12, and BNSS §144 in primary set', () => {
    expect(primaryKinds(bundle)).toEqual(
      expect.arrayContaining([
        'india_divorce_petition_s13',
        'india_hma_interim_maintenance_s24',
        'india_hma_custody_interim_s26',
        'india_domestic_violence_petition',
        'india_maintenance_application_bnss_144_family',
      ]),
    );
  });

  it('uses cruelty-specific divorce petition label', () => {
    const divorce = bundle.find((b) => b.kind === 'india_divorce_petition_s13');
    expect(divorce?.label).toContain('§13(1)(ia)');
    expect(divorce?.bundleRole).toBe('primary');
    expect(divorce?.selectedByDefault).toBe(true);
  });

  it('places Written Statement and Restitution in opposing-party section', () => {
    expect(opposingKinds(bundle)).toEqual(
      expect.arrayContaining(['india_written_statement', 'india_restitution_conjugal_rights']),
    );
    expect(primaryKinds(bundle)).not.toContain('india_written_statement');
    expect(primaryKinds(bundle)).not.toContain('india_restitution_conjugal_rights');
  });

  it('does not pre-select opposing-party documents', () => {
    for (const item of bundle.filter((b) => b.bundleRole === 'opposing_party')) {
      expect(item.selectedByDefault).toBe(false);
    }
  });

  it('includes stridhan recovery when jewellery facts are present', () => {
    expect(primaryKinds(bundle)).toContain('india_stridhan_recovery_application');
  });

  it('assigns fact-weighted confidence above opposing-party cap', () => {
    const hma24 = bundle.find((b) => b.kind === 'india_hma_interim_maintenance_s24');
    const ws = bundle.find((b) => b.kind === 'india_written_statement');
    expect(hma24?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(ws?.confidence).toBeLessThanOrEqual(0.75);
  });
});

describe('resolveMatrimonialDivorceBundle — Rohan respondent', () => {
  const extracted = extractMatterFacts(ROHAN_RESPONDENT_INTAKE);
  const bundle = resolveMatrimonialDivorceBundle(extracted);

  it('makes Written Statement the primary selected document', () => {
    const ws = bundle.find((b) => b.kind === 'india_written_statement');
    expect(ws?.bundleRole).toBe('primary');
    expect(ws?.selectedByDefault).toBe(true);
  });

  it('excludes divorce petition from primary set', () => {
    expect(primaryKinds(bundle)).not.toContain('india_divorce_petition_s13');
  });

  it('places divorce petition in opposing-party section', () => {
    expect(opposingKinds(bundle)).toContain('india_divorce_petition_s13');
  });
});

describe('resolveDocumentBundle integration', () => {
  it('returns party-aware bundle for Neha facts via isDivorceMatrimonialContext', () => {
    const bundle = resolveDocumentBundle(undefined, NEHA_PETITIONER_FULL_INTAKE);
    expect(bundle).toBeDefined();
    expect(primaryKinds(bundle!)).toContain('india_hma_interim_maintenance_s24');
    expect(opposingKinds(bundle!)).toContain('india_written_statement');
  });

  it('returns respondent bundle when clarifying answer says defending spouse', () => {
    const bundle = resolveDocumentBundle(undefined, NEHA_PETITIONER_FULL_INTAKE, {
      answers: { matrimonial_party_role: 'defending_spouse' },
    });
    expect(bundle?.find((b) => b.kind === 'india_written_statement')?.bundleRole).toBe('primary');
    expect(primaryKinds(bundle!)).not.toContain('india_divorce_petition_s13');
  });
});

describe('restitution-only husband bundle', () => {
  const RESTITUTION_HUSBAND = `
Husband has withdrawn from society without reasonable excuse. Wife seeks restitution of
conjugal rights under HMA Section 9. The matrimonial home is in Delhi.
`.trim();

  it('does not trigger divorce matrimonial bundle (no divorce intent)', () => {
    expect(resolveDocumentBundle(undefined, RESTITUTION_HUSBAND)).toBeUndefined();
  });
});
