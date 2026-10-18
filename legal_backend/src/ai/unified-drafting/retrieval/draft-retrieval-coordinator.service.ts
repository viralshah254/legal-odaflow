import { Injectable, Logger } from '@nestjs/common';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { getCuratedConsumerResearchSources } from '@/ai/drafting/accuracy/curated-consumer-sources.util';
import { wantsCaseLaw, wantsKnowledgeSource } from '@/ai/drafting/draft-citation-policy';
import type { NormalizedMatter } from '../contracts/normalized-matter';
import type { ProceduralGateResult } from '../procedural/unified-procedural-gate.service';
import type { VerifiedSource } from '../contracts/verified-source';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { extractNamedStatuteQueries } from '@/ai/legal-research/named-statute-extract';
import { filterAuthoritiesToCheckPack } from '@/ai/legal-research/named-authority-check-pack';

export interface RetrievalInput {
  matter: NormalizedMatter;
  proceduralResult: ProceduralGateResult;
  tenantId: string;
  userId: string;
  /** Optional pre-extracted Case Brief for fact-pattern queries. */
  caseBriefJson?: Record<string, unknown> | null;
  /** Restrict retrieval tiers (statutes, case_law, etc.). */
  knowledgeSources?: string[];
  /** Matter saved research — used as the check pack, not a corpus dump. */
  savedResearchAuthorities?: RetrievedAuthority[];
  /**
   * Per-ground queries derived from the theory of the case. These run in addition
   * to the fact-pattern queries so each pleaded ground gets its own authority search.
   */
  groundQueries?: string[];
}

/**
 * Draft Retrieval Coordinator
 *
 * Runs all retrieval tasks in parallel. Every source returned here
 * is handed to VerifiedSourceRegistryService for verification
 * before being passed to the model.
 */
@Injectable()
export class DraftRetrievalCoordinator {
  private readonly logger = new Logger(DraftRetrievalCoordinator.name);

  constructor(
    private readonly retrieval: LegalRetrievalOrchestrator,
    private readonly caseBrief: DraftCaseBriefService,
    private readonly playbooks: DraftKindPlaybookService,
  ) {}

  async retrieveAll(input: RetrievalInput): Promise<VerifiedSource[]> {
    const { matter, tenantId, userId } = input;
    const playbook = this.playbooks.resolve(matter.documentKind);
    const brief =
      (input.caseBriefJson as ReturnType<DraftCaseBriefService['extract']> | null) ??
      this.caseBrief.extract(matter.rawUserInput ?? '', matter.documentKind);

    const savedPack = filterAuthoritiesToCheckPack(
      input.savedResearchAuthorities ?? [],
      matter.rawUserInput ?? '',
    );

    const briefQueries = this.caseBrief.buildRetrievalQueries(brief, matter.documentKind);
    const groundQueries = (input.groundQueries ?? []).filter((q) => q.trim().length > 9);
    // Ground queries lead: a filing is only as good as the authority behind each
    // ground, so those searches run before the generic fact-pattern ones.
    const queries = [...new Set([...groundQueries, ...briefQueries])];
    const namedStatutes = extractNamedStatuteQueries(matter.rawUserInput ?? '');
    const primaryQuery = namedStatutes[0] ?? briefQueries[0] ?? this.buildQuery(matter);
    const sources = input.knowledgeSources;
    const wantStatutes = wantsKnowledgeSource(sources, 'statutes');
    const wantCases = wantsCaseLaw(sources);

    const retrievalTasks: Array<Promise<VerifiedSource[]>> = [];
    if (wantStatutes) {
      retrievalTasks.push(
        this.retrieveStatutes(primaryQuery, matter, tenantId, userId, sources),
      );
    }
    if (wantCases) {
      retrievalTasks.push(
        this.retrieveCases(primaryQuery, matter, tenantId, userId, sources),
      );
      for (const q of queries.slice(0, 6)) {
        if (q === primaryQuery) continue;
        retrievalTasks.push(this.retrieveCases(q, matter, tenantId, userId, sources));
      }
    }

    const settled = await Promise.allSettled(retrievalTasks);

    const sourcesOut: VerifiedSource[] = [];
    const pushUnique = (list: VerifiedSource[]) => {
      const existingIds = new Set(sourcesOut.map((s) => s.id));
      for (const s of list) {
        if (!existingIds.has(s.id)) {
          sourcesOut.push(s);
          existingIds.add(s.id);
        }
      }
    };

    // Saved research is the trusted seed of the pack, but it does not replace live
    // search — a ground the saved memo never considered would otherwise go unresearched.
    if (savedPack.length > 0) {
      this.logger.log(`Seeding draft pack with ${savedPack.length} matter saved-research authorities`);
      pushUnique(
        savedPack.map((authority) =>
          this.toVerifiedSource(
            authority as unknown as Record<string, unknown>,
            authority.sourceTier === 'primary' ||
              (authority.authorityType ?? '').toUpperCase() === 'STATUTE'
              ? 'statute'
              : 'case',
          ),
        ),
      );
    }

    for (const batch of settled) {
      if (batch.status === 'fulfilled') pushUnique(batch.value);
      else this.logger.warn(`Retrieval batch failed: ${String(batch.reason)}`);
    }

    // Curated banks are a dump — skip unless live retrieval returned nothing.
    if (wantCases && sourcesOut.length === 0) {
      const curatedBailSources = this.getCuratedBailSources(matter.documentKind);
      if (curatedBailSources.length > 0) {
        pushUnique(curatedBailSources);
        this.logger.log(`Merged ${curatedBailSources.length} curated bail authorities for ${matter.documentKind}`);
      }
    }

    const curatedConsumer =
      sourcesOut.length === 0
        ? getCuratedConsumerResearchSources(matter.documentKind, matter.rawUserInput ?? '')
        : [];
    if (curatedConsumer.length > 0) {
      pushUnique(curatedConsumer.map((c) => this.curatedToVerifiedSource(c)));
      this.logger.log(
        `Merged ${curatedConsumer.length} curated consumer authorities for ${matter.documentKind}`,
      );
    }

    let caseCount = sourcesOut.filter((s) => s.type === 'case').length;
    const minCases = playbook.minVerifiedCaseAuthorities ?? 0;
    if (playbook.filingGrade && caseCount < minCases) {
      this.logger.warn(
        `Filing-grade retrieval under-min: ${caseCount}/${playbook.minVerifiedCaseAuthorities} case authorities for ${matter.documentKind}`,
      );
    }

    this.logger.log(
      `Retrieved ${sourcesOut.length} sources (${caseCount} cases) for ${matter.documentKind} via ${queries.length} queries (${groundQueries.length} per-ground)`,
    );
    return sourcesOut;
  }

