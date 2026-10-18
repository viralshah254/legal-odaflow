import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReActAgentService } from '@/ai/react-agent.service';
import { DEFAULT_ORCHESTRATOR_MODEL } from '@/ai/model-costs.config';
import { LegalRetrievalOrchestrator } from './legal-retrieval-orchestrator.service';
import { BareActLookupService } from './bare-act-lookup.service';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { IndiaKanoonConnector } from '@/legal-sources/connectors/india-kanoon.connector';
import { TavilySearchConnector } from '@/legal-sources/connectors/tavily-search.connector';
import { StatuteFetchConnector } from '@/legal-sources/connectors/statute-fetch.connector';
import { FirmMemoryService } from '@/firm-memory/firm-memory.service';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveSourceTier } from './source-tier.util';
import type { RetrievedAuthority } from './legal-retrieval.types';

export interface DeepResearchInput {
  query: string;
  countryCode: string;
  jurisdiction?: string;
  practiceArea?: string;
  tenantId: string;
  userId: string;
  matterId?: string;
  modelName: string;
  reactModelName?: string;
  priorAuthorities?: RetrievedAuthority[];
  locale?: string;
  /**
   * Maximum number of ReAct tool-use steps.
   * Controls cost: each step is a full LLM call on the mid-tier model.
   * Defaults to 2 (config: LEGAL_RESEARCH_MAX_AGENT_ROUNDS). Absolute cap is 10.
   */
  maxSteps?: number;
  /**
   * When true and priorAuthorities covers the minimum, skip the base retrieval pass
   * to eliminate duplicate searches already performed by the gateway.
   */
  skipBaseRetrieval?: boolean;
  /**
   * Restricts the agent to searching only for specific gap types.
   * Prevents the agent from restarting broad research when targeted gaps remain.
   */
  allowedGapTypes?: import('@/ai/legal-research/gap-query-builder.service').EvidenceGap[];
}

export interface DeepResearchResult {
  finalAnswer: string;
  authorities: RetrievedAuthority[];
  toolsUsed: string[];
  sufficiencyPassed: boolean;
  steps: number;
}

@Injectable()
export class DeepResearchAgentService {
  private readonly logger = new Logger(DeepResearchAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reactAgent: ReActAgentService,
    private readonly retrievalOrchestrator: LegalRetrievalOrchestrator,
    private readonly bareActLookup: BareActLookupService,
    private readonly hybridSearch: HybridSearchService,
    private readonly indiaKanoon: IndiaKanoonConnector,
    private readonly tavilySearch: TavilySearchConnector,
    private readonly statuteFetch: StatuteFetchConnector,
    private readonly firmMemory: FirmMemoryService,
    private readonly prisma: PrismaService,
  ) {}

  async runDeepResearch(input: DeepResearchInput): Promise<DeepResearchResult> {
    const collectedAuthorities = new Map<string, RetrievedAuthority>();
    for (const prior of input.priorAuthorities ?? []) {
      collectedAuthorities.set(prior.id, prior);
    }

    const minAuthorities = 3;
    const hasSufficientPriors =
      input.skipBaseRetrieval === true &&
      collectedAuthorities.size >= minAuthorities;

    if (!hasSufficientPriors) {
      const baseRetrieval = await this.retrievalOrchestrator.retrieve({
        query: input.query,
        countryCode: input.countryCode,
        jurisdiction: input.jurisdiction,
        practiceArea: input.practiceArea,
        tenantId: input.tenantId,
        userId: input.userId,
        matterId: input.matterId,
        priorAuthorities: input.priorAuthorities,
        supplementLive: true,
      });
      for (const a of baseRetrieval.authorities) collectedAuthorities.set(a.id, a);
    }

    const enrichedQuery = [
      input.query,
      this.retrievalOrchestrator.buildAuthorityContextBlock([...collectedAuthorities.values()]),
      'Use tools to dig deeper until you have forum + procedure + primary authority for bare-act questions.',
    ].join('\n\n');

    const reactModelName =
      input.reactModelName ??
      this.configService.get<string>(
        'AI_LEGAL_ORCHESTRATOR_MODEL',
        this.configService.get<string>('AI_LEGAL_FAST_MODEL', DEFAULT_ORCHESTRATOR_MODEL),
      );

    // Cap steps by caller-supplied budget. Default is 2 (config: LEGAL_RESEARCH_MAX_AGENT_ROUNDS).
    // Each step is a full LLM call; capping saves significant cost.
    // The absolute cap is 10; caller must pass maxSteps explicitly for higher budgets.
    const maxSteps = Math.min(input.maxSteps ?? 2, 10);

    const reactResult = await this.reactAgent.runWithTools({
      query: enrichedQuery,
      matterId: input.matterId,
      tenantId: input.tenantId,
      modelName: reactModelName,
      maxSteps,
      locale: input.locale,
      tools: this.buildLegalTools(input, collectedAuthorities),
    });

    const authorities = [...collectedAuthorities.values()];
    const isBareActQuery = /\b(section|article|bnss|bns|crpc|ipc)\b/i.test(input.query);
    const sufficiencyPassed = this.evaluateSufficiency(input.query, authorities, isBareActQuery);

    return {
      finalAnswer: reactResult.finalAnswer,
      authorities,
      toolsUsed: reactResult.toolsUsed,
      sufficiencyPassed,
      steps: reactResult.steps.length,
    };
  }

