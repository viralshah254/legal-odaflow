import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { FirmMemoryService } from '@/firm-memory/firm-memory.service';
import { PrismaService } from '@/prisma/prisma.service';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { BareActLookupService } from './bare-act-lookup.service';
import { CitationFirstLookupService } from './citation-first-lookup.service';
import type { RetrievedAuthority } from './legal-retrieval.types';
import { resolveSourceTier } from './source-tier.util';
import { findStatuteById } from './statute-registry';

export interface KnowledgeStackSearchInput {
  query: string;
  countryCode: string;
  jurisdiction?: string;
  practiceArea?: string;
  subPracticeArea?: string;
  nature?: string;
  searchTopics?: string[];
  isBareActQuery?: boolean;
  /** When the query targets a specific section, pass it to enable exact pinning. */
  requestedActId?: string;
  requestedSection?: string;
  tenantId?: string;
  userId?: string;
  matterId?: string;
  intakeFacts?: string;
  limit?: number;
  /** Restrict to these source categories. Omit to query all. */
  knowledgeSources?: string[];
}

export interface KnowledgeStackSearchResult {
  authorities: RetrievedAuthority[];
  exactSectionFound: boolean;
  suggestedSections: RetrievedAuthority[];
}

@Injectable()
export class KnowledgeStackService {
  constructor(
    private readonly hybridSearch: HybridSearchService,
    private readonly bareActLookup: BareActLookupService,
    @Inject(forwardRef(() => FirmMemoryService))
    private readonly firmMemory: FirmMemoryService,
    private readonly prisma: PrismaService,
    private readonly citationFirstLookup: CitationFirstLookupService,
  ) {}

  async search(input: KnowledgeStackSearchInput): Promise<KnowledgeStackSearchResult> {
    const merged = new Map<string, RetrievedAuthority>();
    const limit = input.limit ?? 10;
    const authorityTypes = authorityTypesForKnowledgeSources(input.knowledgeSources);
    const allowLocalAuthorities = authorityTypes === undefined || authorityTypes.length > 0;
    const allowFirmVault =
      !input.knowledgeSources || input.knowledgeSources.includes('firm_vault');
    let exactSectionFound = false;
    const suggestedSections: RetrievedAuthority[] = [];

    // Run all independent source fetches concurrently — bare act, hybrid search,
    // firm memory, and matter context are independent DB/service calls.
    const [bareSettled, hybridSettled, citationSettled, firmSettled, matterSettled] =
      await Promise.allSettled([
      this.fetchBareAct(input),
      allowLocalAuthorities ? this.hybridSearch.search(input.query, {
        countryCode: input.countryCode,
        jurisdiction: input.jurisdiction,
        practiceArea: input.practiceArea,
        practiceAreas: input.practiceArea ? [input.practiceArea] : undefined,
        subPracticeArea: input.subPracticeArea,
        nature: input.nature,
        searchTopics: input.searchTopics,
        authorityTypes,
        limit,
      }) : Promise.resolve([]),
      this.citationFirstLookup.isCitationOrTitleQuery(input.query, input.countryCode)
        ? this.citationFirstLookup.lookup(input.query, input.countryCode)
        : Promise.resolve([]),
      this.fetchFirmMemory(input),
      input.matterId && input.tenantId
        ? this.prisma.matter.findFirst({
            where: { id: input.matterId, tenantId: input.tenantId },
            select: { title: true, factsSummary: true, desiredOutcome: true, jurisdiction: true },
          })
        : Promise.resolve(null),
    ]);

    // Merge bare act first — sets exactSectionFound for downstream dedup.
    if (bareSettled.status === 'fulfilled') {
      exactSectionFound = bareSettled.value.exactSectionFound;
      for (const auth of bareSettled.value.authorities) {
        merged.set(auth.id, auth);
      }
    }

    // Citation-first exact hits take priority over semantic retrieval.
    if (citationSettled.status === 'fulfilled') {
      for (const row of citationSettled.value) {
        merged.set(row.id, {
          ...this.toRetrieved(row),
          score: 1,
          sourceTier: row.sourceName.includes('e-SCR') ? 'primary' : 'case_law',
        });
      }
    }

    // Merge hybrid results — apply section dedup using exactSectionFound from bare act.
    if (hybridSettled.status === 'fulfilled') {
      for (const row of hybridSettled.value) {
        if (merged.has(row.id)) continue;
        // When exact section is pinned, demote hybrid hits from the same act but a
        // different section into suggestedSections so synthesis context stays clean.
        if (exactSectionFound && input.requestedActId && input.requestedSection) {
          if (this.isUnrelatedSectionHit(row, input.requestedActId, input.requestedSection)) {
            suggestedSections.push(this.toRetrieved(row));
            continue;
          }
        }
        merged.set(row.id, this.toRetrieved(row));
      }
    }

    // Merge firm memory — skip for exact-section pinned queries to keep synthesis
    // context focused on the statutory provision.
    if (allowFirmVault && !exactSectionFound && firmSettled.status === 'fulfilled') {
      for (const hit of firmSettled.value) {
        if (!merged.has(hit.id)) merged.set(hit.id, hit);
      }
    }

    // Merge matter context.
    if (allowFirmVault && matterSettled.status === 'fulfilled' && matterSettled.value?.factsSummary) {
      const matter = matterSettled.value;
      const id = `matter-facts-${input.matterId}`;
      const factsSummary = matter.factsSummary ?? '';
      merged.set(id, {
        id,
        title: `Matter facts: ${matter.title}`,
        citation: null,
        sourceName: 'Matter context',
        summary: factsSummary.slice(0, 400),
        fullText: factsSummary,
        sourceUrl: null,
        sourceTier: 'firm',
        authorityType: 'MATTER_FACTS',
      });
    }

    if (allowFirmVault && input.intakeFacts?.trim()) {
      merged.set(`intake-facts-${hashString(input.intakeFacts)}`, {
        id: `intake-facts-${hashString(input.intakeFacts)}`,
        title: 'Intake facts',
        citation: null,
        sourceName: 'Intake submission',
        summary: input.intakeFacts.slice(0, 400),
        fullText: input.intakeFacts,
        sourceUrl: null,
        sourceTier: 'firm',
        authorityType: 'INTAKE_FACTS',
      });
    }

    return {
      authorities: [...merged.values()].filter((authority) =>
        isAllowedByKnowledgeSources(authority, input.knowledgeSources),
      ),
      exactSectionFound,
      suggestedSections,
    };
  }

