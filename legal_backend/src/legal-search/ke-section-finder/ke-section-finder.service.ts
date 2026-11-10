import { BadRequestException, Injectable } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import {
  findStatuteById,
  formatSectionCitation,
  getStatutesForCountry,
  parseStatuteQuery,
} from '@/legal-search/statute-registry';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { findKeManifestAct, keManifestExists, loadKeSourcesManifest, resolveKeActEntry } from '@/legal-sources/ke-manifest.loader';
import { StatuteIngestService } from '@/legal-sources/statute-ingest.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SectionFinderPopularService } from '@/legal-search/india-section-finder/section-finder-popular.service';
import { SectionFinderProfileService } from '@/legal-search/india-section-finder/section-finder-profile.service';
import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';
import type { SectionFinderSuggestion } from '@/legal-search/india-section-finder/section-finder.service';
import {
  KE_DISCLAIMER,
  KE_LAW_CURRENCY_CUTOFF,
  KE_POPULAR_QUERIES,
} from './ke-section-finder.index';

export interface KeSectionFinderQuery {
  q: string;
  countryCode: string;
  actId?: string;
  section?: string;
}

export interface KeSectionFinderResult {
  query: string;
  countryCode: string;
  matches: SectionFinderEntry[];
  total: number;
  transitionDate: string;
  lawCurrencyCutoff: string;
  disclaimer: string;
  actStructure?: {
    actId: string;
    sectionCount: number;
    structureProfile?: string;
  };
}