  /** Returns curated (human-reviewed) case law for bail document kinds. */
  private getCuratedBailSources(documentKind: string): VerifiedSource[] {
    const kind = documentKind.toLowerCase();

    // Constitutional / rights-only cases are irrelevant for bail — exclude them
    if (!/bail/i.test(kind)) return [];

    const curated: Array<{ id: string; citation: string; title: string; summary: string; areas: string[] }> = [
      {
        id: 'curated__sanjay_chandra_v_cbi_2012',
        title: 'Sanjay Chandra v. CBI',
        citation: '(2012) 1 SCC 40',
        summary: 'Bail is the rule, jail is the exception. Factors to consider: nature and gravity of accusation, antecedents, flight risk, likelihood of repeating offence. Economic offences require additional scrutiny but do not automatically exclude bail.',
        areas: ['bail_is_rule', 'economic_offence_bail', 'bail_factors'],
      },
      {
        id: 'curated__arnesh_kumar_v_state_bihar_2014',
        title: 'Arnesh Kumar v. State of Bihar',
        citation: '(2014) 8 SCC 273',
        summary: 'Arrest must be the last resort. Police must satisfy necessity before arresting in offences punishable up to 7 years. Mechanical arrest without application of mind is impermissible.',
        areas: ['arrest_necessity', 'bail_liberty_rule'],
      },
      {
        id: 'curated__prasanta_kumar_sarkar_v_ashis_chatterjee_2010',
        title: 'Prasanta Kumar Sarkar v. Ashis Chatterjee',
        citation: '(2010) 14 SCC 496',
        summary: 'Bail factors enumerated: nature/gravity of accusation; character, behaviour, means; prima facie satisfaction of court; reasonable apprehension of tampering; likelihood of fleeing justice.',
        areas: ['bail_factors', 'bail_test'],
      },
      {
        id: 'curated__gurucharan_das_v_state_1978',
        title: 'Gurcharan Singh v. State (Delhi Administration)',
        citation: 'AIR 1978 SC 179',
        summary: 'Bail considerations under CrPC §437/§439 (BNSS §480/§483): seriousness of accusation, possibility of absconsion, antecedents, prima facie case. Bail not to be withheld as punishment.',
        areas: ['bail_factors', 'sessions_bail', 'bnss_483'],
      },
      {
        id: 'curated__satender_kumar_antil_v_cbi_2022',
        title: 'Satender Kumar Antil v. CBI',
        citation: '(2022) 10 SCC 51',
        summary: 'Comprehensive bail guidelines. No onerous conditions. Prolonged incarceration without trial violates right to liberty. Default bail must be granted on completion of statutory period.',
        areas: ['bail_conditions', 'bail_liberty_rule', 'prolonged_detention'],
      },
    ];

    // For anticipatory bail, add specific anticipatory bail authority
    if (/anticipatory/i.test(kind)) {
      curated.push({
        id: 'curated__siddharam_satlingappa_2011',
        title: 'Siddharam Satlingappa Mhetre v. State of Maharashtra',
        citation: '(2011) 1 SCC 694',
        summary: 'Factors for anticipatory bail: nature and gravity of accusation; antecedents; possibility of fleeing justice; accusation made bona fide. Courts should not impose conditions reducing anticipatory bail to a denial of bail in effect.',
        areas: ['anticipatory_bail', 'bail_conditions', 'bail_factors'],
      });
    }

    return curated.map((c) => this.curatedToVerifiedSource(c));
  }

