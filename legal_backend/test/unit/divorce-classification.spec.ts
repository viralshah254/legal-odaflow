/**
 * Tests for the divorce/judicial-separation fact-finder classification fix.
 *
 * Verifies:
 * 1. Divorce-with-ancillary-maintenance facts → divorce_petition (not Article 227 / maintenance)
 * 2. "Petition of separation" → judicial_separation or divorce_petition (not service_agreement)
 * 3. Pure maintenance order challenge facts still → maintenance_order_revision / hma_section_24_challenge
 * 4. Matter Intelligence routing rules produce divorce (not maintenance) for divorce facts
 */
import {
  resolveIndiaCourtPleadingKind,
  hasPrimaryMatrimonialReliefContext,
  resolveDocumentKind,
} from '@/config/templates/document-kinds';
import {
  matchRoutingRule,
  hasStrongDivorceContext,
  hasStrongFamilyMaintenanceContext,
} from '@/ai/matter-intelligence/matter-taxonomy-routing';
import {
  isDivorceMatrimonialContext,
  resolveDocumentBundle,
  MATRIMONIAL_DIVORCE_FILING_BUNDLE,
} from '@/ai/draft-intent/draft-intent-bundles';

// ─── Sample facts ────────────────────────────────────────────────────────────

const ARJUN_NEHA_FACTS = `
Mr. Arjun Shah and Mrs. Neha Shah were married on 10 February 2019 according to Hindu rites.
Arjun alleges that Neha frequently insulted him and his parents, made repeated accusations of
infidelity without evidence, publicly humiliated him before relatives, refused marital companionship,
and left the matrimonial home on 15 July 2022 without reasonable cause.
After leaving, Neha did not return despite two written requests, mediation, and a legal notice.
In August 2024, Arjun filed a petition for divorce on the grounds of cruelty and desertion.
Evidence shows the parties have lived separately for more than two years.
Maintenance, permanent alimony, custody, and property claims would require separate consideration.
`.trim();

const JAY_D_FACTS = `
Mr. jay shah and Mrs. d Shah were married on 10 February 2019 according to Hindu rites.
jay alleges that D frequently insulted him and his parents, made repeated accusations of infidelity,
publicly humiliated him, refused marital companionship.
D contends she left because Jay and his family harassed her over household expenses.
Arjun seeks remedy by filing a petition of separation.
`.trim();

const MAINTENANCE_REVISION_FACTS = `
Ram vs Ria. Interim maintenance order under CrPC 125 received. Ram challenges the interim maintenance order.
Appeal to Gujarat High Court. Ram seeks to set aside the interim maintenance order.
`.trim();

const HMA_24_FACTS = `
Challenge to HMA Section 24 interim maintenance order from the Family Court.
Order of Rs 50,000 per month. Husband wants to challenge the order.
`.trim();

const MUTUAL_CONSENT_FACTS = `
Priya and Rohan married on 5 Jan 2020. Both mutually consent to divorce under HMA §13-B.
`.trim();

const RESTITUTION_FACTS = `
Husband has withdrawn from society without reasonable excuse. Wife seeks restitution of
conjugal rights under HMA Section 9. The matrimonial home is in Delhi.
`.trim();

const JUDICIAL_SEPARATION_FACTS = `
Petition for judicial separation under HMA Section 10. The parties have lived apart for 2 years.
Grounds of cruelty are pleaded in the alternative.
`.trim();

// ─── hasPrimaryMatrimonialReliefContext ──────────────────────────────────────

describe('hasPrimaryMatrimonialReliefContext', () => {
  it('returns true for Arjun/Neha divorce facts with ancillary maintenance mention', () => {
    expect(hasPrimaryMatrimonialReliefContext(ARJUN_NEHA_FACTS.toLowerCase())).toBe(true);
  });

  it('returns true for "petition of separation" facts', () => {
    expect(hasPrimaryMatrimonialReliefContext(JAY_D_FACTS.toLowerCase())).toBe(true);
  });

  it('returns true for restitution of conjugal rights facts', () => {
    expect(hasPrimaryMatrimonialReliefContext(RESTITUTION_FACTS.toLowerCase())).toBe(true);
  });

  it('returns false for maintenance order challenge facts (no divorce intent)', () => {
    expect(hasPrimaryMatrimonialReliefContext(MAINTENANCE_REVISION_FACTS.toLowerCase())).toBe(false);
  });

  it('returns false when both divorce intent and maintenance order challenge coexist', () => {
    // The guard must detect that a maintenance order is the challenge target
    const mixed =
      'divorce petition + interim maintenance order to be set aside. Ram wants revision of interim maintenance order.';
    expect(hasPrimaryMatrimonialReliefContext(mixed.toLowerCase())).toBe(false);
  });
});

