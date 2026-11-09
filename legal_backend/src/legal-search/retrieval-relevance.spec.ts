import { assessCandidateRelevance } from './retrieval-relevance';

describe('assessCandidateRelevance', () => {
  it('rejects unrelated official sources for a single-subject employment question', () => {
    const query = 'Under India employment law what is the required notice period for an employee discontinuing work?';
    const result = assessCandidateRelevance({ title: '[2026] 1 SCR 467', citation: null,
      summary: 'The required notice period for appellate proceedings was considered under the applicable procedural law.', fullText: null,
    }, { query, countryCode: 'IN' });
    expect(result.admitted).toBe(false);
    expect(result.rejectionCode).toBe('MISSING_SUBJECT_ANCHOR');
  });

  it('does not use aviation regulations as crypto authority merely because financial terms overlap', () => {
    const result = assessCandidateRelevance({ title: 'Civil Aviation Training Regulations', citation: null,
      summary: 'Current laws and regulatory requirements for fees and financial transactions in Kenya.', fullText: null,
    }, { query: 'What are the current laws and regulatory requirements for cryptocurrency in Kenya?', countryCode: 'KE' });
    expect(result.admitted).toBe(false);
  });

  it('admits candidates matching a planned statute and issue', () => {
    const result = assessCandidateRelevance(
      {
        title: 'Worker v Manufacturing Company',
        citation: '(2023) 4 SCC 20',
        summary:
          'Termination without domestic inquiry violated section 25F of the Industrial Disputes Act.',
        fullText: null,
      },
      {
        query: 'illegal termination remedies',
        legalIssues: ['termination without domestic inquiry'],
        statuteSections: ['Industrial Disputes Act section 25F'],
      },
    );

    expect(result.admitted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.reason).toContain('issue phrase matched');
    expect(result.reason).toContain('statute section matched');
  });

  it('rejects a candidate with no material overlap', () => {
    const result = assessCandidateRelevance(
      {
        title: 'Landlord v Tenant',
        citation: null,
        summary: 'The dispute concerns rent arrears and recovery of possession.',
        fullText: null,
      },
      {
        query: 'anticipatory bail witness intimidation',
        legalIssues: ['custodial interrogation'],
        proceduralPosture: 'bail',
      },
    );

    expect(result.admitted).toBe(false);
    expect(result.reason).toContain('rejected');
  });

  it('requires partnership and arbitration anchors for the reported comparison query', () => {
    const context = {
      query:
        'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
    };
    const adjacent = assessCandidateRelevance(
      {
        title: 'Cheran Properties Ltd. v. Kasturi and Sons Ltd.',
        citation: '(2018) 16 SCC 413',
        summary: 'Non-signatories may be bound to an arbitration agreement in some circumstances.',
        fullText: null,
      },
      context,
    );
    const direct = assessCandidateRelevance(
      {
        title: 'Partner A v. Partner B',
        citation: '(2020) 1 SCC 10',
        summary:
          'The court enforced an arbitration clause governing disputes under a partnership deed.',
        fullText: null,
      },
      context,
    );

    expect(adjacent.admitted).toBe(false);
    expect(adjacent.rejectionCode).toBe('MISSING_SUBJECT_ANCHOR');
    expect(direct.admitted).toBe(true);
  });

  it('admits a hydrated subject-pair judgment despite planner meta-issue mismatch', () => {
    const result = assessCandidateRelevance(
      {
        title: 'A Partner v B Partner',
        citation: '(2021) 3 SCC 100',
        summary: 'Dispute under a partnership deed containing an arbitration clause.',
        fullText:
          'The court held that the partnership dispute was referable to arbitration and allowed appointment of an arbitrator.',
        authorityType: 'CASE',
        sourceTier: 'case_law',
        court: 'Supreme Court of India',
      },
      {
        query:
          'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
        countryCode: 'IN',
        legalIssues: [
          'Which judgments directly address the requested subject?',
          'What supported holding and disposition can be stated?',
        ],
        requestedAuthorityTypes: ['CASE_LAW'],
      },
    );

    expect(result.admitted).toBe(true);
    expect(result.reason).toContain('subject pair and outcome passage matched');
  });

  it('rejects the wrong authority type before ranking', () => {
    const assessment = assessCandidateRelevance(
      {
        title: 'A commentary on arbitration clauses',
        citation: null,
        summary: 'This article discusses arbitration clauses in partnership deeds.',
        fullText: null,
        authorityType: 'ARTICLE',
        sourceTier: 'web',
      },
      {
        query: 'cases enforcing arbitration clauses in partnership deeds',
        requestedAuthorityTypes: ['CASE_LAW', 'BINDING_PRECEDENT'],
      },
    );

    expect(assessment.admitted).toBe(false);
    expect(assessment.rejectionCode).toBe('AUTHORITY_TYPE_MISMATCH');
  });

  it('rejects a foreign court for India-only research', () => {
    const assessment = assessCandidateRelevance(
      {
        title: 'Partner A v Partner B',
        citation: '[2024] EWCA Civ 1',
        summary: 'The court enforced a partnership arbitration clause.',
        fullText: null,
        authorityType: 'CASE',
        sourceTier: 'case_law',
        court: 'Court of Appeal of England and Wales',
      },
      {
        query: 'Indian cases enforcing partnership arbitration clauses',
        countryCode: 'IN',
        requestedAuthorityTypes: ['CASE_LAW'],
      },
    );

    expect(assessment.admitted).toBe(false);
    expect(assessment.rejectionCode).toBe('JURISDICTION_MISMATCH');
  });
});
