import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type {
  CandidateAuthority,
  CandidateDoctrine,
  CandidateRoute,
  LegalIssueMapEntry,
  ResearchIntelligenceMap,
  ResearchQueryPlan,
} from './research-intelligence-map.types';

const AUTHORITY_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: {
      type: 'string',
      enum: ['statute', 'regulation', 'case', 'regulator', 'doctrine', 'secondary'],
    },
    title: { type: 'string' },
    citation: { type: ['string', 'null'] },
    court: { type: ['string', 'null'] },
    proposition: { type: ['string', 'null'] },
    searchHints: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    note: { type: ['string', 'null'] },
  },
  required: [
    'kind',
    'title',
    'citation',
    'court',
    'proposition',
    'searchHints',
    'confidence',
    'note',
  ],
} as const;

const QUERY_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    query: { type: 'string' },
    purpose: {
      type: 'string',
      enum: [
        'statute',
        'case',
        'regulation',
        'regulator',
        'procedure',
        'contrary',
        'current_law',
        'general',
      ],
    },
    issueIds: { type: 'array', items: { type: 'string' } },
    priority: { type: 'number' },
  },
  required: ['id', 'query', 'purpose', 'issueIds', 'priority'],
} as const;

const MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    jurisdiction: { type: 'array', items: { type: 'string' } },
    jurisdictionConfidence: { type: 'number' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          kind: {
            type: 'string',
            enum: [
              'substantive',
              'procedural',
              'evidentiary',
              'remedy',
              'limitation',
              'forum',
              'interim',
              'other',
            ],
          },
          priority: { type: 'number' },
        },
        required: ['id', 'label', 'kind', 'priority'],
      },
    },
    likelyDoctrines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          proposition: { type: ['string', 'null'] },
          searchHints: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'proposition', 'searchHints'],
      },
    },
    likelyStatutes: { type: 'array', items: AUTHORITY_ITEM_SCHEMA },
    likelyRegulations: { type: 'array', items: AUTHORITY_ITEM_SCHEMA },
    likelyCases: { type: 'array', items: AUTHORITY_ITEM_SCHEMA },
    likelyProceduralRoutes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          forum: { type: 'string' },
          procedure: { type: ['string', 'null'] },
          relief: { type: ['string', 'null'] },
          searchHints: { type: 'array', items: { type: 'string' } },
        },
        required: ['forum', 'procedure', 'relief', 'searchHints'],
      },
    },
    likelyRegulators: { type: 'array', items: AUTHORITY_ITEM_SCHEMA },
    terminology: { type: 'array', items: { type: 'string' } },
    alternateTerminology: { type: 'array', items: { type: 'string' } },
    unresolvedQuestions: { type: 'array', items: { type: 'string' } },
    researchQueries: { type: 'array', items: QUERY_ITEM_SCHEMA },
    contraryAuthorityQueries: { type: 'array', items: QUERY_ITEM_SCHEMA },
  },
  required: [
    'jurisdiction',
    'jurisdictionConfidence',
    'issues',
    'likelyDoctrines',
    'likelyStatutes',
    'likelyRegulations',
    'likelyCases',
    'likelyProceduralRoutes',
    'likelyRegulators',
    'terminology',
    'alternateTerminology',
    'unresolvedQuestions',
    'researchQueries',
    'contraryAuthorityQueries',
  ],
} as const;

function toCandidate(
  raw: {
    kind?: CandidateAuthority['kind'];
    title: string;
    citation?: string | null;
    court?: string | null;
    proposition?: string | null;
    searchHints?: string[];
    confidence?: 'high' | 'medium' | 'low';
    note?: string | null;
  },
  fallbackKind: CandidateAuthority['kind'],
  index: number,
  prefix: string,
): CandidateAuthority {
  return {
    id: `${prefix}-${index + 1}`,
    kind: raw.kind ?? fallbackKind,
    title: raw.title,
    citation: raw.citation ?? null,
    court: raw.court ?? null,
    proposition: raw.proposition ?? null,
    searchHints: (raw.searchHints ?? []).filter(Boolean).slice(0, 6),
    origin: 'MODEL_KNOWLEDGE',
    verificationStatus: 'CANDIDATE',
    confidence: raw.confidence ?? 'medium',
    note: raw.note ?? null,
  };
}