  private async fetchBareAct(
    input: KnowledgeStackSearchInput,
  ): Promise<{ exactSectionFound: boolean; authorities: RetrievedAuthority[] }> {
    const authorities: RetrievedAuthority[] = [];
    if (
      input.knowledgeSources &&
      !input.knowledgeSources.includes('statutes')
    ) {
      return { exactSectionFound: false, authorities };
    }
    if (!input.isBareActQuery) return { exactSectionFound: false, authorities };

    if (input.requestedActId && input.requestedSection) {
      const exact = await this.bareActLookup.lookupExactSection(
        input.requestedActId,
        input.requestedSection,
        input.countryCode,
      );
      if (exact.found && exact.authority) {
        authorities.push({ ...this.toRetrieved(exact.authority), score: 1.0, sourceTier: 'primary' });
        return { exactSectionFound: true, authorities };
      }
    } else {
      const bareHits = await this.bareActLookup.lookupSection(input.query, input.countryCode);
      for (const row of bareHits) {
        authorities.push(this.toRetrieved(row));
      }
    }
    return { exactSectionFound: false, authorities };
  }

  private async fetchFirmMemory(input: KnowledgeStackSearchInput): Promise<RetrievedAuthority[]> {
    if (!input.tenantId || !input.userId) return [];
    const firmHits = await this.firmMemory.search(
      input.tenantId,
      input.userId,
      undefined,
      input.query,
      6,
    );
    return firmHits.hits.map((hit) => {
      const id = `firm-${hit.sourceType}-${hashString(hit.title ?? hit.content.slice(0, 40))}`;
      return {
        id,
        title: hit.title ?? 'Firm knowledge',
        citation: null as null,
        sourceName: `Firm memory (${hit.sourceType})`,
        summary: hit.content.slice(0, 400),
        fullText: hit.content,
        sourceUrl: null as null,
        sourceTier: 'firm' as const,
        authorityType: 'FIRM_MEMORY',
        userAuthorityStatus: 'FACTUAL_MATERIAL_ONLY' as const,
      };
    });
  }