  private curatedToVerifiedSource(c: {
    id: string; title: string; citation: string; summary: string; areas?: string[];
  }): VerifiedSource {
    const { createHash } = require('crypto') as typeof import('crypto');
    return {
      id: c.id,
      type: 'case',
      jurisdiction: 'IN',
      title: c.title,
      citation: c.citation,
      court: 'Supreme Court of India',
      text: c.summary.slice(0, 800),
      proposition: c.summary,
      bindingLevel: 'binding',
      verificationStatus: 'verified',
      contentHash: createHash('sha256').update(c.summary).digest('hex').slice(0, 16),
    };
  }

  private buildQuery(matter: NormalizedMatter): string {
    const parts = [
      matter.documentKind,
      matter.jurisdiction,
      matter.court?.name ?? '',
      matter.facts.slice(0, 3).map((f) => f.statement).join(' '),
    ].filter(Boolean);
    return parts.join(' ').trim().slice(0, 500);
  }

  private async retrieveStatutes(
    query: string,
    matter: NormalizedMatter,
    tenantId: string,
    userId: string,
    knowledgeSources?: string[],
  ): Promise<VerifiedSource[]> {
    try {
      const result = await this.retrieval.retrieve({
        query,
        countryCode: matter.jurisdiction?.split('-')[0] ?? 'IN',
        jurisdiction: matter.jurisdiction,
        tenantId,
        userId,
        limit: 10,
        knowledgeSources: knowledgeSources?.length
          ? knowledgeSources.filter((s) => s !== 'case_law')
          : ['statutes', 'case_law'],
      });
      return result.authorities
        .filter((a) => a.authorityType === 'STATUTE' || a.sourceTier === 'primary')
        .map((a) => this.toVerifiedSource(a as unknown as Record<string, unknown>, 'statute'));
    } catch {
      return [];
    }
  }

  private async retrieveCases(
    query: string,
    matter: NormalizedMatter,
    tenantId: string,
    userId: string,
    knowledgeSources?: string[],
  ): Promise<VerifiedSource[]> {
    try {
      const result = await this.retrieval.retrieve({
        query,
        countryCode: matter.jurisdiction?.split('-')[0] ?? 'IN',
        jurisdiction: matter.jurisdiction,
        tenantId,
        userId,
        limit: 15,
        knowledgeSources: knowledgeSources?.length
          ? knowledgeSources
          : ['case_law', 'statutes'],
      });
      return result.authorities
        .filter(
          (a) =>
            a.authorityType === 'CASE' ||
            a.sourceTier === 'case_law' ||
            (a.authorityType ?? '').toUpperCase() === 'CASE_LAW',
        )
        .filter((a) => a.treatmentStatus !== 'overruled' && a.treatmentStatus !== 'repealed')
        .map((a) => this.toVerifiedSource(a as unknown as Record<string, unknown>, 'case'));
    } catch {
      return [];
    }
  }

  private toVerifiedSource(authority: Record<string, unknown>, type: VerifiedSource['type']): VerifiedSource {
    const { createHash } = require('crypto') as typeof import('crypto');
    const text = String(
      authority['text'] ??
        authority['fullText'] ??
        authority['summary'] ??
        authority['proposition'] ??
        '',
    );
    return {
      id: String(authority['id'] ?? ''),
      type,
      jurisdiction: String(authority['jurisdiction'] ?? 'IN'),
      title: String(authority['title'] ?? authority['citation'] ?? ''),
      citation: authority['citation'] ? String(authority['citation']) : undefined,
      court: authority['court'] ? String(authority['court']) : undefined,
      date: authority['date'] ? String(authority['date']) : undefined,
      section: authority['section'] ? String(authority['section']) : undefined,
      text: text.slice(0, 800),
      proposition: authority['proposition'] ? String(authority['proposition']) : undefined,
      bindingLevel: (authority['bindingLevel'] as VerifiedSource['bindingLevel']) ?? 'persuasive',
      verificationStatus: 'partially_verified',
      contentHash: createHash('sha256').update(text).digest('hex').slice(0, 16),
    };
  }
}
