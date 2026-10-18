import { extractMatterFacts, applyExtractedProfileOverride } from '@/ai/draft-intent/matter-fact-extractor';
import {
  MatterClarificationService,
  mergeClarifyingQuestions,
} from '@/ai/draft-intent/matter-clarification.service';
import {
  expandSearchTokens,
  hasActionableClarifyingAnswers,
  documentKindToDraftKind,
  resolveCuratedDraftKindForInjection,
  resolveKindFromAnswers,
  resolveSelfDefenseKindFromAnswers,
} from '@/ai/draft-intent/draft-intent.helpers';
import {
  resolveDocumentBundle,
  resolveSelfDefenseBundle,
  shouldExcludeDraftIntentMatch,
} from '@/ai/draft-intent/draft-intent-bundles';
import { PlaybookResolverService } from '@/ai/draft-intent/playbook-resolver.service';
import { resolveIndiaCourtPleadingKind } from '@/config/templates/document-kinds';

const SELF_DEFENSE_DEATH = `
Mr a was sitting in balcony, and his wife was in the kitchen, Mr A stood up and faced the balcony, and wife came and tried to stab mr A, she missed and she fell off the balcony and died because Mr a was trying to save himself. Theres cctv footage showing the same
`.trim();

/** Live user query often omits the word "died" — implied fatal fall must still trigger intake. */
const SELF_DEFENSE_IMPLIED_DEATH = `
Mr a was sitting in balcony, and his wife was in the kitchen, Mr A stood up and faced the balcony, and wife came and tried to stab mr A, she missed and she fell off the balcony because Mr a was trying to save himself. Theres cctv footage showing the same
`.trim();

/** Full case study with caption + Accused: block (must personalize labels, not "Mr A"). */
const ARJUN_MEHTA_CASE = `
State v. Arjun Mehta

Jurisdiction
India

Accused:
Arjun Mehta, aged 38 years, businessman, residing in a seventh-floor apartment in Ahmedabad.

Deceased:
Naina Mehta, aged 34 years, wife of the accused.

On 18 February 2026, Naina approached Arjun with a knife. Arjun states that he blocked and deflected her arm in self-defence. She fell from the balcony and died.

Chargesheet filed. Prepare an application for discharge on behalf of Arjun Mehta.
`.trim();

