import type { JurisdictionForm } from '@prisma/client';
import { resolveDocumentKind, resolveMatterDocumentKind } from '@/config/templates/document-kinds';
import {
  appendDraftUrlParams,
  buildGenerateDraftUrl,
  documentKindToDraftKind,
  expandSearchTokens,
  isExplicitDocumentKind,
  resolveCuratedDraftKindForInjection,
  resolveKindFromAnswers,
  resolveKindFromContext,
  scoreTextMatch,
  listCuratedDraftEntries,
} from '@/ai/draft-intent/draft-intent.helpers';
import { formSearchText } from '@/legal-forms/form-embed-text.util';
import {
  HYBRID_LEXICAL_WEIGHT,
  HYBRID_VECTOR_WEIGHT,
} from '@/legal-forms/legal-forms-search.service';

describe('draft-intent helpers', () => {
  const partnershipQuery =
    'i want to draft a partership agreement between me, Viral Shah of Nairobi kenya, & Garima Jain of Ahmedabad, India, to run Umbrella under G.V. ventures co registered in delaware as a c corp';

  const dvQuery =
    'I was attacked by my husband, I need to draft a complaint about domestic violence';

  it('recognises partnership intent despite partership typo', () => {
    expect(resolveDocumentKind(undefined, partnershipQuery)).toBe('partnership_agreement');
    expect(isExplicitDocumentKind('partnership_agreement', partnershipQuery)).toBe(true);
  });

  it('does not treat generic agreement text as explicit service agreement', () => {
    expect(isExplicitDocumentKind('service_agreement', partnershipQuery)).toBe(false);
  });

  it('maps partnership agreement to india partnership deed for India', () => {
    expect(documentKindToDraftKind('partnership_agreement', 'IN')).toBe('india_partnership_deed');
  });

  it('maps partnership agreement to US draft catalog for Delaware context', () => {
    expect(documentKindToDraftKind('partnership_agreement', 'US')).toBe('us_form_catalog');
  });

  it('never falls back to the US catalog for Kenya', () => {
    expect(documentKindToDraftKind('partnership_agreement', 'KE')).toBe(
      'kenya_form_catalog',
    );
    expect(documentKindToDraftKind('unknown_kenya_document', 'KE')).toBe(
      'kenya_form_catalog',
    );
  });

  it('routes the initial Kenya plaint through generic drafting', () => {
    expect(documentKindToDraftKind('civil_plaint', 'KE')).toBe('kenya_civil_plaint');
    const href = buildGenerateDraftUrl('civil_plaint', 'KE', 'Civil Plaint', {
      details: 'A civil claim in Nairobi',
    });
    expect(href).toContain('/app/document-drafting/use?');
    expect(href).toContain('countryCode=KE');
    expect(href).toContain('documentKind=civil_plaint');
    expect(href).not.toContain('us-drafting');
    expect(href).not.toContain('us_form_catalog');
  });

  it('marks Kenya catalog entries as pending advocate review with authority fields', () => {
    const kenyaEntries = listCuratedDraftEntries().filter(
      (entry) => entry.countryCode === 'KE',
    );
    expect(kenyaEntries).toHaveLength(5);
    expect(kenyaEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'kenya_civil_plaint',
          advocateReviewStatus: 'pending',
          requiredAuthorityFields: expect.arrayContaining([
            'Court and station',
            'Legal basis and enabling provisions',
          ]),
        }),
      ]),
    );
  });

  it('recognises domestic violence complaint as protective injunction', () => {
    expect(resolveDocumentKind(undefined, dvQuery)).toBe('protective_injunction');
    expect(isExplicitDocumentKind('protective_injunction', dvQuery)).toBe(true);
  });

  it('maps protective injunction to india domestic violence petition for IN', () => {
    expect(documentKindToDraftKind('protective_injunction', 'IN')).toBe(
      'india_domestic_violence_petition',
    );
  });

  it('scores C1A domestic violence form highly for attack/husband query', () => {
    const c1a = {
      formName: 'Allegations of Harm and Domestic Violence',
      formNumber: 'C1A',
      authority: 'HM Courts & Tribunals Service',
      description: 'Family court form for allegations of harm and domestic violence',
      practiceArea: 'FAMILY_MATRIMONIAL',
      category: 'Family',
      countryCode: 'GB',
    } as JurisdictionForm;

    const lexical = scoreTextMatch(dvQuery, formSearchText(c1a));
    expect(lexical).toBeGreaterThanOrEqual(0.4);

    const combined =
      HYBRID_VECTOR_WEIGHT * 0.85 + HYBRID_LEXICAL_WEIGHT * lexical;
    expect(combined).toBeGreaterThan(0.55);
  });

  it('expands DV query tokens for lexical catalog search', () => {
    const tokens = expandSearchTokens(dvQuery);
    expect(tokens).toEqual(expect.arrayContaining(['domestic', 'violence', 'harm', 'husband']));
  });

  const ramRiaQuery =
    'Draft an appeal - interim order already received, for a 125 crpc maintenance case Case - ram vs ria Appeal to the high court of Gujarat';

  it('recognises interim maintenance appeal query as maintenance_order_revision', () => {
    expect(resolveDocumentKind(undefined, ramRiaQuery)).toBe('maintenance_order_revision');
    expect(documentKindToDraftKind('maintenance_order_revision', 'IN')).toBe(
      'india_maintenance_order_revision',
    );
  });

  it('recognises final maintenance appeal query', () => {
    const q = 'Appeal against final maintenance order under section 125 crpc Ram vs Ria';
    expect(resolveDocumentKind(undefined, q)).toBe('maintenance_appeal_final');
  });

  it('recognises criminal appeal query', () => {
    expect(resolveDocumentKind(undefined, 'Draft criminal appeal against conviction')).toBe(
      'criminal_appeal',
    );
  });

  it('recognises writ petition query', () => {
    expect(resolveDocumentKind(undefined, 'Writ petition under Article 226 Gujarat HC')).toBe(
      'writ_petition',
    );
  });

  const nehaSharmaQuery =
    'Mrs. Neha Sharma married Mr. Rohit Sharma on 15 February 2024. Draft revision against interim maintenance order before Family Court Ahmedabad. Mr. Rohit Sharma is employed as a Senior Manager at Infosys Technologies Ltd, Bangalore.';

  it('prioritises maintenance revision over incidental employment mention in case narrative', () => {
    expect(resolveDocumentKind(undefined, nehaSharmaQuery)).toBe('maintenance_order_revision');
    expect(isExplicitDocumentKind('maintenance_order_revision', nehaSharmaQuery)).toBe(true);
  });

  const kavitaQuery =
    'Agreement to Sell residential plot. Advance paid. Vendor sold to third party. Wants specific performance and injunction.';

  it('routes agreement-to-sell breach to civil_plaint, not sale agreement template', () => {
    expect(resolveDocumentKind(undefined, kavitaQuery)).toBe('civil_plaint');
  });

  // Stalking / criminal complaint — the original bug scenario
  const stalkingQuery =
    'Mr k and ms s are neighbours. Mr k stalks ms s. Ms s wants to file a complaint against mr k';

  it('recognises stalking complaint as police_complaint, not service_agreement', () => {
    expect(resolveDocumentKind(undefined, stalkingQuery)).toBe('police_complaint');
  });

  it('marks police_complaint as an explicit kind for stalking query', () => {
    expect(isExplicitDocumentKind('police_complaint', stalkingQuery)).toBe(true);
  });

  it('does not resolve stalking query as service_agreement', () => {
    expect(resolveDocumentKind(undefined, stalkingQuery)).not.toBe('service_agreement');
  });

  it('maps police_complaint to india_fir_complaint for IN', () => {
    expect(documentKindToDraftKind('police_complaint', 'IN')).toBe('india_fir_complaint');
  });

  it('does not map police_complaint to india_service_agreement_india for IN', () => {
    expect(documentKindToDraftKind('police_complaint', 'IN')).not.toBe(
      'india_service_agreement_india',
    );
  });

  it('recognises "file a complaint" phrasing as police_complaint', () => {
    expect(resolveDocumentKind(undefined, 'She wants to file a complaint against her neighbour for harassment')).toBe('police_complaint');
  });

  it('recognises "lodge a complaint" phrasing as police_complaint', () => {
    expect(resolveDocumentKind(undefined, 'Client wants to lodge a complaint with the police')).toBe('police_complaint');
  });

  it('uses analyzed context documentKind when no statute-specific rule applies', () => {
    expect(
      resolveKindFromContext(
        { documentKind: 'consumer_complaint' },
        'Buyer paid for a defective laptop and wants refund compensation',
      ),
    ).toBe('consumer_complaint');
  });

  it('keeps maintenance statute routing ahead of analyzed context documentKind', () => {
    expect(
      resolveKindFromContext(
        { statute: 'bnss_144', orderType: 'interim', documentIntent: 'challenge', documentKind: 'civil_plaint' },
        'Challenge interim maintenance order under section 125 CrPC',
      ),
    ).toBe('maintenance_order_revision');
  });

  it('routes explicit document_kind clarifying answer directly', () => {
    expect(resolveKindFromAnswers({ document_kind: 'consumer_complaint' })).toBe(
      'consumer_complaint',
    );
  });

  it('routes india_consumer_complaint clarifying answer (extended catalog slug)', () => {
    expect(resolveKindFromAnswers({ document_kind: 'india_consumer_complaint' })).toBe(
      'india_consumer_complaint',
    );
  });

  it('maps consumer_complaint to india_consumer_complaint for IN', () => {
    expect(documentKindToDraftKind('consumer_complaint', 'IN')).toBe(
      'india_consumer_complaint',
    );
  });

  it('passes through india_consumer_complaint catalog slug as draft kind', () => {
    expect(documentKindToDraftKind('india_consumer_complaint', 'IN')).toBe(
      'india_consumer_complaint',
    );
  });

  it('injects curated consumer complaint for canonical document kind', () => {
    expect(resolveCuratedDraftKindForInjection('consumer_complaint', 'IN')).toBe(
      'india_consumer_complaint',
    );
  });

  it('injects curated consumer complaint for extended catalog slug', () => {
    expect(
      resolveCuratedDraftKindForInjection('india_consumer_complaint', 'IN'),
    ).toBe('india_consumer_complaint');
  });

  it('does not route generic disputing answer to criminal_revision', () => {
    expect(resolveKindFromAnswers({ nature: 'Disputing / challenging (litigation)' })).toBeUndefined();
  });

  it('lets filing text override an incorrect service-agreement MI profile', () => {
    expect(
      resolveMatterDocumentKind(
        {
          documentKind: 'service_agreement',
          practiceArea: 'corporate_commercial',
          nature: 'transaction',
        },
        stalkingQuery,
      ),
    ).toBe('police_complaint');
  });

  it('places party params before details in draft URLs', () => {
    const longDetails = 'x'.repeat(3500);
    const href = appendDraftUrlParams('/app/india-drafting/draft?kind=india_legal_research_memo', {
      details: longDetails,
      clientName: 'Riya Desai',
      opposingParty: 'Sunrise Hospital; Dr. Trivedi',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    });
    const qs = href.split('?')[1] ?? '';
    const clientIdx = qs.indexOf('clientName=');
    const opposingIdx = qs.indexOf('opposingParty=');
    const courtIdx = qs.indexOf('courtName=');
    const detailsIdx = qs.indexOf('details=');
    expect(clientIdx).toBeGreaterThanOrEqual(0);
    expect(opposingIdx).toBeGreaterThanOrEqual(0);
    expect(courtIdx).toBeGreaterThanOrEqual(0);
    expect(detailsIdx).toBeGreaterThanOrEqual(0);
    expect(clientIdx).toBeLessThan(detailsIdx);
    expect(opposingIdx).toBeLessThan(detailsIdx);
    expect(courtIdx).toBeLessThan(detailsIdx);
    expect(href).toContain('clientName=Riya');
  });
});
