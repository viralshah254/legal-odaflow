import { ResearchRequestNormalizerService } from './research-request-normalizer.service';
import { routeResearchTaskDeterministically } from './research-task-router.service';
import type { ResearchTaskKind } from './research-planning.types';

describe('adaptive research task routing', () => {
  const normalizer = new ResearchRequestNormalizerService();

  const route = (
    query: string,
    options: { facts?: string; requestedTaskKind?: ResearchTaskKind } = {},
  ) =>
    routeResearchTaskDeterministically(
      normalizer.normalize({
        query,
        countryCode: 'IN',
        jurisdiction: 'India',
        desiredOutput: 'ANSWER',
        ...options,
      }),
    );

  it('routes the reported plural discovery question to CASE_SURVEY', () => {
    const profile = route(
      'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
    );

    expect(profile.kind).toBe('CASE_SURVEY');
    expect(profile.archetype).toBe('CASE_SURVEY');
    expect(profile.requiredCapabilities).toEqual(['CASE_LAW']);
    expect(profile.evidenceBundle).toEqual(
      expect.objectContaining({
        minCases: 1,
        targetCases: 3,
        requireTreatment: false,
        requireSimilarCases: false,
        sourceClasses: ['CASE_LAW', 'STATUTES', 'WEB'],
      }),
    );
    expect(profile.publicationPolicy).toEqual(
      expect.objectContaining({
        allowPartialPublication: true,
        allowResearchLeads: true,
        hardAbortOnMissingCases: false,
      }),
    );
  });

  it.each([
    [
      'Show the text of section 11 of the Arbitration and Conciliation Act',
      'SECTION_LOOKUP',
      'STATUTE_TEXT',
    ],
    [
      'What is the meaning and scope of section 11 of the Arbitration and Conciliation Act?',
      'STATUTORY_INTERPRETATION',
      'STATUTE_MEANING',
    ],
    [
      'What procedure and limitation applies to an arbitration petition in the Delhi High Court?',
      'PROCEDURE',
      'PROCEDURE',
    ],
    [
      'What is the current law and latest position on appointment of arbitrators?',
      'CURRENT_LAW',
      'CURRENT_LAW',
    ],
    [
      'Explain the doctrine of separability in arbitration agreements',
      'GENERAL_RESEARCH',
      'DOCTRINE',
    ],
  ])('assigns an adaptive recipe for %s', (query, expectedKind, expectedArchetype) => {
    const profile = route(query);
    expect(profile.kind).toBe(expectedKind);
    expect(profile.archetype).toBe(expectedArchetype);
    expect(profile.answerShape).toBeDefined();
    expect(profile.evidenceBundle).toBeDefined();
    expect(profile.publicationPolicy).toBeDefined();
  });

  it('reserves CASE_COMPARISON for an explicit named-case comparison', () => {
    const profile = route(
      'Compare the facts and holdings in Vidya Drolia v Durga Trading and Booz Allen v SBI Home Finance',
    );
    expect(profile.kind).toBe('CASE_COMPARISON');
    expect(profile.evidenceBundle?.requireTreatment).toBe(true);
    expect(profile.evidenceBundle?.requireSimilarCases).toBe(true);
  });

  it('uses MATTER_OPINION when authorised facts are supplied', () => {
    const profile = route('Assess our prospects under the governing law', {
      facts: 'The authorised matter facts are available.',
    });
    expect(profile.kind).toBe('MATTER_OPINION');
    expect(profile.answerShape?.includeApplication).toBe(true);
  });

  it('routes a structured BNSS bail brief as MATTER_OPINION without requireSimilarCases', () => {
    const profile = route(`Case Type: Criminal Bail Matter
Law: Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)
Provision: Section 480 BNSS — Bail in non-bailable offence
Court: Sessions Court, Ahmedabad
Stage: Accused arrested; regular bail to be filed
Issue: Whether the accused should be granted regular bail considering custody and investigation.`);
    expect(profile.kind).toBe('MATTER_OPINION');
    expect(profile.evidenceBundle?.requireSimilarCases).toBe(false);
  });

  it('does not abort a named BNS/BNSS bail merits query and routes it as MATTER_OPINION', () => {
    const profile = route(
      'Whether Rahul Mehta, accused of offences under Sections 115(2), 352, and 351(2) of the Bharatiya Nyaya Sanhita, 2023, should be granted regular bail under Section 480 of the Bharatiya Nagarik Suraksha Sanhita, 2023, given that investigation is pending and charge-sheet has not been filed?',
    );
    expect(profile.kind).toBe('MATTER_OPINION');
    expect(profile.clarification).toBeUndefined();
    expect(profile.evidenceBundle?.requireSimilarCases).toBe(false);
  });

  it('looks up named BNSS text without asking for scope clarification', () => {
    const profile = route('Show the text of section 480 BNSS');
    expect(profile.kind).toBe('SECTION_LOOKUP');
    expect(profile.clarification).toBeUndefined();
  });

  it('asks for the operative provision when the section is unnamed', () => {
    const profile = route('What does this section mean?');
    expect(profile.kind).toBe('STATUTORY_INTERPRETATION');
    expect(profile.clarification?.missingFields).toEqual(
      expect.arrayContaining(['statute', 'provision']),
    );
  });

  describe('never asks for scope when the request is answerable (all countries)', () => {
    const routeFor = (
      countryCode: string,
      query: string,
      options: { jurisdiction?: string; facts?: string } = {},
    ) =>
      routeResearchTaskDeterministically(
        normalizer.normalize({
          query,
          countryCode,
          desiredOutput: 'ANSWER',
          ...options,
        }),
      );

    it.each([
      ['IN', 'What is the scope of Section 480 of the BNSS?'],
      ['US', 'What is the meaning and scope of 42 U.S.C. § 1983?'],
      ['GB', 'What is the meaning and scope of section 6 of the Human Rights Act 1998?'],
      ['KE', 'What is the scope of Article 47 of the Constitution?'],
    ])('%s: answers a named-provision question', (countryCode, query) => {
      const profile = routeFor(countryCode, query);
      expect(profile.clarification).toBeUndefined();
    });

    it.each([
      ['IN', 'What procedure and limitation applies to filing a revision petition?'],
      ['US', 'What procedure and deadline applies to filing a notice of appeal?'],
      ['GB', 'What procedure and limitation applies to a judicial review claim?'],
      ['KE', 'What procedure and limitation applies to a constitutional petition?'],
    ])('%s: treats the workspace country as a jurisdiction floor for procedure', (countryCode, query) => {
      const profile = routeFor(countryCode, query);
      expect(profile.kind).toBe('PROCEDURE');
      expect(profile.clarification).toBeUndefined();
    });

    it('still asks for scope when there is genuinely nothing to research', () => {
      const profile = routeResearchTaskDeterministically(
        normalizer.normalize({
          query: 'What does this section mean?',
          desiredOutput: 'ANSWER',
        }),
      );
      expect(profile.clarification?.missingFields).toEqual(
        expect.arrayContaining(['statute', 'provision']),
      );
    });
  });

  it('routes a structured TPA / NI brief as MATTER_OPINION without requireSimilarCases', () => {
    const profile = route(`Case Type: Civil tenancy dispute
Law: Transfer of Property Act, 1882
Provision: Section 106
Court: Civil Judge, Ahmedabad
Issue: Whether a premature notice to quit is valid`);
    expect(profile.kind).toBe('MATTER_OPINION');
    expect(profile.evidenceBundle?.requireSimilarCases).toBe(false);
  });
});