@Injectable()
export class KeSectionFinderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bareActLookup: BareActLookupService,
    private readonly hybridSearch: HybridSearchService,
    private readonly statuteIngest: StatuteIngestService,
    private readonly popularService: SectionFinderPopularService,
    private readonly profileService: SectionFinderProfileService,
  ) {}

  async find(query: KeSectionFinderQuery): Promise<KeSectionFinderResult> {
    if (query.countryCode.toUpperCase() !== 'KE') {
      throw new BadRequestException('Kenya Section Finder requires countryCode=KE');
    }

    const raw = (query.q ?? '').trim();
    const actIdHint = query.actId?.trim();
    const sectionHint = query.section?.trim();
    const searchText =
      raw || (actIdHint && sectionHint ? `${actIdHint} ${sectionHint}` : actIdHint ?? '');

    if (!searchText) {
      throw new BadRequestException('Query string is required');
    }

    const parsed = parseStatuteQuery(searchText, 'KE');
    const actId = actIdHint ?? parsed.actId;
    const section = sectionHint ?? parsed.section;
    const matches: SectionFinderEntry[] = [];
    const seen = new Set<string>();

    const push = (entry: SectionFinderEntry) => {
      if (seen.has(entry.id)) return;
      // Hard section-identity: never accept a hit that is not the requested §N.
      if (section && !this.authorityMatchesSection(entry.id, section)) return;
      seen.add(entry.id);
      matches.push(entry);
    };

    if (actId && section) {
      const exact = await this.bareActLookup.lookupExactSection(actId, section, 'KE');
      if (exact.found && exact.authority) {
        push(this.fromAuthority(exact.authority, actId, section, 'corpus'));
      } else {
        const resolved = await this.statuteIngest.resolveSectionOnDemand(actId, section, 'KE');
        if (resolved) {
          push(
            this.fromResolvedSection(resolved, resolved.fromNetwork ? 'network' : 'corpus'),
          );
        }
      }
    }

    // Topic + section (e.g. "land s.179") — score true §N rows by topic.
    // Also run when actId was set but exact lookup returned nothing.
    if (matches.length === 0 && section) {
      const topicHits = await this.resolveTopicSectionMatches(searchText, section);
      for (const entry of topicHits) {
        push(entry);
        if (matches.length >= 5) break;
      }
    }

    if (matches.length === 0 && parsed.statute && !section) {
      const statute = parsed.statute;
      const hybrid = await this.hybridSearch.searchStatuteSectionsPg(statute.shortName, {
        countryCode: 'KE',
        limit: 5,
      });
      for (const hit of hybrid) {
        const parsedId = hit.id.match(/^statute-ke-(.+)-s(.+)$/i);
        if (!parsedId) continue;
        push(this.fromAuthority(hit, parsedId[1], parsedId[2], 'corpus'));
        if (matches.length >= 5) break;
      }
    }

    if (matches.length === 0) {
      const topic = this.extractTopic(searchText);
      const hybridQuery =
        section && topic.length >= 2
          ? `${topic} s.${section}`
          : section
            ? `s.${section}`
            : searchText;
      const hybrid = await this.hybridSearch.search(hybridQuery, {
        countryCode: 'KE',
        limit: 8,
      });
      // When a section number was requested, keep ONLY matching -sN ids
      // (drop CPC §191-style mentions of "179" in the title/body).
      const scoped = this.filterHybridHitsBySection(hybrid, section);
      for (const hit of scoped) {
        if (!hit.id.startsWith('statute-ke-')) continue;
        const parsedId = hit.id.match(/^statute-ke-(.+)-s(.+)$/i);
        if (!parsedId) continue;
        push(this.fromAuthority(hit, parsedId[1], parsedId[2], 'corpus'));
        if (matches.length >= 5) break;
      }
    }

    if (matches.length > 0) {
      await this.popularService.recordSearch('KE', searchText, matches[0], matches[0].id);
    }

    let actStructure: KeSectionFinderResult['actStructure'];
    if (actId) {
      actStructure = await this.buildActStructure(actId);
    }

    return {
      query: searchText,
      countryCode: 'KE',
      matches,
      total: matches.length,
      transitionDate: new Date().toISOString().slice(0, 10),
      lawCurrencyCutoff: KE_LAW_CURRENCY_CUTOFF,
      disclaimer: KE_DISCLAIMER,
      actStructure,
    };
  }

  async suggest(q: string, countryCode: string, limit = 10): Promise<SectionFinderSuggestion[]> {
    if (countryCode !== 'KE') return [];
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];

    const suggestions: SectionFinderSuggestion[] = [];
    const lower = trimmed.toLowerCase();

    for (const statute of getStatutesForCountry('KE')) {
      const tokens = [statute.id, ...statute.acronyms, statute.shortName, statute.fullName];
      if (tokens.some((token) => token.toLowerCase().includes(lower) || lower.includes(token.toLowerCase()))) {
        suggestions.push({
          displayLabel: statute.shortName,
          normalizedQuery: `${statute.shortName}`,
          actId: statute.id,
          title: statute.fullName,
          matchSource: 'index',
          score: 0.85,
        });
      }
      if (suggestions.length >= limit) break;
    }

    if (keManifestExists()) {
      for (const entry of loadKeSourcesManifest().acts) {
        if (
          entry.title.toLowerCase().includes(lower) ||
          entry.actId.toLowerCase().includes(lower)
        ) {
          suggestions.push({
            displayLabel: entry.title,
            normalizedQuery: entry.title,
            actId: entry.actId,
            title: entry.title,
            matchSource: 'index',
            score: 0.75,
          });
        }
        if (suggestions.length >= limit * 2) break;
      }
    }

    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'KE',
        authorityType: 'STATUTE_SECTION',
        OR: [
          { citation: { contains: trimmed, mode: 'insensitive' } },
          { title: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    for (const row of rows) {
      const parsedId = row.id.match(/^statute-ke-(.+)-s(.+)$/i);
      if (!parsedId) continue;
      const actId = parsedId[1];
      const section = parsedId[2];
      const statute = findStatuteById(actId) ?? resolveKeActEntry(actId);
      suggestions.push({
        displayLabel: row.citation ?? `${actId} §${section}`,
        normalizedQuery: row.citation ?? `${actId} ${section}`,
        actId,
        sectionNumber: section,
        legalAuthorityId: row.id,
        title: row.title,
        legacyActShort: statute?.shortName,
        legacySection: section,
        matchSource: 'corpus',
        score: 0.9,
      });
    }

    return suggestions
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }

  async getPopular(countryCode: string, limit = 10) {
    if (countryCode !== 'KE') return [];

    const tracked = await this.popularService.getPopular('KE', limit);
    if (tracked.length > 0) return tracked;

    return KE_POPULAR_QUERIES.slice(0, limit).map((row, index) => ({
      displayLabel: row.label,
      normalizedQuery: row.q,
      actId: row.actId,
      searchCount: limit - index,
    }));
  }

  async list(): Promise<KeSectionFinderResult> {
    const profiles = await this.prisma.statuteSectionProfile.findMany({
      where: { countryCode: 'KE' },
      orderBy: [{ legacyActShort: 'asc' }, { sectionNumber: 'asc' }],
      take: 500,
    });

    const matches =
      profiles.length > 0
        ? profiles.map((profile) =>
            this.fromProfileEntry(this.profileService.profileToEntry(profile, 'corpus')),
          )
        : [];

    return {
      query: '',
      countryCode: 'KE',
      matches,
      total: matches.length,
      transitionDate: new Date().toISOString().slice(0, 10),
      lawCurrencyCutoff: KE_LAW_CURRENCY_CUTOFF,
      disclaimer: KE_DISCLAIMER,
    };
  }

  listActStructures() {
    const registry = getStatutesForCountry('KE').map((statute) => ({
      actId: statute.id,
      shortName: statute.shortName,
      fullName: statute.fullName,
      sectionCount: null as number | null,
      structureProfile: statute.frbrUri ? 'kenya-akn-act' : 'kenya-act',
    }));

    const manifestActs = keManifestExists()
      ? loadKeSourcesManifest().acts
          .filter((entry) => entry.nature === 'act' || entry.nature === 'constitution')
          .map((entry) => ({
            actId: entry.actId,
            shortName: entry.title.length > 48 ? `${entry.title.slice(0, 45)}…` : entry.title,
            fullName: entry.title,
            sectionCount: null as number | null,
            structureProfile: entry.nature === 'constitution' ? 'constitution' : 'kenya-akn-act',
          }))
      : [];

    const byId = new Map<string, (typeof registry)[number]>();
    for (const row of [...registry, ...manifestActs]) {
      if (!byId.has(row.actId)) byId.set(row.actId, row);
    }

    return [...byId.values()].sort((a, b) => (a.shortName ?? '').localeCompare(b.shortName ?? ''));
  }

  /**
   * Strip section markers (s.179 / section 179 / §179) from a query to leave a topic token.
   */
  private extractTopic(query: string): string {
    return query
      .replace(/\b(?:s\.?|sec\.?|section|§|art\.?|article|rule)\s*\d+[A-Za-z]?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeSectionKey(section: string): string {
    return section.replace(/^0+/, '').toUpperCase();
  }

  private authorityMatchesSection(authorityId: string, section: string): boolean {
    const parsedId = authorityId.match(/^statute-ke-(.+)-s(.+)$/i);
    if (!parsedId) return false;
    return this.normalizeSectionKey(parsedId[2]) === this.normalizeSectionKey(section);
  }

  private scoreTopicRelevance(
    topicLower: string,
    hitActId: string,
    title: string,
    citation?: string | null,
    summary?: string | null,
  ): number {
    if (topicLower.length < 2) return 0;
    let score = 0;
    const statute = findStatuteById(hitActId) ?? resolveKeActEntry(hitActId);
    const actHaystack = [
      hitActId,
      statute?.shortName,
      statute?.fullName,
      ...(statute?.acronyms ?? []),
      ...(statute?.searchAliases ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (actHaystack.includes(topicLower)) score += 100;
    if (title.toLowerCase().includes(topicLower)) score += 50;
    if ((citation ?? '').toLowerCase().includes(topicLower)) score += 30;
    if ((summary ?? '').toLowerCase().includes(topicLower)) score += 10;
    return score;
  }

  /**
   * Load true §N rows, score by topic (act name > title > citation > summary),
   * and merge registry/manifest exact lookups for topic-matching acts.
   */
  private async resolveTopicSectionMatches(
    searchText: string,
    section: string,
  ): Promise<SectionFinderEntry[]> {
    const topic = this.extractTopic(searchText);
    const sectionKey = this.normalizeSectionKey(section);
    const topicLower = topic.toLowerCase();

    type Scored = { entry: SectionFinderEntry; score: number };
    const scored: Scored[] = [];
    const seen = new Set<string>();

    const consider = (
      authority: {
        id: string;
        title: string;
        citation?: string | null;
        fullText?: string | null;
        summary?: string | null;
        sourceUrl?: string | null;
        sourceName?: string | null;
      },
      hitActId: string,
      hitSection: string,
      scoreBoost = 0,
    ) => {
      if (seen.has(authority.id)) return;
      if (this.normalizeSectionKey(hitSection) !== sectionKey) return;
      const score =
        this.scoreTopicRelevance(
          topicLower,
          hitActId,
          authority.title,
          authority.citation,
          authority.summary,
        ) + scoreBoost;
      // With a topic, require some relevance; without a topic, keep all §N rows.
      if (topicLower.length >= 2 && score <= 0) return;
      seen.add(authority.id);
      scored.push({
        entry: this.fromAuthority(authority, hitActId, hitSection, 'corpus'),
        score: score || 1,
      });
    };

    // Fetch by section identity only — score topic in memory (not SQL AND).
    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'KE',
        authorityType: 'STATUTE_SECTION',
        id: { endsWith: `-s${sectionKey}` },
      },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    });

    for (const row of rows) {
      const parsedId = row.id.match(/^statute-ke-(.+)-s(.+)$/i);
      if (!parsedId) continue;
      if (this.normalizeSectionKey(parsedId[2]) !== sectionKey) continue;
      consider(row, parsedId[1], parsedId[2]);
    }

    if (topicLower.length >= 2) {
      const candidateActIds = new Set<string>();
      for (const statute of getStatutesForCountry('KE')) {
        const haystack = [
          statute.id,
          statute.shortName,
          statute.fullName,
          ...statute.acronyms,
          ...statute.searchAliases,
        ]
          .join(' ')
          .toLowerCase();
        if (haystack.includes(topicLower)) {
          candidateActIds.add(statute.id);
        }
      }

      if (keManifestExists()) {
        for (const entry of loadKeSourcesManifest().acts) {
          if (
            entry.title.toLowerCase().includes(topicLower) ||
            entry.actId.toLowerCase().includes(topicLower)
          ) {
            candidateActIds.add(entry.actId);
          }
        }
      }

      for (const candidateActId of candidateActIds) {
        const exact = await this.bareActLookup.lookupExactSection(candidateActId, section, 'KE');
        if (exact.found && exact.authority) {
          consider(exact.authority, candidateActId, section, 20);
          continue;
        }
        const resolved = await this.statuteIngest.resolveSectionOnDemand(
          candidateActId,
          section,
          'KE',
        );
        if (resolved) {
          const entry = this.fromResolvedSection(
            resolved,
            resolved.fromNetwork ? 'network' : 'corpus',
          );
          if (seen.has(entry.id)) continue;
          if (!this.authorityMatchesSection(entry.id, section)) continue;
          const score =
            this.scoreTopicRelevance(
              topicLower,
              candidateActId,
              resolved.title,
              undefined,
              resolved.summary,
            ) + 20;
          if (score <= 0) continue;
          seen.add(entry.id);
          scored.push({ entry, score });
        }
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((row) => row.entry);
  }

  /** Keep only hybrid hits whose id section matches the requested §N. */
  private filterHybridHitsBySection<T extends { id: string }>(
    hits: T[],
    section?: string,
  ): T[] {
    if (!section) return hits;
    return hits.filter((hit) => this.authorityMatchesSection(hit.id, section));
  }

  private async buildActStructure(actId: string): Promise<KeSectionFinderResult['actStructure']> {
    const count = await this.prisma.legalAuthority.count({
      where: {
        countryCode: 'KE',
        authorityType: 'STATUTE_SECTION',
        id: { startsWith: `statute-ke-${actId}-s` },
      },
    });
    const manifest = findKeManifestAct(actId);
    return {
      actId,
      sectionCount: count,
      structureProfile: manifest?.nature === 'constitution' ? 'constitution' : 'kenya-akn-act',
    };
  }

  private fromResolvedSection(
    resolved: {
      actId: string;
      section: string;
      title: string;
      summary: string;
      fullText: string;
      sourceName: string;
      sourceUrl?: string;
    },
    matchSource: SectionFinderEntry['matchSource'],
  ): SectionFinderEntry {
    const statute = findStatuteById(resolved.actId) ?? resolveKeActEntry(resolved.actId);
    const short = statute?.shortName ?? resolved.actId;
    const full = statute?.fullName ?? resolved.actId;
    const id = this.statuteIngest.buildSectionId('KE', resolved.actId, resolved.section);

    return {
      id,
      legacyActId: 'other',
      legacyActShort: short,
      legacyActFull: full,
      legacySection: resolved.section,
      legacyTitle: resolved.title,
      newActId: 'unchanged',
      newActShort: short,
      newActFull: full,
      newSection: '',
      newTitle: '',
      changeType: 'unchanged',
      changeSummary: resolved.summary.slice(0, 400),
      punishment: 'See statute text for applicable penalties.',
      isBailable: false,
      isCognizable: false,
      isCompoundable: false,
      trialCourt: 'special_court',
      trialCourtLabel: 'Court with jurisdiction under the statute and Constitution',
      bailPosture: 'Consult the statute, Criminal Procedure Code, and applicable practice directions.',
      practiceNote: resolved.sourceName,
      sectionText: resolved.fullText,
      sourceRef: resolved.sourceUrl ?? resolved.sourceName,
      transitionDate: '',
      matchSource,
      legalAuthorityId: id,
    };
  }

  private fromAuthority(
    authority: {
      id: string;
      title: string;
      citation?: string | null;
      fullText?: string | null;
      summary?: string | null;
      sourceUrl?: string | null;
      sourceName?: string | null;
    },
    actId: string,
    section: string,
    matchSource: SectionFinderEntry['matchSource'],
  ): SectionFinderEntry {
    const statute = findStatuteById(actId) ?? resolveKeActEntry(actId);
    const short = statute?.shortName ?? actId;
    const full = statute?.fullName ?? actId;
    const citation = statute ? formatSectionCitation(statute, section) : `${actId} s.${section}`;
    const body = authority.fullText ?? authority.summary ?? authority.title;

    return {
      id: authority.id,
      legacyActId: 'other',
      legacyActShort: short,
      legacyActFull: full,
      legacySection: section,
      legacyTitle: authority.title.replace(/^Section\s+\S+\s+/i, '').trim() || authority.title,
      newActId: 'unchanged',
      newActShort: short,
      newActFull: full,
      newSection: '',
      newTitle: '',
      changeType: 'unchanged',
      changeSummary: body.slice(0, 400),
      punishment: 'See statute text for applicable penalties.',
      isBailable: false,
      isCognizable: false,
      isCompoundable: false,
      trialCourt: 'special_court',
      trialCourtLabel: 'Court with jurisdiction under the statute and Constitution',
      bailPosture: 'Consult the statute, Criminal Procedure Code, and applicable practice directions.',
      sectionText: authority.fullText ?? undefined,
      sourceRef: authority.sourceUrl ?? citation,
      transitionDate: '',
      matchSource,
      legalAuthorityId: authority.id,
    };
  }

  private fromProfileEntry(entry: SectionFinderEntry): SectionFinderEntry {
    return entry;
  }
}