// ─── resolveIndiaCourtPleadingKind ───────────────────────────────────────────

describe('resolveIndiaCourtPleadingKind', () => {
  it('returns divorce_petition for Arjun/Neha divorce facts', () => {
    expect(resolveIndiaCourtPleadingKind(ARJUN_NEHA_FACTS.toLowerCase())).toBe('divorce_petition');
  });

  it('returns divorce_petition for "petition of separation" facts', () => {
    const result = resolveIndiaCourtPleadingKind(JAY_D_FACTS.toLowerCase());
    expect(['divorce_petition', 'judicial_separation']).toContain(result);
  });

  it('returns judicial_separation for explicit judicial separation facts', () => {
    expect(resolveIndiaCourtPleadingKind(JUDICIAL_SEPARATION_FACTS.toLowerCase())).toBe(
      'judicial_separation',
    );
  });

  it('returns restitution_conjugal_rights for restitution facts', () => {
    expect(resolveIndiaCourtPleadingKind(RESTITUTION_FACTS.toLowerCase())).toBe(
      'restitution_conjugal_rights',
    );
  });

  it('returns maintenance_order_revision for pure maintenance order challenge', () => {
    expect(resolveIndiaCourtPleadingKind(MAINTENANCE_REVISION_FACTS.toLowerCase())).toBe(
      'maintenance_order_revision',
    );
  });

  it('returns hma_section_24_challenge for HMA §24 Family Court order challenge', () => {
    expect(resolveIndiaCourtPleadingKind(HMA_24_FACTS.toLowerCase())).toBe(
      'hma_section_24_challenge',
    );
  });

  it('does NOT return maintenance_order_revision for divorce facts that mention alimony as ancillary', () => {
    const result = resolveIndiaCourtPleadingKind(ARJUN_NEHA_FACTS.toLowerCase());
    expect(result).not.toBe('maintenance_order_revision');
    expect(result).not.toBe('hma_section_24_challenge');
    expect(result).not.toBe('hma_article_227_challenge');
  });
});

// ─── resolveDocumentKind (generic entry point) ───────────────────────────────

describe('resolveDocumentKind', () => {
  it('classifies Arjun/Neha facts as divorce_petition', () => {
    expect(resolveDocumentKind(undefined, ARJUN_NEHA_FACTS)).toBe('divorce_petition');
  });

  it('classifies "petition of separation" as divorce_petition or judicial_separation', () => {
    const result = resolveDocumentKind(undefined, JAY_D_FACTS);
    expect(['divorce_petition', 'judicial_separation']).toContain(result);
  });

  it('does NOT classify them as service_agreement (the old broken default)', () => {
    expect(resolveDocumentKind(undefined, JAY_D_FACTS)).not.toBe('service_agreement');
  });

  it('classifies mutual consent text as divorce_petition', () => {
    expect(resolveDocumentKind(undefined, MUTUAL_CONSENT_FACTS)).toBe('divorce_petition');
  });

  it('classifies restitution facts as restitution_conjugal_rights', () => {
    expect(resolveDocumentKind(undefined, RESTITUTION_FACTS)).toBe('restitution_conjugal_rights');
  });

  it('still classifies maintenance order challenge correctly', () => {
    expect(resolveDocumentKind(undefined, MAINTENANCE_REVISION_FACTS)).toBe(
      'maintenance_order_revision',
    );
  });
});

// ─── Matter Intelligence routing ─────────────────────────────────────────────

describe('hasStrongDivorceContext', () => {
  it('returns true for Arjun/Neha facts', () => {
    expect(hasStrongDivorceContext(ARJUN_NEHA_FACTS)).toBe(true);
  });

  it('returns true for "petition of separation" facts', () => {
    expect(hasStrongDivorceContext(JAY_D_FACTS)).toBe(true);
  });

  it('returns false for pure maintenance order revision facts', () => {
    expect(hasStrongDivorceContext(MAINTENANCE_REVISION_FACTS)).toBe(false);
  });
});

