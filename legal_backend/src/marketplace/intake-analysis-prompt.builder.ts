import { CountryCompliancePolicy } from '@prisma/client';
import { buildLocalePromptInstruction } from '@/config/locales';
import { getCountryConfig } from '@/config/countries';

export type LeadAnalysisKind = 'SIMILAR_CASES' | 'OPPONENT' | 'STRATEGY';

export interface LeadAnalysisContext {
  issueType: string;
  title: string;
  facts?: string;
  desiredOutcome?: string;
  countryCode: string;
  jurisdiction?: string;
  clientSide?: string;
  lawyerContextMarkdown?: string;
  additionalContext?: string;
  focusPrompt?: string;
  previewExcerpt?: string;
  documentSummaries?: string[];
}

export interface AuthorityRow {
  id: string;
  title: string;
  citation: string | null;
  sourceName: string;
  summary: string | null;
  sourceUrl?: string | null;
  holding?: string | null;
  court?: string | null;
  decisionDate?: Date | null;
  judges?: string[];
}

export interface CaseSummaryBrief {
  parties?: string;
  issues?: string[];
  practiceArea?: string;
  proceduralPosture?: string;
  summaryMarkdown?: string;
  searchQueries?: string[];
}

function appendLocaleInstruction(text: string, locale?: string | null): string {
  const instruction = buildLocalePromptInstruction(locale);
  return instruction ? `${text}\n\n${instruction}` : text;
}

function formatLegalLocation(countryCode: string, jurisdiction?: string): string {
  const country = getCountryConfig(countryCode);
  if (jurisdiction?.trim()) {
    return `${jurisdiction.trim()}, ${country.name}`;
  }
  return country.name;
}

function baseContextBlock(ctx: LeadAnalysisContext): string {
  const legalLocation = formatLegalLocation(ctx.countryCode, ctx.jurisdiction);
  return [
    `Legal location: ${legalLocation}`,
    `Apply the laws and procedures of ${legalLocation} only.`,
    `Issue type: ${ctx.issueType}`,
    `Matter title: ${ctx.title}`,
    ctx.jurisdiction ? `Jurisdiction: ${ctx.jurisdiction}` : '',
    ctx.clientSide ? `Our client side: ${ctx.clientSide}` : '',
    ctx.facts ? `Facts:\n${ctx.facts}` : '',
    ctx.desiredOutcome ? `Desired outcome: ${ctx.desiredOutcome}` : '',
    ctx.previewExcerpt ? `Prior intake analysis excerpt:\n${ctx.previewExcerpt.slice(0, 2000)}` : '',
    ctx.lawyerContextMarkdown
      ? `Counsel notes (firm-private):\n${ctx.lawyerContextMarkdown}`
      : '',
    ctx.additionalContext ? `Additional context for this run:\n${ctx.additionalContext}` : '',
    ctx.focusPrompt ? `Focus for this analysis: ${ctx.focusPrompt}` : '',
    ctx.documentSummaries?.length
      ? `Attached documents:\n${ctx.documentSummaries.join('\n')}`
      : 'Attached documents: none',
  ]
    .filter(Boolean)
    .join('\n');
}

function sharedMarkdownSections(): string {
  return [
    'Provide markdown with sections:',
    '## Executive summary',
    '## Path to victory',
    '## Key risks',
    '## Disclaimer',
  ].join('\n');
}

function markdownRules(): string {
  return [
    '',
    'Output rules:',
    '- Use ## Section title for every major section (do NOT use **Section:** inline only).',
    '- In ## Path to victory, give numbered actionable steps: what to file, prove, avoid, and by when.',
    '- Synthesize facts, counsel notes, documents, and retrieved authorities — not isolated blurbs.',
    '- Use numbered lists for sequential steps; bullets for non-ordered items.',
    '- End with ## Disclaimer section.',
    '- Append a JSON block after the markdown:',
    '```json',
    '{ ... structured fields per analysis type ... }',
    '```',
    '- Do not tell the lawyer to consult a lawyer — they are the lawyer.',
    '- Prefer authorities from the retrieved list; set authorityId when the case or statute is in that list.',
    '- When a relevant statute or provision is NOT in the retrieved list, state the retrieval gap and omit authorityId. Do not cite unstated sources as legal authority.',
    '- Never invent URLs — only use sourceUrl values from the retrieved authority list.',
    '- Never fabricate case names, citations, or party names.',
  ].join('\n');
}