@Injectable()
export class ResearchIntelligenceMapService {
  private readonly logger = new Logger(ResearchIntelligenceMapService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly config: ConfigService,
  ) {}

  async buildMap(input: {
    query: string;
    countryCode: string;
    jurisdiction?: string;
    legalDomain?: string;
    practiceArea?: string;
    asOfDate?: string;
    /** Bounded planning mode; candidates still require retrieval and verification. */
    planningMode?: 'draft';
  }): Promise<ResearchIntelligenceMap> {
    const modelName =
      input.planningMode === 'draft'
        ? this.config.get<string>('AI_LEGAL_STANDARD_MODEL', 'gpt-5.6-terra') ?? 'gpt-5.6-terra'
        : this.config.get<string>('AI_LEGAL_COMPLEX_MODEL', 'gpt-5.6-sol') ?? 'gpt-5.6-sol';

    const system = [
      'You are the AI research intelligence layer for a global legal research engine.',
      'Produce a Research Intelligence Map — research HYPOTHESES, not verified law.',
      'Use your trained legal knowledge aggressively to identify doctrines, statutes, regulations, landmark cases, regulators, procedural routes, terminology, and targeted search queries.',
      'Do NOT write the final client memo. Do NOT invent precise reporter volume/page numbers; prefer null citation + strong searchHints when unsure.',
      'Jurisdiction-aware: tailor candidates to the stated country/jurisdiction (IN, US, KE, GB, CA, AU, EU, UG, etc.).',
      'For India identity-theft / fraudulent-loan / CIBIL / digital-lending / unauthorised UPI facts, include candidates for: IT Act / BNS cheating & identity offences, Consumer Protection Act 2019, RBI Digital Lending Directions / fair practices / ombudsman, DPDP Act 2023 where personal data is processed, Credit Information Companies (Regulation) Act / CIBIL dispute routes, BSA electronic evidence, NI Act only if cheques, BNSS/CrPC if criminal complaint, civil declaration/injunction, cybercrime reporting.',
      'For India landlord–tenant / premature vacate / notice-to-quit facts, include Transfer of Property Act ss.105–111 (especially s.106), Specific Relief Act ss.34/38/39, CPC s.9 and O.39 injunctions, Contract Act ss.37/73. Treat Article 21 / Olga Tellis as non-controlling unless the landlord is the State. Do not lead with constitutional eviction cases for a private lease.',
      'For Kenya fraudulent digital loan / CRB / mobile-lending facts, include candidates for: Data Protection Act, Credit Reference Bureau listing disputes, CBK/DCP digital credit provider rules, Evidence Act electronic records, Consumer Protection Act (Kenya), Penal Code fraud/identity offences, High Court / magistrate civil remedies.',
      'India candidates must be Indian instruments (IK / India Code / RBI / e-SCR searchable). Kenya candidates must be Kenyan (kenyalaw.org). Never cross-contaminate jurisdictions.',
      'Generate issue-specific researchQueries (not one giant query) and contraryAuthorityQueries.',
      'Return ONLY JSON matching the schema.',
    ].join(' ');

    const user = [
      `Country: ${input.countryCode}`,
      input.jurisdiction ? `Jurisdiction: ${input.jurisdiction}` : '',
      input.legalDomain ? `Legal domain hint: ${input.legalDomain}` : '',
      input.practiceArea ? `Practice area: ${input.practiceArea}` : '',
      input.asOfDate ? `Law as of: ${input.asOfDate}` : '',
      `Research question:\n${input.query}`,
      'Limits: up to 10 issues, 8 statutes, 6 regulations, 8 cases, 5 regulators, 6 doctrines, 12 researchQueries, 6 contrary queries.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.llm.complete({
        modelName,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'research_intelligence_map',
            strict: true,
            schema: MAP_SCHEMA as unknown as Record<string, unknown>,
          },
        },
        maxTokens: 3500,
        reasoningEffort: input.planningMode === 'draft' ? 'low' : 'high',
        ...(input.planningMode === 'draft' ? { timeoutMs: 15_000 } : {}),
      });

      const parsed = JSON.parse(result.content) as {
        jurisdiction?: string[];
        jurisdictionConfidence?: number;
        issues?: LegalIssueMapEntry[];
        likelyDoctrines?: CandidateDoctrine[];
        likelyStatutes?: Array<Parameters<typeof toCandidate>[0]>;
        likelyRegulations?: Array<Parameters<typeof toCandidate>[0]>;
        likelyCases?: Array<Parameters<typeof toCandidate>[0]>;
        likelyProceduralRoutes?: CandidateRoute[];
        likelyRegulators?: Array<Parameters<typeof toCandidate>[0]>;
        terminology?: string[];
        alternateTerminology?: string[];
        unresolvedQuestions?: string[];
        researchQueries?: ResearchQueryPlan[];
        contraryAuthorityQueries?: ResearchQueryPlan[];
      };

      return {
        version: 1,
        modelName: result.modelName,
        degraded: false,
        jurisdiction:
          parsed.jurisdiction?.length ? parsed.jurisdiction : [input.countryCode],
        jurisdictionConfidence: Math.max(
          0,
          Math.min(1, Number(parsed.jurisdictionConfidence ?? 0.7)),
        ),
        issues: (parsed.issues ?? []).slice(0, 10),
        likelyDoctrines: (parsed.likelyDoctrines ?? []).slice(0, 6),
        likelyStatutes: (parsed.likelyStatutes ?? [])
          .slice(0, 8)
          .map((a, i) => toCandidate(a, 'statute', i, 'statute')),
        likelyRegulations: (parsed.likelyRegulations ?? [])
          .slice(0, 6)
          .map((a, i) => toCandidate(a, 'regulation', i, 'reg')),
        likelyCases: (parsed.likelyCases ?? [])
          .slice(0, 8)
          .map((a, i) => toCandidate(a, 'case', i, 'case')),
        likelyProceduralRoutes: (parsed.likelyProceduralRoutes ?? []).slice(0, 6),
        likelyRegulators: (parsed.likelyRegulators ?? [])
          .slice(0, 5)
          .map((a, i) => toCandidate(a, 'regulator', i, 'regulator')),
        terminology: (parsed.terminology ?? []).slice(0, 20),
        alternateTerminology: (parsed.alternateTerminology ?? []).slice(0, 20),
        unresolvedQuestions: (parsed.unresolvedQuestions ?? []).slice(0, 10),
        researchQueries: (parsed.researchQueries ?? []).slice(0, 12),
        contraryAuthorityQueries: (parsed.contraryAuthorityQueries ?? []).slice(0, 6),
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Research intelligence map failed on ${modelName}: ${message}`);
      return this.fallbackMap(input, modelName, message);
    }
  }

  /** Deterministic fallback when the LLM map fails — still drives useful searches. */
  fallbackMap(
    input: {
      query: string;
      countryCode: string;
      jurisdiction?: string;
      legalDomain?: string;
    },
    modelName: string,
    reason: string,
  ): ResearchIntelligenceMap {
    const cc = input.countryCode.toUpperCase();
    const q = input.query;
    const issues: LegalIssueMapEntry[] = [
      { id: 'issue-1', label: 'Governing law and liability', kind: 'substantive', priority: 1 },
      { id: 'issue-2', label: 'Forum and procedure', kind: 'forum', priority: 2 },
      { id: 'issue-3', label: 'Remedies and interim relief', kind: 'remedy', priority: 3 },
    ];
    const researchQueries: ResearchQueryPlan[] = [
      {
        id: 'q-1',
        query: q,
        purpose: 'general',
        issueIds: ['issue-1'],
        priority: 1,
      },
      {
        id: 'q-2',
        query: `${q} case law ${cc}`,
        purpose: 'case',
        issueIds: ['issue-1'],
        priority: 2,
      },
      {
        id: 'q-3',
        query: `${q} statute regulation ${cc}`,
        purpose: 'statute',
        issueIds: ['issue-1'],
        priority: 3,
      },
    ];

    let likelyStatutes: CandidateAuthority[] = [];
    let likelyRegulations: CandidateAuthority[] = [];
    let likelyRegulators: CandidateAuthority[] = [];
    let likelyProceduralRoutes: CandidateRoute[] = [];

    if (cc === 'IN' && /\b(cibil|credit|loan|fraud|rbi|upi|digital.?lend|dpdp)\b/i.test(q)) {
      researchQueries.push(
        {
          id: 'q-rbi',
          query:
            'RBI digital lending guidelines fair practices code ombudsman unauthorised loan CIBIL India',
          purpose: 'regulation',
          issueIds: ['issue-1'],
          priority: 1,
        },
        {
          id: 'q-cpa',
          query: 'Consumer Protection Act 2019 deficiency in service unfair trade practice loan app India',
          purpose: 'statute',
          issueIds: ['issue-2'],
          priority: 2,
        },
        {
          id: 'q-it',
          query: 'IT Act identity theft fraudulent loan cyber crime India case law',
          purpose: 'case',
          issueIds: ['issue-1'],
          priority: 2,
        },
        {
          id: 'q-dpdp',
          query: 'Digital Personal Data Protection Act 2023 unauthorised processing loan India',
          purpose: 'statute',
          issueIds: ['issue-1'],
          priority: 2,
        },
        {
          id: 'q-bsa',
          query: 'BSA electronic evidence Sakshya Act digital records India',
          purpose: 'statute',
          issueIds: ['issue-1'],
          priority: 3,
        },
        {
          id: 'q-injunction',
          query: 'civil declaration injunction restrain credit information company CIBIL India',
          purpose: 'case',
          issueIds: ['issue-3'],
          priority: 3,
        },
      );
      likelyStatutes = [
        toCandidate(
          {
            title: 'Information Technology Act, 2000',
            proposition: 'Identity theft / computer-related offences for fraudulent loans',
            searchHints: ['IT Act identity theft fraudulent loan'],
            confidence: 'high',
          },
          'statute',
          0,
          'statute',
        ),
        toCandidate(
          {
            title: 'Consumer Protection Act, 2019',
            proposition: 'Deficiency in service / unfair trade practice by lenders or apps',
            searchHints: ['Consumer Protection Act 2019 loan app'],
            confidence: 'high',
          },
          'statute',
          1,
          'statute',
        ),
        toCandidate(
          {
            title: 'Digital Personal Data Protection Act, 2023',
            proposition: 'Unauthorised processing of personal data in lending stacks',
            searchHints: ['DPDP Act digital lending'],
            confidence: 'medium',
          },
          'statute',
          2,
          'statute',
        ),
        toCandidate(
          {
            title: 'Bharatiya Sakshya Adhiniyam, 2023',
            proposition: 'Electronic evidence for KYC / app records',
            searchHints: ['BSA electronic evidence'],
            confidence: 'medium',
          },
          'statute',
          3,
          'statute',
        ),
      ];
      likelyRegulations = [
        toCandidate(
          {
            title: 'RBI Digital Lending Directions / Fair Practices Code',
            proposition: 'Digital lending conduct, disclosure, and recovery limits',
            searchHints: ['RBI digital lending guidelines ombudsman'],
            confidence: 'high',
          },
          'regulation',
          0,
          'reg',
        ),
      ];
      likelyRegulators = [
        toCandidate(
          { title: 'Reserve Bank of India / RBI Ombudsman', confidence: 'high' },
          'regulator',
          0,
          'regulator',
        ),
        toCandidate(
          { title: 'Credit Information Company (e.g. CIBIL) dispute process', confidence: 'high' },
          'regulator',
          1,
          'regulator',
        ),
      ];
      likelyProceduralRoutes = [
        {
          forum: 'Civil court / consumer commission',
          procedure: 'Declaration, injunction, deficiency complaint',
          searchHints: ['declaration injunction CIBIL consumer commission'],
        },
        {
          forum: 'Cybercrime reporting / police complaint',
          procedure: 'Identity theft / cheating where facts support',
          searchHints: ['cybercrime complaint identity theft fraudulent loan'],
        },
      ];
    }

    if (
      cc === 'IN' &&
      /\b(?:landlord|tenant|tenancy|lessee|lessor)\b/i.test(q) &&
      /\b(?:evict|vacate|notice to quit|notice period|premature|dispossess)\b/i.test(q)
    ) {
      researchQueries.push(
        {
          id: 'q-tpa-106',
          query: 'Transfer of Property Act section 106 notice to quit India',
          purpose: 'statute',
          issueIds: ['issue-1'],
          priority: 1,
        },
        {
          id: 'q-tpa-111',
          query: 'Transfer of Property Act section 111 determination of lease India',
          purpose: 'statute',
          issueIds: ['issue-1'],
          priority: 1,
        },
        {
          id: 'q-sra-injunction',
          query: 'Specific Relief Act injunction declaration restrain dispossession tenant India',
          purpose: 'statute',
          issueIds: ['issue-3'],
          priority: 2,
        },
        {
          id: 'q-tenant-case',
          query: 'injunction restrain dispossession tenant India Supreme Court',
          purpose: 'case',
          issueIds: ['issue-3'],
          priority: 3,
        },
      );
      likelyStatutes = [
        toCandidate(
          {
            title: 'Transfer of Property Act, 1882',
            proposition: 'Lease, notice to quit, and determination (ss.105–111)',
            searchHints: ['Transfer of Property Act section 106', 'section 111'],
            confidence: 'high',
          },
          'statute',
          0,
          'statute',
        ),
        toCandidate(
          {
            title: 'Specific Relief Act, 1963',
            proposition: 'Declaration and injunction against premature dispossession',
            searchHints: ['Specific Relief Act section 34', 'section 38'],
            confidence: 'high',
          },
          'statute',
          1,
          'statute',
        ),
        toCandidate(
          {
            title: 'Code of Civil Procedure, 1908',
            proposition: 'Civil court jurisdiction and interim injunction (s.9, O.39)',
            searchHints: ['CPC Order 39 injunction tenant'],
            confidence: 'high',
          },
          'statute',
          2,
          'statute',
        ),
        toCandidate(
          {
            title: 'Indian Contract Act, 1872',
            proposition: 'Performance of the lease and damages for premature termination',
            searchHints: ['Contract Act section 37', 'section 73'],
            confidence: 'medium',
          },
          'statute',
          3,
          'statute',
        ),
      ];
      likelyProceduralRoutes = [
        {
          forum: 'Civil court (original side / district)',
          procedure: 'Suit for declaration, injunction, and damages; interim O.39 relief',
          searchHints: ['tenant injunction declaration CPC Order 39'],
        },
      ];
    }

    if (cc === 'KE' && /\b(crb|credit|loan|fraud|digital|safaricom|mpesa|dpa|data protection)\b/i.test(q)) {
      researchQueries.push(
        {
          id: 'q-ke-dpa',
          query: 'Data Protection Act Kenya unauthorised processing digital loan CRB',
          purpose: 'statute',
          issueIds: ['issue-1'],
          priority: 1,
        },
        {
          id: 'q-ke-crb',
          query: 'credit reference bureau listing dispute Kenya High Court',
          purpose: 'case',
          issueIds: ['issue-1'],
          priority: 1,
        },
        {
          id: 'q-ke-dcp',
          query: 'digital credit provider CBK consumer protection Kenya',
          purpose: 'regulation',
          issueIds: ['issue-2'],
          priority: 2,
        },
        {
          id: 'q-ke-evidence',
          query: 'Evidence Act electronic records Kenya mobile money',
          purpose: 'statute',
          issueIds: ['issue-1'],
          priority: 3,
        },
      );
      likelyStatutes = [
        toCandidate(
          {
            title: 'Data Protection Act (Kenya)',
            proposition: 'Personal data processing and remedies for unauthorised lending stacks',
            searchHints: ['Data Protection Act Kenya CRB'],
            confidence: 'high',
          },
          'statute',
          0,
          'statute',
        ),
        toCandidate(
          {
            title: 'Evidence Act (Kenya)',
            proposition: 'Electronic records / mobile money evidence',
            searchHints: ['Evidence Act electronic records Kenya'],
            confidence: 'medium',
          },
          'statute',
          1,
          'statute',
        ),
      ];
      likelyRegulators = [
        toCandidate(
          { title: 'Office of the Data Protection Commissioner (Kenya)', confidence: 'high' },
          'regulator',
          0,
          'regulator',
        ),
        toCandidate(
          { title: 'Central Bank of Kenya / digital credit oversight', confidence: 'medium' },
          'regulator',
          1,
          'regulator',
        ),
      ];
      likelyProceduralRoutes = [
        {
          forum: 'High Court / Magistrate Court',
          procedure: 'Civil declaration and injunction',
          searchHints: ['declaration injunction CRB Kenya'],
        },
        {
          forum: 'ODPC complaint',
          procedure: 'Data protection complaint',
          searchHints: ['ODPC complaint Data Protection Act'],
        },
      ];
    }

    return {
      version: 1,
      modelName,
      degraded: true,
      degradationReason: reason,
      jurisdiction: [cc, ...(input.jurisdiction ? [input.jurisdiction] : [])],
      jurisdictionConfidence: 0.5,
      issues,
      likelyDoctrines: [],
      likelyStatutes,
      likelyRegulations,
      likelyCases: [],
      likelyProceduralRoutes,
      likelyRegulators,
      terminology: [],
      alternateTerminology: [],
      unresolvedQuestions: [
        'Intelligence map degraded — candidates are MODEL_KNOWLEDGE hypotheses until retrieved.',
        'Verify authorities carefully before reliance.',
      ],
      researchQueries,
      contraryAuthorityQueries: [
        {
          id: 'cq-1',
          query: `${q} contrary authority distinguished overruled ${cc}`,
          purpose: 'contrary',
          issueIds: ['issue-1'],
          priority: 1,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  /** Flatten map into retrieval query strings (issue-targeted, not one blob). */
  expandRetrievalQueries(map: ResearchIntelligenceMap, limit = 10): string[] {
    const fromPlan = [...map.researchQueries]
      .sort((a, b) => a.priority - b.priority)
      .map((q) => q.query);
    const fromCandidates = [
      ...map.likelyStatutes,
      ...map.likelyRegulations,
      ...map.likelyCases,
      ...map.likelyRegulators,
    ].flatMap((c) => {
      const hints = c.searchHints.length ? c.searchHints : [];
      const titleQuery = [c.title, c.citation].filter(Boolean).join(' ');
      return [titleQuery, ...hints].filter(Boolean);
    });
    const contrary = map.contraryAuthorityQueries.map((q) => q.query);
    return [...new Set([...fromPlan, ...fromCandidates, ...contrary])].slice(0, limit);
  }

  buildPromptBlock(map: ResearchIntelligenceMap): string {
    const lines: string[] = [
      '## Research Intelligence Map (hypotheses — not verified law)',
      `Jurisdictions: ${map.jurisdiction.join(', ')} (confidence ${map.jurisdictionConfidence.toFixed(2)})`,
      map.degraded ? `Map degraded: ${map.degradationReason ?? 'unknown'}` : '',
      '',
      'Issues:',
      ...map.issues.map((i) => `- [${i.id}] ${i.label}${i.kind ? ` (${i.kind})` : ''}`),
      '',
      'Candidate statutes/regulations (MODEL_KNOWLEDGE → resolve before relying):',
      ...[...map.likelyStatutes, ...map.likelyRegulations].map(
        (a) =>
          `- ${a.title}${a.citation ? ` (${a.citation})` : ''} — ${a.proposition ?? ''} [${a.verificationStatus}]`,
      ),
      '',
      'Candidate cases:',
      ...map.likelyCases.map(
        (a) =>
          `- ${a.title}${a.citation ? ` (${a.citation})` : ''} — ${a.proposition ?? ''} [${a.verificationStatus}]`,
      ),
      '',
      'Regulators / routes:',
      ...map.likelyRegulators.map((a) => `- ${a.title}`),
      ...map.likelyProceduralRoutes.map(
        (r) => `- ${r.forum}${r.procedure ? ` / ${r.procedure}` : ''}`,
      ),
      '',
      'Unresolved questions from planner:',
      ...map.unresolvedQuestions.map((u) => `- ${u}`),
    ];
    return lines.filter(Boolean).join('\n');
  }
}