describe('matchRoutingRule — divorce vs maintenance priority', () => {
  it('routes Arjun/Neha divorce facts to family_matrimonial/divorce', () => {
    const rule = matchRoutingRule(ARJUN_NEHA_FACTS, 'dispute');
    expect(rule?.practiceArea).toBe('family_matrimonial');
    expect(rule?.subPracticeArea).toBe('divorce');
    expect(rule?.documentKind).toBe('divorce_petition');
  });

  it('routes "petition of separation" to family_matrimonial/divorce', () => {
    const rule = matchRoutingRule(JAY_D_FACTS, 'dispute');
    expect(rule?.practiceArea).toBe('family_matrimonial');
    expect(rule?.subPracticeArea).toBe('divorce');
  });

  it('still routes pure maintenance revision facts to family_matrimonial/maintenance', () => {
    const rule = matchRoutingRule(MAINTENANCE_REVISION_FACTS, 'dispute');
    expect(rule?.practiceArea).toBe('family_matrimonial');
    expect(rule?.subPracticeArea).toBe('maintenance');
  });

  it('does NOT route divorce facts to maintenance (the original bug)', () => {
    const rule = matchRoutingRule(ARJUN_NEHA_FACTS, 'dispute');
    expect(rule?.subPracticeArea).not.toBe('maintenance');
    expect(rule?.documentKind).not.toBe('maintenance_order_revision');
  });
});

// ─── Document bundles ─────────────────────────────────────────────────────────

describe('isDivorceMatrimonialContext', () => {
  it('returns true for Arjun/Neha divorce facts', () => {
    expect(isDivorceMatrimonialContext(ARJUN_NEHA_FACTS)).toBe(true);
  });

  it('returns true for "petition of separation" facts', () => {
    expect(isDivorceMatrimonialContext(JAY_D_FACTS)).toBe(true);
  });

  it('returns false for mutual consent divorce (simpler workflow, no bundle needed)', () => {
    expect(isDivorceMatrimonialContext(MUTUAL_CONSENT_FACTS)).toBe(false);
  });

  it('returns false for pure maintenance revision facts', () => {
    expect(isDivorceMatrimonialContext(MAINTENANCE_REVISION_FACTS)).toBe(false);
  });
});

describe('resolveDocumentBundle — divorce bundle', () => {
  it('returns a party-aware bundle for Arjun/Neha facts (not the legacy static array)', () => {
    const bundle = resolveDocumentBundle(undefined, ARJUN_NEHA_FACTS);
    expect(bundle).toBeDefined();
    expect(bundle).not.toBe(MATRIMONIAL_DIVORCE_FILING_BUNDLE);
  });

  it('first bundle item is the Divorce Petition as primary document', () => {
    const bundle = resolveDocumentBundle(undefined, ARJUN_NEHA_FACTS);
    expect(bundle?.[0].kind).toBe('india_divorce_petition_s13');
    expect(bundle?.[0].selectedByDefault).toBe(true);
    expect(bundle?.[0].bundleRole).toBe('primary');
  });

  it('places Written Statement in opposing-party section (not primary)', () => {
    const bundle = resolveDocumentBundle(undefined, ARJUN_NEHA_FACTS);
    const ws = bundle?.find((b) => b.kind === 'india_written_statement');
    expect(ws).toBeDefined();
    expect(ws?.bundleRole).toBe('opposing_party');
    expect(ws?.selectedByDefault).toBe(false);
  });

  it('includes maintenance application when maintenance context is present', () => {
    const bundle = resolveDocumentBundle(undefined, ARJUN_NEHA_FACTS);
    const hasMaintenance = bundle?.some(
      (b) =>
        b.kind === 'india_maintenance_application_bnss_144_family' ||
        b.kind === 'india_hma_interim_maintenance_s24' ||
        b.kind === 'india_maintenance_application_bnss_144',
    );
    expect(hasMaintenance).toBe(true);
  });

  it('returns undefined for maintenance revision facts (no bundle)', () => {
    const bundle = resolveDocumentBundle(undefined, MAINTENANCE_REVISION_FACTS);
    expect(bundle).toBeUndefined();
  });
});