function complianceBlock(policy: CountryCompliancePolicy): string {
  const labels = Array.isArray(policy.approvedProductLabels)
    ? (policy.approvedProductLabels as string[]).join(', ')
    : '';
  return [
    `Compliance (${policy.countryName ?? policy.countryCode}): counsel-oriented analysis only.`,
    labels ? `Approved framing: ${labels}.` : '',
    policy.requireLawyerReviewForAdvice
      ? 'Flag items requiring formal lawyer review before client reliance.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function authorityBlock(authorities: AuthorityRow[]): string {
  if (!authorities.length) {
    return '\nNo specific authorities retrieved. State the authority retrieval gap explicitly and provide only non-authoritative procedural planning that can be verified against primary sources. Do not invent statutes, cases, citations, or URLs.';
  }
  return `\nRetrieved authorities (cite by id; use sourceUrl only from this list):\n${authorities
    .map((row) => {
      const year = row.decisionDate ? new Date(row.decisionDate).getFullYear() : null;
      const parts = [
        `- [${row.id}] ${row.title}`,
        row.citation ? `(${row.citation})` : '',
        row.court ? `Court: ${row.court}` : '',
        year ? `Year: ${year}` : '',
        row.judges?.length ? `Bench: ${row.judges.join(', ')}` : '',
        row.sourceUrl ? `URL: ${row.sourceUrl}` : 'URL: (none)',
        row.holding ? `Holding: ${row.holding.slice(0, 300)}` : '',
        `Summary: ${row.summary ?? row.sourceName}`,
      ];
      return parts.filter(Boolean).join(' — ');
    })
    .join('\n')}`;
}

/** Phase 1 — case summary prompt for two-phase Similar Cases pipeline.
 *  Returns a structured brief used as Phase 2 context and RAG search queries. */
export function buildCaseSummaryPrompt(
  context: LeadAnalysisContext,
  locale?: string | null,
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const legalLocation = formatLegalLocation(context.countryCode, context.jurisdiction);
  return {
    systemPrompt: appendLocaleInstruction(
      [
        `You are a legal analyst preparing a structured case brief for licensed attorneys in ${legalLocation}.`,
        'Analyse the facts and produce a compact JSON brief. No markdown, only valid JSON.',
      ].join('\n'),
      locale,
    ),
    userPrompt: [
      baseContextBlock(context),
      '',
      'Return ONLY valid JSON (no markdown, no explanations):',
      JSON.stringify({
        parties: 'brief description of the parties',
        issues: ['legal issue 1', 'legal issue 2'],
        practiceArea: 'e.g. Employment Law',
        proceduralPosture: 'e.g. Pre-litigation / Trial / Appeal',
        summaryMarkdown: '3-5 sentence factual and legal summary',
        searchQueries: [
          'precise legal search query 1 relevant to jurisdiction',
          'precise legal search query 2',
          'precise legal search query 3',
        ],
      }),
    ].join('\n'),
  };
}

export function buildLeadAnalysisPrompt(input: {
  kind: LeadAnalysisKind;
  context: LeadAnalysisContext;
  authorities?: AuthorityRow[];
  compliancePolicy: CountryCompliancePolicy;
  caseSummary?: CaseSummaryBrief;
  locale?: string | null;
}): { systemPrompt: string; userPrompt: string; reasoningModel?: boolean } {
  const { kind, context, authorities = [], compliancePolicy, caseSummary, locale } = input;
  const legalLocation = formatLegalLocation(context.countryCode, context.jurisdiction);
  const ctxBlock = baseContextBlock(context);
  const compliance = complianceBlock(compliancePolicy);
  const authBlock = authorityBlock(authorities);
  const summaryBlock = caseSummary?.summaryMarkdown
    ? `\n## Case Brief (Phase 1 Summary)\n${caseSummary.summaryMarkdown}\nPractice area: ${caseSummary.practiceArea ?? 'N/A'}\nProcedural posture: ${caseSummary.proceduralPosture ?? 'N/A'}`
    : '';

  if (kind === 'SIMILAR_CASES') {
    return {
      systemPrompt: appendLocaleInstruction(
        [
          `You are a legal research assistant for licensed attorneys conducting intake in ${legalLocation}.`,
          compliance,
          'Analyze similar cases with binding vs persuasive weight. Derive a concrete path to victory for our client from the cases and facts.',
          '',
          'GROUNDING RULE: Prefer the retrieved authorities below. You may add a well-known landmark case ONLY if you are highly confident it is real and you can state its correct citation; otherwise omit it. NEVER fabricate cases, citations, courts, judges, or URLs.',
          'If fewer than 3 reliable cases are available, return the cases you can verify and explicitly note the research gap in the "## Gaps and limitations" section rather than inventing cases to reach a count.',
          '',
          'Citation formatting rules (use the correct format for the jurisdiction):',
          '- India: "PartyA v. PartyB AIR <YYYY> SC <n>" and/or "(<YYYY>) <n> SCC <n>" or "(<YYYY>) <n> SCR <n>"',
          '  High Court: "AIR <YYYY> <StateAbbr> <n>" — e.g. AIR 1980 SC 1789, (1980) 3 SCC 625',
          '- US: "<n> U.S. <n> (<YYYY>)" or "<vol> F.<2d|3d|4th> <n> (<circuit> <YYYY>)"',
          '- Kenya: "[<YYYY>] EALR <n>" or "Civil Case No. <n> of <YYYY>"',
          '- UK: "[<YYYY>] UKSC <n>", "[<YYYY>] EWCA Civ <n>", "[<YYYY>] EWHC <n> (<Division>)"',
          '',
          'If you know the judges/bench for a case from your training data, list their full names.',
          'Extract the single most legally significant verbatim sentence from the judgment for keyQuote.',
          'List the key arguments that the winning party successfully used.',
        ].join('\n'),
        locale,
      ),
      userPrompt: [
        ctxBlock,
        summaryBlock,
        authBlock,
        '',
        sharedMarkdownSections(),
        '## Similar cases analysis',
        '## Binding vs persuasive weight',
        '## Gaps and limitations',
        markdownRules(),
        'JSON must include (always populate all fields):',
        JSON.stringify({
          executiveSummary: '3-5 sentence counsel brief',
          cases: [
            {
              authorityId: 'id from retrieved list',
              title: 'Party A v. Party B',
              citation: 'primary citation string',
              citationFormats: {
                primary: 'e.g. AIR 1980 SC 1789',
                alternative: 'e.g. (1980) 3 SCC 625',
              },
              court: 'e.g. Supreme Court of India',
              year: '1980',
              judges: ['Justice Full Name', 'Justice Full Name'],
              bindingWeight: 'binding | persuasive | influential',
              sourceUrl: 'only from retrieved authority',
              summary: '2-3 sentence case summary',
              outcome: 'e.g. Plaintiff succeeded / Dismissed / Settled',
              favoredSide: 'plaintiff | defendant | neutral',
              relevance: 'why this matters to OUR facts',
              keyQuote: 'Single most important verbatim sentence from the judgment',
              winningArguments: ['Argument 1 that won the case', 'Argument 2'],
              lessonForClient: 'takeaway for winning',
            },
          ],
          pathToVictory: ['top 5 numbered actions to win'],
          winThemes: ['e.g. Strict notice compliance'],
          visualizations: [
            {
              type: 'bar',
              title: 'Case outcomes',
              data: [{ label: 'Won', value: 0 }, { label: 'Lost', value: 0 }, { label: 'Settled', value: 0 }],
            },
          ],
        }),
      ].join('\n'),
    };
  }

  if (kind === 'OPPONENT') {
    return {
      systemPrompt: appendLocaleInstruction(
        [
          `You analyze opponent strategy for licensed attorneys in ${legalLocation}.`,
          compliance,
          'Map likely claims to counters and evidence. End with a clear path to victory.',
          'When the retrieved authorities do not cover a relevant statute or procedural rule, state the retrieval gap and do not cite unstated sources as legal authority. Never fabricate case names or URLs.',
        ].join('\n'),
        locale,
      ),
      userPrompt: [
        ctxBlock,
        authBlock,
        '',
        sharedMarkdownSections(),
        '## Likely opponent claims',
        '## Evidence they may rely on',
        '## Weaknesses in our position',
        '## Counterarguments',
        markdownRules(),
        'JSON must include (always populate all fields):',
        JSON.stringify({
          executiveSummary: '3-5 sentence counsel brief',
          opponentClaims: [
            {
              claim: '',
              likelihood: 75,
              impact: 80,
              counter: '',
              evidenceNeeded: [''],
              authorityId: 'optional id from retrieved list',
            },
          ],
          weaknesses: [{ weakness: '', mitigation: '' }],
          pathToVictory: ['numbered actions to neutralize opponent and win'],
          visualizations: [
            {
              type: 'risk_matrix',
              title: 'Claim risk',
              data: [{ label: 'Claim 1', value: 75 }],
            },
          ],
        }),
      ].join('\n'),
      reasoningModel: true,
    };
  }

  return {
    systemPrompt: appendLocaleInstruction(
      [
        `You draft strategy memos for licensed attorneys in ${legalLocation}.`,
        compliance,
        'Before recommending litigation, always evaluate all five dispute resolution pathways: negotiation, mediation, conciliation, lok adalat (India only), and arbitration.',
        'When the retrieved authorities do not cover a relevant statute or procedural rule, state the retrieval gap and do not cite unstated sources as legal authority. Never fabricate case names or URLs.',
        'Correctly identify binding vs non-binding status: arbitration is legally binding in all jurisdictions; Lok Adalat (India) is binding under the Legal Services Authorities Act, 1987 with no appeal; negotiation, mediation, and conciliation are not legally binding unless converted to a court consent decree.',
        'Present options with risks, deadlines, and evidence. The path to victory is the primary deliverable.',
      ].join('\n'),
      locale,
    ),
    userPrompt: [
      ctxBlock,
      authBlock,
      '',
      sharedMarkdownSections(),
      '## ADR pathways',
      '## Strategic options',
      '## Recommended path',
      '## Deadlines',
      '## Evidence to gather',
      markdownRules(),
      'In ## ADR pathways, assess all five mechanisms (negotiation, mediation, conciliation, lok adalat if India, arbitration) with binding status and applicability to these facts.',
      'In ## Strategic options, include at least one option per applicable ADR pathway before litigation; label each option with its pathwayType and isLegallyBinding.',
      'JSON must include (always populate all fields):',
      JSON.stringify({
        executiveSummary: '3-5 sentence counsel brief',
        shortAnswer: '',
        pathToVictory: ['primary numbered checklist to win'],
        adrPathways: [
          {
            mechanism: 'negotiation',
            isLegallyBinding: false,
            applicable: true,
            rationale: '',
          },
        ],
        options: [
          {
            label: 'A',
            title: '',
            description: '',
            pathwayType: 'negotiation | mediation | conciliation | lok_adalat | arbitration | litigation',
            isLegallyBinding: false,
            feasibilityScore: 0,
            steps: [''],
            risks: [''],
          },
        ],
        recommendedPath: '',
        deadlines: [{ label: '', dateHint: '', action: '' }],
        evidenceToGather: [{ item: '', priority: 'high', why: '' }],
        visualizations: [
          {
            type: 'timeline',
            title: 'Key deadlines',
            data: [{ label: 'Step 1', value: 1 }],
          },
        ],
      }),
    ].join('\n'),
  };
}