  /**
   * Returns true when a hybrid-search hit belongs to the same act as the
   * requested section but references a different section number.
   * Used to demote s.436 when the user asked for s.101.
   */
  private isUnrelatedSectionHit(
    row: { title: string; citation: string | null; fullText?: string | null; id: string },
    requestedActId: string,
    requestedSection: string,
  ): boolean {
    const blob = `${row.id} ${row.title} ${row.citation ?? ''}`.toLowerCase();
    // Check the hit belongs to the requested act
    const actPattern = new RegExp(`\\b${requestedActId.replace(/-/g, '[- ]?')}\\b`, 'i');
    if (!actPattern.test(blob)) return false;
    // If the id contains s{requestedSection} it IS the right section
    const expectedIdSuffix = `s${requestedSection.toLowerCase()}`;
    if (row.id.toLowerCase().endsWith(expectedIdSuffix)) return false;
    // The hit is from the same act but a different section
    const sectionInId = row.id.match(/-s(\d+[a-z]?)$/i)?.[1];
    if (sectionInId && sectionInId.toLowerCase() !== requestedSection.toLowerCase()) return true;
    return false;
  }

  private toRetrieved(row: {
    id: string;
    title: string;
    citation: string | null;
    neutralCitation?: string | null;
    sourceName: string;
    summary: string | null;
    fullText?: string | null;
    sourceUrl?: string | null;
    authorityType?: string;
    jurisdiction?: string | null;
    court?: string | null;
    decisionDate?: Date | string | null;
    topics?: unknown;
    practiceAreas?: unknown;
    treatmentStatus?: string;
    score?: number;
    isRepealed?: boolean;
    repealNotes?: string | null;
  }): RetrievedAuthority {
    const topics = Array.isArray(row.topics)
      ? row.topics.filter((value): value is string => typeof value === 'string')
      : [];
    const practiceAreas = Array.isArray(row.practiceAreas)
      ? row.practiceAreas.filter((value): value is string => typeof value === 'string')
      : [];
    const statuteMatch = row.id.match(/^statute-[a-z]{2}-(.+)-s(.+)$/i);
    const statute = statuteMatch ? findStatuteById(statuteMatch[1]) : undefined;
    const metadataValue = (prefix: string) =>
      topics.find((value) => value.startsWith(`${prefix}:`))?.slice(prefix.length + 1);
    const treatmentStatus =
      row.treatmentStatus &&
      ['good_law', 'overruled', 'distinguished', 'superseded', 'repealed'].includes(
        row.treatmentStatus,
      )
        ? (row.treatmentStatus as RetrievedAuthority['treatmentStatus'])
        : undefined;
    return {
      id: row.id,
      title: row.title,
      citation: row.citation,
      neutralCitation: row.neutralCitation,
      sourceName: row.sourceName,
      summary: row.summary,
      fullText: row.fullText,
      sourceUrl: row.sourceUrl ?? null,
      sourceTier: resolveSourceTier(row.sourceName, row.authorityType),
      authorityType: row.authorityType,
      court: row.court,
      decisionDate: row.decisionDate,
      practiceAreas,
      topics,
      actName: statute?.fullName,
      actYear: statute?.year,
      section: statuteMatch?.[2],
      heading: statuteMatch ? row.title : undefined,
      regulator: metadataValue('regulator'),
      instrumentType: metadataValue('instrumentType'),
      instrumentNumber: metadataValue('instrumentNumber'),
      instrumentDate: row.authorityType === 'REGULATION' ? row.decisionDate : undefined,
      treatmentStatus,
      courtTierRank: /supreme court/i.test(row.court ?? row.sourceName) ? 0 : undefined,
      score: row.score,
      isRepealed: row.isRepealed,
      repealNotes: row.repealNotes,
    };
  }
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function authorityTypesForKnowledgeSources(
  knowledgeSources?: string[],
): string[] | undefined {
  if (!knowledgeSources) return undefined;
  const types = new Set<string>();
  if (knowledgeSources.includes('statutes')) {
    types.add('STATUTE');
    types.add('STATUTE_SECTION');
  }
  if (knowledgeSources.includes('case_law')) types.add('CASE_LAW');
  if (knowledgeSources.includes('regulations')) types.add('REGULATION');
  return [...types];
}

function isAllowedByKnowledgeSources(
  authority: RetrievedAuthority,
  knowledgeSources?: string[],
): boolean {
  if (!knowledgeSources) return true;
  if (authority.sourceTier === 'firm') return knowledgeSources.includes('firm_vault');
  if (authority.authorityType === 'REGULATION') return knowledgeSources.includes('regulations');
  if (authority.authorityType === 'CASE_LAW') return knowledgeSources.includes('case_law');
  if (
    authority.authorityType === 'STATUTE' ||
    authority.authorityType === 'STATUTE_SECTION'
  ) {
    return knowledgeSources.includes('statutes');
  }
  return false;
}
