import { repairStructuredJsonSyntax } from './structured-research-synthesis.service';

describe('structured research JSON repair', () => {
  it('removes fences, trailing commas, and invalid control characters locally', () => {
    const repaired = repairStructuredJsonSyntax(
      '```json\n{"shortAnswer":{"text":"yes",},"issues":[\u0001],}\n```',
    );

    expect(JSON.parse(repaired)).toEqual({
      shortAnswer: { text: 'yes' },
      issues: [],
    });
  });
});
import { StructuredResearchSynthesisService } from './structured-research-synthesis.service';
import { LegalEvidencePackService } from './legal-evidence-pack.service';
import { ClaimLevelVerificationService } from './claim-level-verification.service';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { renderDraftToMarkdown } from './legal-research-draft.types';

describe('StructuredResearchSynthesisService', () => {
  const packService = new LegalEvidencePackService();
  const claimVerifier = new ClaimLevelVerificationService(
    new AuthorityIdentityService(),
    new QuotationVerificationService(),
  );

  it('does not publish a new unlinked conclusion in a standalone answer', async () => {
    const pack = packService.buildFromAuthorities({ jurisdiction: 'KE', authorities: [{
      id: 'notice-act', title: 'Employment Act Section 35', sourceName: 'Official publication', sourceTier: 'primary', summary: 'Written notice is required.',
    }] });
    const llm = { complete: jest.fn().mockResolvedValue({ content: JSON.stringify({
      shortAnswer: { text: 'The retrieved text requires written notice.' },
      issues: [{ issueId: 'notice', heading: 'Notice', rule: [{ claimId: 'notice-rule', type: 'RULE', text: 'Written notice is required.', evidenceIds: [pack.statutes[0].evidenceId] }], conclusion: 'The employer can never lose this case.' }],
    }), inputTokens: 1, outputTokens: 1, provider: 'openai', modelName: 'test' }) };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const result = await service.synthesize({ query: 'What notice?', prompt: 'What notice?', systemPrompt: 'Source-bound answer', modelName: 'test', evidencePack: pack, jurisdiction: 'KE', synthesisMode: 'DEEP', conciseAnswer: true });
    expect(llm.complete).toHaveBeenCalledWith(expect.objectContaining({ reasoningEffort: 'medium', minTier: undefined }));
    expect(result.outputMarkdown).not.toContain('The employer can never lose');
    expect(result.outputMarkdown).toContain('Written notice is required.');
  });

  it('supplies relevant earlier case history instead of only nearby signature lines', () => {
    const service = new StructuredResearchSynthesisService({} as never, claimVerifier);
    const pack = { statutes: [], officialMaterials: [], matterFacts: [], authorities: [{ title: 'Public case', court: 'Supreme Court', passages: [
      { evidenceId: 'history', classification: 'LOWER_COURT_FINDING', paragraph: '12', page: 3, text: 'One month salary was paid in lieu of notice; the Court of Appeal found the dismissal unfair.' },
      { evidenceId: 'holding', classification: 'HOLDING', paragraph: '43', page: 20, text: 'The appeal is dismissed.' },
      { evidenceId: 'signature', classification: 'UNKNOWN', page: 20, text: 'DATED and DELIVERED. Signed by the judges.' },
    ] }] };
    const catalog = (service as any).buildEvidenceCatalog(pack, false, 'Notice payment in lieu and unfair dismissal');
    expect(catalog).toContain('history: BACKGROUND/PROCEDURE ONLY');
    expect(catalog).toContain('Court of Appeal found');
    expect(catalog).not.toContain('history: CASE');
  });

  it('checks holdings against admitted reasoning, never signature dates or party submissions', () => {
    const service = new StructuredResearchSynthesisService({} as never, claimVerifier);
    const pack = { statutes: [], officialMaterials: [], matterFacts: [], authorities: [{ evidenceId: 'case', passages: [
      { evidenceId: 'holding', classification: 'HOLDING', admission: { admitted: true } },
      { evidenceId: 'date', classification: 'PROCEDURAL_HISTORY', admission: { admitted: false } },
      { evidenceId: 'submission', classification: 'PARTY_SUBMISSION', admission: { admitted: false } },
    ] }] } as unknown as Parameters<LegalEvidencePackService['build']>[0];
    const draft = { issues: [{ issueId: 'i', propositions: [
      { claimId: 'valid', type: 'HOLDING', text: 'The appeal was dismissed.', evidenceIds: ['holding', 'date', 'submission'] },
      { claimId: 'invalid', type: 'HOLDING', text: 'An unsupported rule.', evidenceIds: ['submission'] },
    ] }] };
    const clean = (service as any).sanitizeDraft(draft, pack);
    expect(clean.issues[0].propositions[0].evidenceIds).toEqual(['holding']);
    // With no admitted reasoning, leave the inadmissible reference for the
    // verifier to reject; do not turn it into an evidence-free assertion.
    expect(clean.issues[0].propositions[1].evidenceIds).toEqual(['submission']);
  });

  it('forces VERIFICATION_UNAVAILABLE when JSON plan parse fails', async () => {
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: '## Memo\n\nBail depends on flight risk. This is prose-only.',
        inputTokens: 10,
        outputTokens: 20,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      }),
    };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'case_1',
          title: 'Bail Case',
          citation: '(2024) 1 SCC 1',
          sourceName: 'Supreme Court',
          sourceTier: 'case_law',
          summary: 'Bail requires flight risk assessment.',
        },
      ],
    });

    const result = await service.synthesize({
      query: 'bail test',
      prompt: 'bail test',
      systemPrompt: 'system',
      modelName: 'test-model',
      evidencePack: pack,
      jurisdiction: 'IN',
      legalDomain: 'CRIMINAL',
      researchIntent: 'PROCEDURE',
    });

    expect(llm.complete.mock.calls[0]?.[0]?.messages[0]?.content).toContain(
      'PROCEDURE CONTRACT',
    );
    expect(result.usedStructuredPlan).toBe(false);
    expect(result.verificationUnavailable).toBe(true);
    expect(result.findings.some((f) => f.checkId === 'system:structured_plan_parse_failed')).toBe(
      true,
    );
    // Answer must never be the empty "could not be formatted" dead-end when prose/evidence exists.
    expect(result.outputMarkdown).toContain('Bail depends on flight risk');
    expect(result.outputMarkdown).not.toMatch(/^Research synthesis could not be formatted/);
  });

  it('salvages an IRAC outline from the pack when JSON and prose are both unusable', async () => {
    const llm = {
      complete: jest
        .fn()
        .mockResolvedValueOnce({
          content: '{not-json',
          inputTokens: 5,
          outputTokens: 5,
          provider: 'openai',
          modelName: 'test',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: '{still-broken',
          inputTokens: 5,
          outputTokens: 5,
          provider: 'openai',
          modelName: 'test',
          finishReason: 'stop',
        }),
    };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'statute_1',
          title: 'Information Technology Act, 2000',
          citation: 'IT Act s.43A',
          sourceName: 'India Code',
          sourceTier: 'primary',
          authorityType: 'STATUTE',
          summary: 'Compensation for failure to protect data.',
        },
      ],
    });

    const result = await service.synthesize({
      query: 'employee AI surveillance dismissal',
      prompt: 'employee AI surveillance dismissal',
      systemPrompt: 'system',
      modelName: 'test-model',
      evidencePack: pack,
      jurisdiction: 'IN',
      synthesisMode: 'DEEP',
      caseLawSearchStatus: 'circuit_open',
    });

    expect(result.verificationUnavailable).toBe(true);
    expect(result.outputMarkdown).toContain('Live case-law search incomplete');
    expect(result.outputMarkdown).toMatch(/Information Technology Act|Rule \(retrieved authorities\)/i);
    expect(result.outputMarkdown).not.toContain('Based on retrieved materials for:');
    expect(result.outputMarkdown).not.toMatch(/^Research synthesis could not be formatted/);
  });

  it('never query-echoes when the evidence pack is empty', async () => {
    const llm = {
      complete: jest
        .fn()
        .mockResolvedValueOnce({
          content: '{not-json',
          inputTokens: 5,
          outputTokens: 5,
          provider: 'openai',
          modelName: 'test',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: '{still-broken',
          inputTokens: 5,
          outputTokens: 5,
          provider: 'openai',
          modelName: 'test',
          finishReason: 'stop',
        }),
    };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'KE',
      authorities: [],
    });

    const result = await service.synthesize({
      query: 'Aisha Kamau fraudulent digital loan CRB Kenya',
      prompt: 'Aisha Kamau fraudulent digital loan CRB Kenya',
      systemPrompt: 'system',
      modelName: 'test-model',
      evidencePack: pack,
      jurisdiction: 'KE',
      synthesisMode: 'DEEP',
      caseLawSearchStatus: 'no_hits',
    });

    expect(result.verificationUnavailable).toBe(true);
    expect(result.outputMarkdown).toMatch(/research gap notice/i);
    expect(result.outputMarkdown).toContain('## Issue');
    expect(result.outputMarkdown).toContain('## Executive answer');
    expect(result.outputMarkdown).toContain('## Table of authorities');
    expect(result.outputMarkdown).not.toContain('Based on retrieved materials for:');
  });

  it('rejects query-echo shortAnswer and keeps Executive/TOA sections on FAST', async () => {
    const query =
      "Here's a strong Kenya-specific test: Aisha Kamau fraudulent digital loan CRB listing";
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          questionPresented: query,
          shortAnswer: { text: query },
          analysisMarkdown: [
            '## Detailed legal analysis',
            '',
            'Issue: Whether CRB listing from a fraudulent digital loan is actionable.',
            'Rule: Data Protection Act and CRB dispute routes require verification.',
            'Application: Map the stated facts to retrieved instruments when available.',
            'Conclusion: Research gap pending primary sources.',
          ].join('\n'),
          verificationNotes: ['Thin pack'],
          followUpQuestions: ['Was ODPC notified?'],
        }),
        inputTokens: 10,
        outputTokens: 20,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      }),
    };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'KE',
      authorities: [
        {
          id: 'ke_1',
          title: 'Data Protection Act',
          citation: 'Act No. 24 of 2019',
          sourceName: 'Kenya Law',
          sourceTier: 'primary',
          authorityType: 'STATUTE',
          summary: 'Personal data processing principles.',
        },
        {
          id: 'unrelated',
          title: 'Publisher translation disclaimer '.repeat(30) + 'Unrelated Case v State',
          citation: 'Unrelated Case (2024)',
          sourceName: 'Court publisher',
          sourceTier: 'primary',
          authorityType: 'CASE',
          summary: 'An unrelated retrieved judgment.',
        },
      ],
    });

    const result = await service.synthesize({
      query,
      prompt: query,
      systemPrompt: 'system',
      modelName: 'test-model',
      evidencePack: pack,
      jurisdiction: 'KE',
      synthesisMode: 'FAST',
    });

    expect(result.outputMarkdown).not.toContain('Publisher translation disclaimer');
    expect(result.outputMarkdown).not.toContain('Unrelated Case');
    expect(result.usedStructuredPlan).toBe(true);
    expect(result.outputMarkdown).toContain('## Short Answer');
    expect(result.outputMarkdown).not.toContain('## Bottom line');
    expect(result.outputMarkdown).toContain('## Table of authorities');
    expect(result.outputMarkdown).toMatch(/Data Protection Act/i);
    expect(result.outputMarkdown).not.toMatch(
      new RegExp(`## Short Answer\\s*\\n\\s*${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
    expect(
      (result.draft?.issues ?? []).every((issue) =>
        (issue.rule ?? []).every((claim) => claim.text !== query),
      ),
    ).toBe(true);
  });

  it('keeps DEEP when pack has authorities (empty pack only forces FAST)', async () => {
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: '{not-valid-json',
        inputTokens: 5,
        outputTokens: 5,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      }),
    };
    // Force two failed parses then salvage
    llm.complete
      .mockResolvedValueOnce({
        content: '{not-valid-json',
        inputTokens: 5,
        outputTokens: 5,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      })
      .mockResolvedValueOnce({
        content: '{still-broken',
        inputTokens: 5,
        outputTokens: 5,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      });
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'statute_it',
          title: 'Information Technology Act, 2000',
          citation: 'IT Act',
          sourceName: 'India Code',
          sourceTier: 'primary',
          authorityType: 'STATUTE',
          summary: 'Computer related offences.',
        },
      ],
    });

    const result = await service.synthesize({
      query: 'unauthorised UPI digital lending CIBIL',
      prompt: 'unauthorised UPI digital lending CIBIL',
      systemPrompt: 'system',
      modelName: 'test-model',
      evidencePack: pack,
      jurisdiction: 'IN',
      synthesisMode: 'DEEP',
    });

    // Salvage path — plan failed — but memo still has required sections from IRAC.
    expect(result.usedStructuredPlan).toBe(false);
    expect(result.outputMarkdown).toContain('## Executive answer');
    expect(result.outputMarkdown).toMatch(/Information Technology Act/i);
    // First LLM call should have used DEEP schema (not forced to FAST solely by thin pack).
    const system = String(llm.complete.mock.calls[0]?.[0]?.messages?.[0]?.content ?? '');
    expect(system).toContain('STRUCTURED RESEARCH OUTPUT');
  });

  it('uses FAST slim schema responseFormat', async () => {
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          questionPresented: 'Bail?',
          shortAnswer: { text: 'Depends on flight risk.' },
          analysisMarkdown:
            'Courts assess flight risk and witness tampering before granting bail under the governing provision.',
          verificationNotes: ['Fast mode — not fully claim-verified.'],
          followUpQuestions: ['What is the alleged offence?'],
        }),
        inputTokens: 10,
        outputTokens: 20,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      }),
    };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [],
    });

    const result = await service.synthesize({
      query: 'bail test',
      prompt: 'bail test',
      systemPrompt: 'system',
      modelName: 'test-model',
      evidencePack: pack,
      jurisdiction: 'IN',
      synthesisMode: 'FAST',
    });

    expect(llm.complete.mock.calls[0]?.[0]?.responseFormat?.type).toBe('json_schema');
    expect(result.usedStructuredPlan).toBe(true);
    expect(result.outputMarkdown).toContain('Depends on flight risk');
    expect(result.outputMarkdown).toContain('flight risk and witness tampering');
    expect(result.outputMarkdown).toContain('## Short Answer');
    expect(result.outputMarkdown).not.toContain('## Bottom line');
    expect(result.draft?.issues ?? []).toEqual([]);
  });

  it('renders markdown from a valid JSON plan', async () => {
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'case_1',
          title: 'Bail Case',
          citation: '(2024) 1 SCC 1',
          sourceName: 'Supreme Court',
          sourceTier: 'case_law',
          summary: 'Bail requires assessing flight risk and witness tampering.',
          fullText: 'Bail requires assessing flight risk and witness tampering.',
          paragraph: '12',
          authorityType: 'case',
          sourcePassages: [
            {
              text: 'Bail requires assessing flight risk and witness tampering.',
              paragraph: '12',
              sourcePinpoint: true,
              classification: 'HOLDING',
            },
          ],
          sourceProvenance: {
            provider: 'Supreme Court',
            retrievedAt: '2026-07-28T00:00:00.000Z',
            documentHash: 'fixture-hash',
            completeness: 'COMPLETE',
            extractionMethod: 'NATIVE_TEXT',
            authoritativeStatus: 'OFFICIAL',
          },
        },
      ],
      matterFacts: [{ factId: 'fact_1', description: 'Accused has roots in the community.' }],
    });
    const evidenceId = pack.authorities[0]?.passages[0]?.evidenceId;
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          questionPresented: 'Whether bail should be granted on the stated facts.',
          shortAnswer: { text: 'Bail is likely because the stated facts indicate low flight risk.', confidence: 0.8 },
          legalFramework: [
            {
              evidenceId,
              authorityType: 'CASE',
              claimIds: ['r1'],
            },
          ],
          issues: [
            {
              issueId: 'i1',
              heading: 'Bail',
              conclusion: {
                text: 'Bail is moderately likely, subject to the court assessing flight risk.',
                confidence: 0.75,
                strength: 'MODERATE',
                controllingReasons: ['Community roots reduce flight risk.'],
                factualDependencies: ['Criminal antecedents and witness access.'],
                adverseConsiderations: ['The prosecution may allege witness tampering.'],
              },
              rule: [
                {
                  claimId: 'r1',
                  text: 'Bail requires assessing flight risk and witness tampering.',
                  type: 'HOLDING',
                  evidenceIds: evidenceId ? [evidenceId] : [],
                  confidence: 0.8,
                },
              ],
              application: [
                {
                  claimId: 'a1',
                  text: 'On these facts, flight risk appears low.',
                  type: 'APPLICATION',
                  evidenceIds: [],
                  factIds: ['fact_1'],
                  basedOnClaimIds: ['r1'],
                  confidence: 0.7,
                },
              ],
            },
          ],
          risksAndDefences: [
            { risk: 'The prosecution may allege witness tampering.', defence: 'Offer conditions.' },
          ],
          practicalSteps: [
            {
              id: 'step_prepare_bail_application',
              action: 'Prepare a bail application for lawyer review.',
              timing: 'After confirming the correct forum and custody status',
              purpose: 'Present the verified bail factors and proposed conditions.',
              evidenceNeeded: ['Address proof', 'custody order'],
              dependsOnQuestionIds: ['question_antecedents'],
              safeActionType: 'PREPARE_DRAFT',
              condition: 'File only after counsel verifies forum, provision, and current facts.',
            },
          ],
          authoritiesReliedOn: [{ evidenceId, claimIds: ['r1'] }],
          unansweredQuestions: [
            {
              id: 'question_antecedents',
              question: 'Does the accused have criminal antecedents?',
              whyItMatters: 'Antecedents materially affect risk and conditions.',
              expectedAnswerType: 'YES_NO',
              affectedIssueId: 'i1',
              suggestedSource: 'Police and court records',
            },
          ],
          verificationNotes: ['Current-law treatment should be checked before filing.'],
          followUpQuestions: ['What about antecedents?'],
        }),
        inputTokens: 10,
        outputTokens: 40,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      }),
    };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);
    const result = await service.synthesize({
      query: 'bail',
      prompt: 'bail',
      systemPrompt: 'system',
      modelName: 'test',
      evidencePack: pack,
      jurisdiction: 'IN',
    });

    expect(result.usedStructuredPlan).toBe(true);
    expect(result.outputMarkdown).toContain('Question Presented');
    expect(result.outputMarkdown).toContain('Short Answer');
    expect(result.outputMarkdown).toContain('### Rule');
    expect(result.outputMarkdown).toContain('### Application');
    expect(result.outputMarkdown).toContain('Risks and Defences');
    expect(result.outputMarkdown).toContain('Authorities Relied On');
    expect(result.outputMarkdown).toContain('Appendix: Verification Notes');
    expect(result.draft?.directAnswer).toEqual(result.draft?.shortAnswer);
    expect(result.draft?.issues[0]?.propositions).toHaveLength(2);
    expect(result.suggestedFollowUpQuestions?.[0]).toContain('antecedents');
    expect(
      result.findings.filter(
        (finding) => finding.checkId.startsWith('quality:') && finding.severity === 'BLOCKER',
      ),
    ).toHaveLength(0);
    expect(result.outputMarkdown).toContain('step_prepare_bail_application');
    expect(result.outputMarkdown).toContain('question_antecedents');
  });

  it('retains visibly labeled general principles when authority coverage is thin', async () => {
    const pack = packService.buildFromAuthorities({ jurisdiction: 'IN', authorities: [] });
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          directAnswer: { text: 'A full employment-law authority set was not retrieved.', confidence: 0.3 },
          issues: [{
            issueId: 'i1',
            heading: 'Termination framework',
            conclusion: 'The employment terms and applicable local statute require review.',
            propositions: [{
              claimId: 'gp1',
              text: 'The employment contract, policy documents, and forum rules should be examined.',
              type: 'GENERAL_PRINCIPLE',
              evidenceIds: [],
              confidence: 0.3,
            }],
          }],
          practicalSteps: ['Retrieve the applicable employment statutes and employment contract.'],
          limitations: ['No employment authorities were retrieved.'],
          unansweredQuestions: ['Was the employee a workman?'],
        }),
        inputTokens: 10,
        outputTokens: 40,
        provider: 'openai',
        modelName: 'test',
        finishReason: 'stop',
      }),
    };
    const service = new StructuredResearchSynthesisService(llm as never, claimVerifier);

    const result = await service.synthesize({
      query: 'wrongful termination',
      prompt: 'wrongful termination',
      systemPrompt: 'system',
      modelName: 'test',
      evidencePack: pack,
      jurisdiction: 'IN',
    });

    expect(result.outputMarkdown).toContain('Appendix: Verification Notes');
    expect(result.outputMarkdown).toContain(
      'General principle not verified against retrieved sources',
    );
    expect(result.outputMarkdown).toContain('Practical Steps');
  });

  it('preserves provisional claims for the final semantic audit instead of deleting them early', async () => {
    const claim = { claimId: 'resignation', text: 'Voluntary resignation is distinct from employer retrenchment.', type: 'RULE', evidenceIds: [], confidence: 0.8 };
    const provisional = { verify: jest.fn().mockReturnValue({ claimAudits: [{ claimId: claim.claimId, action: 'REMOVE' }], findings: [], publicationState: 'DRAFT_NOT_VERIFIED' }) };
    const llm = { complete: jest.fn().mockResolvedValue({ content: JSON.stringify({ questionPresented: 'Employee resignation', shortAnswer: { text: 'The governing employment instrument must be checked.' }, issues: [{ issueId: 'notice', heading: 'Resignation', conclusion: 'Confirm the applicable notice clause.', propositions: [claim] }], limitations: [], verificationNotes: [] }), inputTokens: 10, outputTokens: 20, provider: 'openai', modelName: 'test', finishReason: 'stop' }) };
    const service = new StructuredResearchSynthesisService(llm as never, provisional as never);
    const result = await service.synthesize({ query: 'What notice applies to employee resignation?', prompt: 'Resignation notice', systemPrompt: 'system', modelName: 'test', jurisdiction: 'IN', evidencePack: packService.buildFromAuthorities({ jurisdiction: 'IN', authorities: [] }) });
    expect(result.draft?.issues.flatMap(issue => issue.propositions).some(item => item.claimId === claim.claimId)).toBe(true);
    expect(result.claimVerification?.claimAudits[0].action).toBe('REMOVE');
  });

  it('renders statutes before cases and confines caveats to the appendix', () => {
    const markdown = renderDraftToMarkdown(
      {
        questionPresented: 'Which law governs?',
        shortAnswer: { text: 'The statute governs, as construed by the case.', confidence: 0.8 },
        directAnswer: { text: 'The statute governs, as construed by the case.', confidence: 0.8 },
        legalFramework: [
          { evidenceId: 'case_1', authorityType: 'CASE', claimIds: ['rule_1'] },
          { evidenceId: 'statute_1', authorityType: 'STATUTE', claimIds: ['rule_1'] },
        ],
        issues: [
          {
            issueId: 'issue_1',
            heading: 'Governing rule',
            conclusion: 'The statutory test applies.',
            propositions: [
              {
                claimId: 'rule_1',
                text: 'The statutory test controls.',
                type: 'RULE',
                evidenceIds: ['statute_1'],
                confidence: 0.8,
              },
            ],
          },
        ],
        risksAndDefences: [],
        practicalSteps: [],
        authoritiesReliedOn: [],
        limitations: ['Current-law treatment remains to be checked.'],
        unansweredQuestions: [],
        verificationNotes: [],
      },
      new Map([
        ['case_1', 'Example Case'],
        ['statute_1', 'Example Act s.1'],
      ]),
    );

    expect(markdown.indexOf('Example Act s.1')).toBeLessThan(markdown.indexOf('Example Case'));
    expect(markdown.indexOf('Current-law treatment')).toBeGreaterThan(
      markdown.indexOf('Appendix: Verification Notes'),
    );
  });
});