  private evaluateSufficiency(query: string, authorities: RetrievedAuthority[], isBareActQuery: boolean): boolean {
    if (!isBareActQuery) return authorities.length >= 2;
    const hasPrimary = authorities.some(
      (a) => (a.sourceTier === 'primary' || a.sourceTier === 'seed') && !!(a.fullText ?? a.summary),
    );
    return hasPrimary;
  }

  private buildLegalTools(
    input: DeepResearchInput,
    collected: Map<string, RetrievedAuthority>,
  ) {
    return [
      {
        name: 'search_statute',
        description: 'Look up a bare act section by query (e.g. "101 bnss", "article 21")',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        execute: async (args: Record<string, unknown>) => {
          const q = String(args.query ?? input.query);
          const hits = await this.bareActLookup.lookupSection(q, input.countryCode);
          for (const h of hits) {
            collected.set(h.id, {
              id: h.id,
              title: h.title,
              citation: h.citation,
              sourceName: h.sourceName,
              summary: h.summary,
              fullText: h.fullText,
              sourceUrl: h.sourceUrl,
              sourceTier: 'primary',
            });
          }
          return JSON.stringify(hits.slice(0, 3));
        },
      },
      {
        name: 'search_corpus',
        description: 'Hybrid search across ingested legal corpus',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        execute: async (args: Record<string, unknown>) => {
          const q = String(args.query ?? input.query);
          const hits = await this.hybridSearch.search(q, {
            countryCode: input.countryCode,
            jurisdiction: input.jurisdiction,
            practiceArea: input.practiceArea,
            limit: 5,
          });
          for (const h of hits) {
            collected.set(h.id, {
              id: h.id,
              title: h.title,
              citation: h.citation,
              sourceName: h.sourceName,
              summary: h.summary,
              fullText: h.fullText,
              sourceUrl: h.sourceUrl,
              sourceTier: 'primary',
            });
          }
          return JSON.stringify(hits.slice(0, 3).map((h) => ({ title: h.title, citation: h.citation })));
        },
      },
      {
        name: 'search_cases',
        description: 'Search Indian Kanoon case law (IN only)',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        execute: async (args: Record<string, unknown>) => {
          if (input.countryCode !== 'IN' || !this.indiaKanoon.isConfigured()) {
            return 'Case search unavailable for this jurisdiction.';
          }
          const q = String(args.query ?? input.query);
          const hits = await this.indiaKanoon.search({ query: q, limit: 5 });
          for (const h of hits) {
            collected.set(h.id, {
              id: h.id,
              title: h.title,
              citation: h.citation,
              sourceName: 'Indian Kanoon',
              summary: h.summary,
              sourceUrl: h.sourceUrl,
              sourceTier: 'case_law',
            });
          }
          return JSON.stringify(hits.slice(0, 3).map((h) => ({ title: h.title, citation: h.citation })));
        },
      },
      {
        name: 'search_matter',
        description: 'Search matter context, firm memory, and intake facts',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        execute: async (args: Record<string, unknown>) => {
          const q = String(args.query ?? input.query);
          const parts: string[] = [];
          if (input.matterId) {
            const matter = await this.prisma.matter.findFirst({
              where: { id: input.matterId, tenantId: input.tenantId },
              select: { title: true, factsSummary: true, desiredOutcome: true },
            });
            if (matter?.factsSummary) parts.push(`Matter facts: ${matter.factsSummary}`);
          }
          const firm = await this.firmMemory.search(input.tenantId, input.userId, undefined, q, 5);
          if (firm.hits.length > 0) {
            parts.push(firm.hits.map((h) => h.content.slice(0, 200)).join('\n'));
          }
          return parts.join('\n') || 'No matter-specific context found.';
        },
      },
      {
        name: 'evaluate_sufficiency',
        description: 'Check if retrieved authorities cover forum, procedure, and primary statute',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          const authorities = [...collected.values()];
          const isBareAct = /\b(section|article|bnss|bns|crpc|ipc)\b/i.test(input.query);
          const ok = this.evaluateSufficiency(input.query, authorities, isBareAct);
          return ok
            ? 'Sufficient: primary authority and context present.'
            : 'Insufficient: need primary-tier statute passage before answering bare-act question.';
        },
      },
      {
        name: 'fetch_primary_passage',
        description: 'Fetch full text for a retrieved authority id',
        parameters: {
          type: 'object',
          properties: { authorityId: { type: 'string' } },
          required: ['authorityId'],
        },
        execute: async (args: Record<string, unknown>) => {
          const id = String(args.authorityId ?? '');
          const cached = collected.get(id);
          if (cached?.fullText) return cached.fullText;
          const row = await this.prisma.legalAuthority.findUnique({
            where: { id },
            select: { fullText: true, title: true },
          });
          return row?.fullText ?? cached?.summary ?? 'Passage not found.';
        },
      },
      {
        name: 'fetch_statute_text',
        description:
          'Fetch the text of a statute or legal document directly from an official source URL (India Code, PRS India, Legislative Dept, etc.). Use when search_statute and search_corpus returned nothing and you have a direct URL from search results. Returns up to 4000 characters of readable text.',
        parameters: {
          type: 'object',
          properties: {
            sourceUrl: {
              type: 'string',
              description: 'Full URL of the statute page or PDF (e.g. from indiacode.nic.in or prsindia.org)',
            },
          },
          required: ['sourceUrl'],
        },
        execute: async (args: Record<string, unknown>) => {
          const url = String(args.sourceUrl ?? '');
          return this.statuteFetch.fetchText(url);
        },
      },
      ...(this.tavilySearch.isConfigured()
        ? [
            {
              name: 'search_web',
              description:
                'Search live legal web sources (PRS India, IndiaCode, SCI judgments, Kanoon, legislation.gov.in, NCRB, etc.) for statutes, case law, and legal commentary not in the local corpus. Use this when search_statute and search_corpus return nothing relevant.',
              parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Precise legal query, e.g. "BNSS section 101 abducted females"' } },
                required: ['query'],
              },
              execute: async (args: Record<string, unknown>) => {
                const q = String(args.query ?? input.query);
                const results = await this.tavilySearch.search({
                  query: q,
                  countryCode: input.countryCode,
                  limit: 6,
                });
                const seen = new Set<string>();
                for (const r of results) {
                  if (r.sourceUrl && seen.has(r.sourceUrl)) continue;
                  if (r.sourceUrl) seen.add(r.sourceUrl);
                  const id = `web-${r.id}`;
                  collected.set(id, {
                    id,
                    title: r.title,
                    citation: r.citation,
                    sourceName: r.sourceUrl
                      ? new URL(r.sourceUrl).hostname.replace(/^www\./, '')
                      : 'Web',
                    summary: r.summary,
                    fullText: null,
                    sourceUrl: r.sourceUrl || null,
                    sourceTier: resolveSourceTier(r.sourceUrl ?? ''),
                  });
                }
                return JSON.stringify(
                  results.slice(0, 5).map((r) => ({ title: r.title, url: r.sourceUrl, summary: r.summary?.slice(0, 200) })),
                );
              },
            },
          ]
        : []),
    ];
  }
}