describe('self-defence homicide intake', () => {
  it('detects death + self-defence and marks ambiguous posture', () => {
    const facts = extractMatterFacts(SELF_DEFENSE_DEATH);
    expect(facts.hasDeathOutcome).toBe(true);
    expect(facts.hasSelfDefenseSignals).toBe(true);
    expect(facts.isSelfDefenseHomicideContext).toBe(true);
    expect(facts.hasThreatOrViolenceSignals).toBe(true);
    expect(facts.posture).toBe('defend');
    expect(facts.proceedingType).toBe('criminal');
    expect(facts.summaryLines.some((l) => /death reported/i.test(l))).toBe(true);
  });

  it('detects implied death from fatal balcony fall without explicit "died"', () => {
    const facts = extractMatterFacts(SELF_DEFENSE_IMPLIED_DEATH);
    expect(facts.hasDeathOutcome).toBe(true);
    expect(facts.hasSelfDefenseSignals).toBe(true);
    expect(facts.isSelfDefenseHomicideContext).toBe(true);
    expect(facts.summaryLines.some((l) => /death reported/i.test(l))).toBe(true);
  });

  it('does not treat benign fell-off-chair as death outcome', () => {
    const facts = extractMatterFacts(
      'She fell off the chair while cooking and bruised her arm. No stabbing.',
    );
    expect(facts.hasDeathOutcome).toBe(false);
    expect(facts.isSelfDefenseHomicideContext).toBe(false);
  });

  it('emits self-defence clarifying questions for implied-death balcony narrative', () => {
    const service = new MatterClarificationService();
    const extracted = extractMatterFacts(SELF_DEFENSE_IMPLIED_DEATH);
    const questions = service.buildContextualQuestions(
      SELF_DEFENSE_IMPLIED_DEATH,
      {
        practiceArea: 'family_matrimonial',
        subPracticeArea: 'domestic_violence',
        confidence: 0.86,
      } as any,
      {
        documentKind: 'police_complaint',
        documentKindConfidence: 'high',
        documentKindReason: 'User should file FIR',
      } as any,
      extracted,
    );
    expect(questions.map((q) => q.id)).toEqual([
      'self_defense_goal',
      'self_defense_fir_status',
      'self_defense_custody_stage',
    ]);
  });

  it('emits self-defence clarifying questions instead of assuming FIR', () => {
    const service = new MatterClarificationService();
    const extracted = extractMatterFacts(SELF_DEFENSE_DEATH);
    const questions = service.buildContextualQuestions(
      SELF_DEFENSE_DEATH,
      {
        practiceArea: 'litigation_disputes',
        subPracticeArea: 'criminal_defence',
        confidence: 0.91,
      } as any,
      {
        documentKind: 'police_complaint',
        documentKindConfidence: 'high',
        documentKindReason: 'User should file FIR',
      } as any,
      extracted,
    );
    expect(questions.map((q) => q.id)).toEqual([
      'self_defense_goal',
      'self_defense_fir_status',
      'self_defense_custody_stage',
    ]);
    expect(questions[0].options?.some((o) => o.value === 'defense_against_homicide')).toBe(true);
    expect(questions[0].options?.some((o) => o.value === 'bail_or_anticipatory')).toBe(true);
    // No named accused extracted from placeholder "Mr A" narrative — use neutral copy.
    const defenseLabel = questions[0].options?.find((o) => o.value === 'defense_against_homicide')?.label;
    expect(defenseLabel).toContain('the accused');
    expect(defenseLabel).not.toMatch(/\bMr A\b/);
    const firLabel = questions[1].options?.find((o) => o.value === 'fir_against_client')?.label;
    expect(firLabel).toBe('FIR already registered against our client');
  });

  it('extracts Arjun Mehta from Accused: block and State v. caption', () => {
    const facts = extractMatterFacts(ARJUN_MEHTA_CASE);
    expect(facts.accusedName).toBe('Arjun Mehta');
    expect(facts.parties.label).toMatch(/State vs Arjun Mehta/i);
    expect(facts.isSelfDefenseHomicideContext).toBe(true);
    expect(facts.summaryLines.some((l) => /Accused \/ client: Arjun Mehta/i.test(l))).toBe(true);
  });

  it('personalizes self-defence labels with Arjun Mehta, not Mr A', () => {
    const service = new MatterClarificationService();
    const extracted = extractMatterFacts(ARJUN_MEHTA_CASE);
    const questions = service.buildContextualQuestions(
      ARJUN_MEHTA_CASE,
      {
        practiceArea: 'litigation_disputes',
        subPracticeArea: 'criminal_defence',
        confidence: 0.91,
      } as any,
      {} as any,
      extracted,
    );
    const defenseLabel = questions[0].options?.find((o) => o.value === 'defense_against_homicide')?.label;
    expect(defenseLabel).toBe(
      'Defence / reply — Arjun Mehta may be accused or investigated after the death',
    );
    expect(defenseLabel).not.toMatch(/\bMr A\b/);
    const firLabel = questions[1].options?.find((o) => o.value === 'fir_against_client')?.label;
    expect(firLabel).toBe('FIR already registered against Arjun Mehta');
    const dischargeOpt = questions[0].options?.find((o) => o.value === 'discharge_application');
    expect(dischargeOpt?.label).toContain('Arjun Mehta');
    expect(dischargeOpt?.routes_to).toBe('discharge_application');
  });

  it('returns criminal defence playbook (not civil) for Arjun Mehta case', () => {
    const misclassifiedProfile = {
      practiceArea: 'real_estate_property',
      subPracticeArea: 'specific_performance',
    } as any;
    const bundle = resolveDocumentBundle(misclassifiedProfile, ARJUN_MEHTA_CASE);
    expect(bundle).toBeDefined();
    expect(bundle![0].kind).toBe('india_discharge_application_bnss_250');
    expect(bundle!.some((b) => /legal_notice|civil_plaint|maintenance/i.test(b.kind))).toBe(false);
    expect(
      resolveDocumentBundle(misclassifiedProfile, ARJUN_MEHTA_CASE, {
        selfDefenseHomicide: true,
      })![0].kind,
    ).toBe('india_discharge_application_bnss_250');
    // Profile-only specific_performance must not fire without a real property-sale dispute.
    expect(resolveDocumentBundle(misclassifiedProfile, 'apartment dispute')).toBeUndefined();
  });

  it('excludes civil and maintenance matches for self-defence discharge context', () => {
    const civil = {
      type: 'curated_draft' as const,
      kind: 'india_legal_notice',
      label: 'Legal Notice',
      summary: 'Legal Notice',
      confidence: 0.97,
      href: '/x',
      countryCode: 'IN',
      draftUrl: '/draft',
    };
    const maintenance = {
      type: 'curated_draft' as const,
      kind: 'india_maintenance_application_bnss_144',
      label: 'Maintenance Application (BNSS §144)',
      summary: 'Maintenance',
      confidence: 0.92,
      href: '/y',
      countryCode: 'IN',
      draftUrl: '/draft',
    };
    expect(shouldExcludeDraftIntentMatch(civil, undefined, ARJUN_MEHTA_CASE)).toBe(true);
    expect(shouldExcludeDraftIntentMatch(maintenance, undefined, ARJUN_MEHTA_CASE)).toBe(true);
  });

  it('maps application for discharge to discharge_application draft kind', () => {
    expect(resolveIndiaCourtPleadingKind(ARJUN_MEHTA_CASE)).toBe('discharge_application');
    expect(documentKindToDraftKind('discharge_application', 'IN')).toBe(
      'india_discharge_application_bnss_250',
    );
  });

  it('does not expand wife into matrimonial tokens for self-defence homicide', () => {
    const tokens = expandSearchTokens(ARJUN_MEHTA_CASE);
    expect(tokens).toContain('discharge');
    expect(tokens).not.toContain('matrimonial');
    expect(tokens).not.toContain('molestation');
  });

  it('keeps all three self-defence questions after merge cap', () => {
    const service = new MatterClarificationService();
    const extracted = extractMatterFacts(SELF_DEFENSE_DEATH);
    const contextual = service.buildContextualQuestions(
      SELF_DEFENSE_DEATH,
      {
        practiceArea: 'litigation_disputes',
        subPracticeArea: 'criminal_defence',
        confidence: 0.91,
      } as any,
      {} as any,
      extracted,
    );
    const merged = mergeClarifyingQuestions(contextual, [], []);
    expect(merged.map((q) => q.id)).toEqual([
      'self_defense_goal',
      'self_defense_fir_status',
      'self_defense_custody_stage',
    ]);
  });

  it('routes defence answers away from police_complaint / FIR', () => {
    expect(
      resolveKindFromAnswers({ self_defense_goal: 'defense_against_homicide' }),
    ).toBe('defense_memo');
    expect(resolveKindFromAnswers({ self_defense_goal: 'bail_or_anticipatory' })).toBe(
      'bail_application',
    );
    expect(resolveKindFromAnswers({ self_defense_fir_status: 'fir_against_client' })).toBe(
      'defense_memo',
    );
    expect(resolveKindFromAnswers({ self_defense_goal: 'file_fir_as_survivor' })).toBe(
      'police_complaint',
    );
    expect(resolveKindFromAnswers({ self_defense_goal: 'discharge_application' })).toBe(
      'discharge_application',
    );
  });

  it('upgrades defence goal to discharge when query seeks discharge', () => {
    expect(
      resolveKindFromAnswers(
        { self_defense_goal: 'defense_against_homicide' },
        ARJUN_MEHTA_CASE,
      ),
    ).toBe('discharge_application');
    expect(
      resolveCuratedDraftKindForInjection(
        'discharge_application',
        'IN',
        {
          self_defense_goal: 'discharge_application',
          self_defense_fir_status: 'fir_against_client',
          self_defense_custody_stage: 'in_custody_or_chargesheet',
        },
        ARJUN_MEHTA_CASE,
      ),
    ).toBe('india_discharge_application_bnss_250');
    expect(
      resolveCuratedDraftKindForInjection(
        'defense_memo',
        'IN',
        {
          self_defense_goal: 'defense_against_homicide',
          self_defense_fir_status: 'fir_against_client',
          self_defense_custody_stage: 'in_custody_or_chargesheet',
        },
        ARJUN_MEHTA_CASE,
      ),
    ).toBe('india_discharge_application_bnss_250');
  });

  it('does not route not_sure alone; FIR against attacker yields FIR', () => {
    expect(resolveSelfDefenseKindFromAnswers({ self_defense_goal: 'not_sure' })).toBeUndefined();
    expect(hasActionableClarifyingAnswers({ self_defense_goal: 'not_sure' })).toBe(false);
    expect(
      resolveKindFromAnswers({
        self_defense_goal: 'not_sure',
        self_defense_fir_status: 'fir_against_attacker',
      }),
    ).toBe('police_complaint');
    expect(
      resolveCuratedDraftKindForInjection(
        'police_complaint',
        'IN',
        {
          self_defense_goal: 'not_sure',
          self_defense_fir_status: 'fir_against_attacker',
        },
      ),
    ).toBe('india_fir_complaint');
  });

  it('does not inject Reply to Chargesheet for defence + pre-complaint', () => {
    const answers = {
      self_defense_goal: 'defense_against_homicide',
      self_defense_fir_status: 'no_fir_yet',
      self_defense_custody_stage: 'pre_complaint',
    };
    expect(resolveKindFromAnswers(answers)).toBe('defense_memo');
    expect(resolveCuratedDraftKindForInjection('defense_memo', 'IN', answers)).toBeNull();
  });

  it('injects Reply to Chargesheet when FIR is against the client', () => {
    const answers = {
      self_defense_goal: 'defense_against_homicide',
      self_defense_fir_status: 'fir_against_client',
      self_defense_custody_stage: 'investigation',
    };
    expect(resolveCuratedDraftKindForInjection('defense_memo', 'IN', answers)).toBe(
      'india_reply_to_chargesheet',
    );
  });

  it('routes bail + arrest feared to anticipatory bail draft', () => {
    const answers = {
      self_defense_goal: 'bail_or_anticipatory',
      self_defense_custody_stage: 'arrest_feared',
    };
    expect(resolveKindFromAnswers(answers)).toBe('bail_application');
    expect(resolveCuratedDraftKindForInjection('bail_application', 'IN', answers)).toBe(
      'india_anticipatory_bail_bnss_482',
    );
  });

  it('routes in-custody bail to regular bail draft', () => {
    const answers = {
      self_defense_goal: 'bail_or_anticipatory',
      self_defense_custody_stage: 'in_custody_or_chargesheet',
    };
    expect(resolveCuratedDraftKindForInjection('bail_application', 'IN', answers)).toBe(
      'india_regular_bail_bnss_480',
    );
  });

  it('skips 0.96 injection when answers are only not_sure (partial)', () => {
    expect(hasActionableClarifyingAnswers({ self_defense_goal: 'not_sure' })).toBe(false);
    expect(
      resolveCuratedDraftKindForInjection('defense_memo', 'IN', {
        self_defense_goal: 'not_sure',
      }),
    ).toBeNull();
  });

  it('overrides MI maintenance / family_court profile for Arjun Mehta facts', () => {
    const extracted = extractMatterFacts(ARJUN_MEHTA_CASE);
    expect(extracted.hasChargesheetFiled).toBe(true);
    expect(extracted.seeksDischarge).toBe(true);
    expect(extracted.inferredCustodyStage).toBe('in_custody_or_chargesheet');

    const overridden = applyExtractedProfileOverride(
      {
        practiceArea: 'family_matrimonial',
        subPracticeArea: 'maintenance',
        forum: 'family_court',
        curatedKinds: ['india_maintenance_application_bnss_144'],
        issues: ['Interim maintenance'],
        documentTypes: ['maintenance_application'],
        documentKind: 'maintenance_application',
        confidence: 0.9,
        nature: 'dispute' as const,
        remedies: [],
        country: 'IN',
      },
      extracted,
      ARJUN_MEHTA_CASE,
    );
    expect(overridden.practiceArea).toBe('litigation_disputes');
    expect(overridden.subPracticeArea).toBe('criminal_fir_bail');
    expect(overridden.forum).toBe('sessions_court');
    expect(overridden.curatedKinds[0]).toBe('india_discharge_application_bnss_250');
    expect(overridden.issues[0]).toMatch(/Criminal defence/i);
    expect(overridden.curatedKinds.some((k) => /maintenance/i.test(k))).toBe(false);
  });

  it('routes not_sure + unknown + pre_complaint to discharge when chargesheet in facts', () => {
    const answers = {
      self_defense_goal: 'not_sure',
      self_defense_fir_status: 'unknown',
      self_defense_custody_stage: 'pre_complaint',
    };
    expect(resolveSelfDefenseKindFromAnswers(answers, ARJUN_MEHTA_CASE)).toBe(
      'discharge_application',
    );
    expect(hasActionableClarifyingAnswers(answers, ARJUN_MEHTA_CASE)).toBe(true);

    const bundle = resolveSelfDefenseBundle(
      extractMatterFacts(ARJUN_MEHTA_CASE),
      answers,
      ARJUN_MEHTA_CASE,
    );
    expect(bundle.length).toBeGreaterThan(0);
    expect(bundle[0].kind).toBe('india_discharge_application_bnss_250');
    expect(bundle.some((b) => b.kind === 'india_reply_to_chargesheet')).toBe(true);
  });

  it('ranks discharge + reply + bail for defense_against_homicide + unknown FIR', () => {
    const answers = {
      self_defense_goal: 'defense_against_homicide',
      self_defense_fir_status: 'unknown',
      self_defense_custody_stage: 'pre_complaint',
    };
    expect(resolveKindFromAnswers(answers, ARJUN_MEHTA_CASE)).toBe('discharge_application');
    const playbook = new PlaybookResolverService().resolve({
      extracted: extractMatterFacts(ARJUN_MEHTA_CASE),
      query: ARJUN_MEHTA_CASE,
      answers,
    });
    expect(playbook?.playbookId).toBe('self_defense_homicide');
    expect(playbook?.provisional).toBe(true);
    expect(playbook?.bundle[0].kind).toBe('india_discharge_application_bnss_250');
    expect(playbook?.bundle.some((b) => /bail/i.test(b.kind))).toBe(true);
  });

  it('does not override maintenance revision narratives to criminal defence', () => {
    const maintenanceQuery = `
Wife filed maintenance under BNSS 144. Interim order of ₹25,000 per month.
Husband seeks revision of the interim maintenance order citing earning capacity.
`.trim();
    const extracted = extractMatterFacts(maintenanceQuery);
    expect(extracted.isSelfDefenseHomicideContext).toBe(false);
    expect(extracted.hasMaintenanceContext).toBe(true);

    const profile = applyExtractedProfileOverride(
      {
        practiceArea: 'family_matrimonial',
        subPracticeArea: 'maintenance',
        forum: 'family_court',
        curatedKinds: ['india_maintenance_revision'],
        issues: ['Interim maintenance revision'],
        documentTypes: ['maintenance_order_revision'],
        documentKind: 'maintenance_order_revision',
        confidence: 0.88,
        nature: 'dispute' as const,
        remedies: [],
        country: 'IN',
      },
      extracted,
      maintenanceQuery,
    );
    expect(profile.practiceArea).toBe('family_matrimonial');
    expect(profile.subPracticeArea).toBe('maintenance');
    expect(profile.forum).toBe('family_court');
    expect(resolveDocumentBundle(profile, maintenanceQuery)).toBeUndefined();
  });
});
