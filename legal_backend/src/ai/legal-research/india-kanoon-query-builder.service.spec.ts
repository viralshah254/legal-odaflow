import { IndiaKanoonQueryBuilderService } from './india-kanoon-query-builder.service';
import type { LegalDomain } from './legal-research-classifier.service';

describe('IndiaKanoonQueryBuilderService', () => {
  const builder = new IndiaKanoonQueryBuilderService();

  it('builds doctypes:judgments query for medical negligence', () => {
    const plan = builder.build({
      query:
        'Patient underwent laparoscopic cholecystectomy. Medical negligence and deficiency in service under Consumer Protection Act.',
      jurisdiction: 'Delhi',
    });
    expect(plan.caseLawQuery).toContain('doctypes:judgments');
    expect(plan.caseLawQuery).toMatch(/ORR/);
    expect(plan.bindingQuery).toContain('doctypes:supremecourt');
    expect(plan.jurisdictionQuery).toContain('doctypes:delhi');
  });

  it('normalizes High Court names and additional state routes', () => {
    const delhi = builder.build({
      query: 'arbitration appointment cases',
      jurisdiction: 'Delhi High Court',
    });
    const andhra = builder.build({
      query: 'arbitration appointment cases',
      jurisdiction: 'High Court of Andhra Pradesh',
    });

    expect(delhi.jurisdictionQuery).toContain('doctypes:delhi');
    expect(andhra.jurisdictionQuery).toContain('doctypes:andhra');
  });

  it('builds bail queries with IK syntax', () => {
    const plan = builder.build({
      query: 'BNS 351 intimidation anticipatory bail flight risk',
      jurisdiction: 'Karnataka',
    });
    expect(plan.caseLawQuery).toContain('doctypes:judgments');
    expect(plan.statuteQuery).toContain('doctypes:laws');
  });

  it('formats gap queries for binding authority', () => {
    const q = builder.formatGapQuery('cheque dishonour NI Act', 'BINDING_AUTHORITY');
    expect(q).toContain('doctypes:supremecourt');
  });

  it('anchors employment research to labour statutes and case law', () => {
    const plan = builder.build({
      query: 'wrongful termination, workplace harassment, and unpaid incentives',
      jurisdiction: 'Bengaluru',
      legalDomain: 'EMPLOYMENT' as LegalDomain,
    });

    expect(plan.statuteQuery).toContain('Industrial Disputes Act');
    expect(plan.allQueries.join('\n')).toContain('POSH Act 2013');
    expect(plan.allQueries.join('\n')).toContain('doctypes:judgments');
  });

  it('prioritises planner-derived issues, sections, doctrines, and posture', () => {
    const plan = builder.build({
      query: 'Advise on the pending application',
      legalIssues: ['Whether termination without domestic inquiry is illegal'],
      statuteSections: ['Industrial Disputes Act section 25F'],
      doctrines: ['principles of natural justice'],
      proceduralPosture: 'appeal',
    });

    expect(plan.caseLawQuery).toContain(
      '"Whether termination without domestic inquiry is illegal"',
    );
    expect(plan.allQueries.join('\n')).toContain('"Industrial Disputes Act section 25F"');
    expect(plan.allQueries.join('\n')).toContain('"principles of natural justice" "appeal"');
  });

  it('uses proposition and issue phrases for fragment retrieval', () => {
    expect(
      builder.fragmentQuery('generic background facts', {
        propositionPhrases: ['bail denied because witnesses may be intimidated'],
        legalIssues: ['flight risk assessment'],
      }),
    ).toBe('bail denied because witnesses may be intimidated flight risk assessment');
  });

  it('plans decomposed issues, entities, remedies, and requested authority types', () => {
    const plan = builder.build({
      query: 'Research remedies against the firm',
      legalDomain: 'ARBITRATION',
      entities: [{ text: 'partnership agreement', type: 'LEGAL_RELATIONSHIP' }],
      remedies: ['interim injunction'],
      requestedAuthorityTypes: ['ADVERSE_AUTHORITY', 'STATUTE'],
      issueDecomposition: [
        {
          issue: 'validity of arbitration clause',
          subIssues: ['non-arbitrability of partnership dissolution'],
        },
      ],
    });
    const queries = plan.allQueries.join('\n');

    expect(queries).toContain('"validity of arbitration clause"');
    expect(queries).toContain('"non-arbitrability of partnership dissolution"');
    expect(queries).toContain('"partnership agreement" "interim injunction"');
    expect(queries).toContain('overruled ORR distinguished doctypes:judgments');
    expect(queries).toContain('doctypes:laws');
    expect(queries).toContain('"Indian Partnership Act" arbitration');
  });

  it('keeps partnership and arbitration together while removing research meta terms', () => {
    const plan = builder.build({
      query:
        'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
      legalDomain: 'ARBITRATION',
    });
    const queries = plan.allQueries.join('\n');

    expect(plan.caseLawQuery).toContain('arbitration');
    expect(plan.caseLawQuery).toContain('partnership');
    expect(plan.caseLawQuery).not.toMatch(/\bsimilar\b|\boutcomes\b|\bindian law\b/i);
    expect(plan.allQueries.slice(0, 2)).toEqual([
      '"partnership deed" "arbitration clause" doctypes:judgments',
      '"partnership agreement" "arbitration agreement" doctypes:judgments',
    ]);
    expect(queries).toContain('"partnership deed" "arbitration clause"');
    expect(queries).toContain('"Indian Partnership Act" arbitration');
  });

  it('builds ordered relaxation tiers for partnership arbitration comparison queries', () => {
    const tiers = builder.buildRelaxationTiers({
      query:
        'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
      legalDomain: 'ARBITRATION',
      countryCode: 'IN',
    });

    expect(tiers.map((tier) => tier.tier)).toEqual([
      'exact',
      'subject_pair',
      'doctrine_statute',
      'court_specific',
      'broad_fallback',
    ]);
    expect(tiers[1]?.queries.join('\n')).toContain('partnership deed');
    expect(tiers[2]?.queries.join('\n')).toMatch(/section 69|section 11/i);
  });

  it('adds digital-lending / CIBIL / DPDP doctypes queries for fraudulent loan facts', () => {
    const plan = builder.build({
      query:
        'Riya Mehta fraudulent digital loan CIBIL score damaged unauthorised UPI India',
      countryCode: 'IN',
    });
    const blob = plan.allQueries.join('\n');
    expect(plan.statuteQuery).toMatch(/Consumer Protection Act/i);
    expect(blob).toMatch(/doctypes:judgments/);
    expect(blob).toMatch(/CIBIL|digital lending/i);
    expect(blob).toMatch(/DPDP|Digital Personal Data Protection/i);
    expect(blob).toMatch(/doctypes:laws/);
  });
});
