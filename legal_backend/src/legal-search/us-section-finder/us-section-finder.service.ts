import { Injectable, BadRequestException } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import {
  findStatuteById,
  formatSectionCitation,
  getStatutesForCountry,
  parseStatuteQuery,
} from '@/legal-search/statute-registry';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { StatuteIngestService } from '@/legal-sources/statute-ingest.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SectionFinderProfileService } from '@/legal-search/india-section-finder/section-finder-profile.service';
import { SectionFinderPopularService } from '@/legal-search/india-section-finder/section-finder-popular.service';
import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';
import type { SectionFinderSuggestion } from '@/legal-search/india-section-finder/section-finder.service';
import {
  US_DISCLAIMER,
  US_LAW_CURRENCY_CUTOFF,
  US_SECTION_FINDER_BY_ACT,
  US_SECTION_FINDER_DATA,
} from './us-section-finder.index';
import { loadAllUsStateManifests } from '@/legal-sources/us-manifest.loader';

export interface UsSectionFinderQuery {
  q: string;
  countryCode: string;
  jurisdiction?: string;
}

export interface UsSectionFinderEntry {
  id: string;
  legacyActId: string;
  legacyActShort: string;
  legacyActFull: string;
  legacySection: string;
  legacyTitle: string;
  newActId: string;
  newActShort: string;
  newActFull: string;
  newSection: string;
  newTitle: string;
  changeType: string;
  changeSummary: string;
  punishment: string;
  isBailable: boolean;
  isCognizable: boolean;
  isCompoundable: boolean;
  trialCourt: string;
  trialCourtLabel: string;
  bailPosture: string;
  practiceNote?: string;
  sectionText?: string;
  sourceRef: string;
  transitionDate: string;
  matchSource?: 'curated' | 'corpus' | 'index';
  isInForce?: boolean;
  stateJurisdiction?: string;
  uscTitle?: number;
  uscSection?: string;
}

export interface UsSectionFinderResult {
  query: string;
  countryCode: string;
  matches: UsSectionFinderEntry[];
  total: number;
  transitionDate: string;
  lawCurrencyCutoff: string;
  disclaimer: string;
}

@Injectable()
export class UsSectionFinderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bareActLookup: BareActLookupService,
    private readonly hybridSearch: HybridSearchService,
    private readonly statuteIngest: StatuteIngestService,
    private readonly profileService: SectionFinderProfileService,
    private readonly popularService: SectionFinderPopularService,
  ) {}

  async find(query: UsSectionFinderQuery): Promise<UsSectionFinderResult> {
    if (query.countryCode !== 'US') {
      throw new BadRequestException('US Section Finder requires countryCode=US');
    }

    const raw = (query.q ?? '').trim();
    if (!raw) {
      throw new BadRequestException('Query string is required');
    }

    const jurisdiction = query.jurisdiction?.toUpperCase();
    const parsed = parseStatuteQuery(raw, 'US');
    const matches: UsSectionFinderEntry[] = [];
    const seen = new Set<string>();

    const push = (entry: UsSectionFinderEntry) => {
      if (seen.has(entry.id)) return;
      seen.add(entry.id);
      matches.push(entry);
    };

    if (parsed.actId && parsed.section) {
      const curated = await this.resolveCuratedEntry(parsed.actId, parsed.section);
      if (curated) {
        push(curated);
      }

      const exact = await this.bareActLookup.lookupExactSection(
        parsed.actId,
        parsed.section,
        'US',
      );
      if (exact.found && exact.authority) {
        push(this.fromAuthority(exact.authority, parsed.actId, parsed.section, jurisdiction, curated));
      } else if (!curated) {
        const resolved = await this.statuteIngest.resolveSectionOnDemand(
          parsed.actId,
          parsed.section,
          'US',
        );
        if (resolved) {
          push({
            id: this.statuteIngest.buildSectionId('US', parsed.actId, resolved.section),
            legacyActId: parsed.actId,
            legacyActShort: findStatuteById(parsed.actId)?.shortName ?? parsed.actId,
            legacyActFull: findStatuteById(parsed.actId)?.fullName ?? parsed.actId,
            legacySection: resolved.section,
            legacyTitle: resolved.title,
            newActId: 'unchanged',
            newActShort: findStatuteById(parsed.actId)?.shortName ?? parsed.actId,
            newActFull: findStatuteById(parsed.actId)?.fullName ?? parsed.actId,
            newSection: '',
            newTitle: '',
            changeType: 'unchanged',
            changeSummary: resolved.summary.slice(0, 400),
            punishment: 'See statute text for applicable penalties.',
            isBailable: false,
            isCognizable: false,
            isCompoundable: false,
            trialCourt: 'federal',
            trialCourtLabel: 'Federal courts (subject to jurisdiction rules)',
            bailPosture: 'Consult applicable federal or state rules and the statute text.',
            sectionText: resolved.fullText,
            sourceRef: resolved.sourceUrl ?? resolved.sourceName,
            transitionDate: new Date().toISOString().slice(0, 10),
            matchSource: 'corpus',
            isInForce: true,
            stateJurisdiction:
              findStatuteById(parsed.actId)?.jurisdiction ??
              (jurisdiction && jurisdiction !== 'FED' ? jurisdiction : undefined),
          });
        }
      }
    }

    if (matches.length === 0) {
      const hybrid = await this.hybridSearch.search(raw, {
        countryCode: 'US',
        jurisdiction: jurisdiction && jurisdiction !== 'FED' ? jurisdiction : undefined,
        limit: 8,
      });
      for (const hit of hybrid) {
        if (!hit.id.startsWith('statute-us-')) continue;
        const parsedId = hit.id.match(/^statute-us-(.+)-s(.+)$/i);
        if (!parsedId) continue;
        const actId = parsedId[1];
        const section = parsedId[2];
        if (jurisdiction && jurisdiction !== 'FED') {
          const statute = findStatuteById(actId);
          if (statute?.jurisdiction && statute.jurisdiction !== jurisdiction) continue;
        }
        const curated = await this.resolveCuratedEntry(actId, section);
        push(this.fromAuthority(hit, actId, section, jurisdiction, curated));
        if (matches.length >= 5) break;
      }
    }

    if (matches.length > 0) {
      await this.popularService.recordSearch(
        'US',
        raw,
        this.toSectionFinderEntry(matches[0]),
        matches[0].id,
      );
    }

    return {
      query: raw,
      countryCode: 'US',
      matches,
      total: matches.length,
      transitionDate: new Date().toISOString().slice(0, 10),
      lawCurrencyCutoff: US_LAW_CURRENCY_CUTOFF,
      disclaimer: US_DISCLAIMER,
    };
  }

  async list(): Promise<UsSectionFinderResult> {
    const profiles = await this.prisma.statuteSectionProfile.findMany({
      where: { countryCode: 'US' },
      orderBy: [{ legacyActShort: 'asc' }, { sectionNumber: 'asc' }],
    });

    const matches =
      profiles.length > 0
        ? profiles.map((profile) =>
            this.fromCuratedEntry(
              this.profileService.profileToEntry(profile, 'curated'),
            ),
          )
        : US_SECTION_FINDER_DATA.map((entry) => this.fromCuratedEntry(entry));

    return {
      query: '',
      countryCode: 'US',
      matches,
      total: matches.length,
      transitionDate: new Date().toISOString().slice(0, 10),
      lawCurrencyCutoff: US_LAW_CURRENCY_CUTOFF,
      disclaimer: US_DISCLAIMER,
    };
  }

  listActStructures() {
    const manifests = loadAllUsStateManifests();
    const federal = getStatutesForCountry('US')
      .filter((s) => !s.jurisdiction && (s.ingestPriority ?? 99) <= 3)
      .map((s) => ({
        actId: s.id,
        shortName: s.shortName,
        fullName: s.fullName,
        jurisdiction: null as string | null,
        sectionCount: null as number | null,
        structureProfile: s.externalId?.startsWith('usc-title-') ? 'usc-title' : 'federal-act',
      }));

    const stateActs = manifests.flatMap((m) =>
      m.acts.map((act) => ({
        actId: act.actId,
        shortName: act.title,
        fullName: act.title,
        jurisdiction: m.stateCode,
        sectionCount: null as number | null,
        structureProfile: 'state-code',
      })),
    );

    return [...federal, ...stateActs].sort((a, b) =>
      (a.shortName ?? '').localeCompare(b.shortName ?? ''),
    );
  }

  async suggest(
    q: string,
    countryCode: string,
    limit = 10,
    jurisdiction?: string,
  ): Promise<SectionFinderSuggestion[]> {
    if (countryCode !== 'US') return [];
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];

    const suggestions: SectionFinderSuggestion[] = [];
    const statutes = getStatutesForCountry('US').filter((s) => {
      if (!jurisdiction || jurisdiction === 'FED') {
        return !s.jurisdiction;
      }
      return s.jurisdiction === jurisdiction;
    });

    const lower = trimmed.toLowerCase();
    for (const entry of US_SECTION_FINDER_DATA) {
      const label = `${entry.legacyActShort} §${entry.legacySection}`;
      if (
        label.toLowerCase().includes(lower) ||
        entry.legacyTitle.toLowerCase().includes(lower)
      ) {
        suggestions.push({
          displayLabel: label,
          normalizedQuery: label,
          actId: entry.legacyActShort,
          sectionNumber: entry.legacySection,
          title: entry.legacyTitle,
          legacyActShort: entry.legacyActShort,
          legacySection: entry.legacySection,
          matchSource: 'curated',
          score: 0.95,
        });
      }
      if (suggestions.length >= limit) break;
    }

    for (const statute of statutes) {
      for (const token of [statute.id, ...statute.acronyms, statute.shortName]) {
        if (lower.includes(token.toLowerCase()) || token.toLowerCase().includes(lower)) {
          suggestions.push({
            displayLabel: `${statute.shortName}`,
            normalizedQuery: `${statute.shortName}`,
            actId: statute.id,
            title: statute.fullName,
            matchSource: 'index',
            score: 0.8,
          });
          break;
        }
      }
      if (suggestions.length >= limit) break;
    }

    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'US',
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
      const parsedId = row.id.match(/^statute-us-(.+)-s(.+)$/i);
      if (!parsedId) continue;
      const actId = parsedId[1];
      const section = parsedId[2];
      const statute = findStatuteById(actId);
      if (jurisdiction && jurisdiction !== 'FED' && statute?.jurisdiction !== jurisdiction) continue;
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

  async getPopular(countryCode: string, limit = 10, jurisdiction?: string) {
    if (countryCode !== 'US') return [];

    const tracked = await this.popularService.getPopular('US', limit);
    if (tracked.length > 0) {
      if (!jurisdiction || jurisdiction === 'FED') return tracked;
      return tracked.filter((row) => {
        if (!row.actId) return true;
        const statute = findStatuteById(row.actId);
        return statute?.jurisdiction === jurisdiction || !statute?.jurisdiction;
      });
    }

    const defaults = US_SECTION_FINDER_DATA.filter((entry) => {
      if (!jurisdiction || jurisdiction === 'FED') {
        return !entry.legacyActShort.startsWith('CA ') &&
          !entry.legacyActShort.startsWith('NY ') &&
          !entry.legacyActShort.startsWith('TX ') &&
          !entry.legacyActShort.startsWith('FL ') &&
          !entry.legacyActShort.startsWith('IL ');
      }
      const prefix =
        jurisdiction === 'CA' ? 'CA ' :
        jurisdiction === 'NY' ? 'NY ' :
        jurisdiction === 'TX' ? 'TX ' :
        jurisdiction === 'FL' ? 'FL ' :
        jurisdiction === 'IL' ? 'IL ' : '';
      return prefix ? entry.legacyActShort.startsWith(prefix) : true;
    })
      .slice(0, limit)
      .map((entry, i) => ({
        displayLabel: `${entry.legacyActShort} §${entry.legacySection}`,
        normalizedQuery: `${entry.legacyActShort} ${entry.legacySection}`,
        actId: entry.legacyActShort,
        sectionNumber: entry.legacySection,
        title: entry.legacyTitle,
        searchCount: limit - i,
      }));

    if (defaults.length > 0) return defaults;

    return getStatutesForCountry('US')
      .filter((s) => {
        if (!jurisdiction || jurisdiction === 'FED') return !s.jurisdiction && (s.ingestPriority ?? 99) <= 2;
        return s.jurisdiction === jurisdiction;
      })
      .slice(0, limit)
      .map((s, i) => ({
        displayLabel: s.shortName,
        normalizedQuery: s.shortName,
        actId: s.id,
        title: s.fullName,
        searchCount: limit - i,
      }));
  }

  private async resolveCuratedEntry(
    actId: string,
    section: string,
  ): Promise<UsSectionFinderEntry | null> {
    const staticEntry = US_SECTION_FINDER_BY_ACT.get(`${actId}:${section.toUpperCase()}`);
    if (staticEntry) return this.fromCuratedEntry(staticEntry);

    const profile = await this.profileService.findProfile('US', actId, section);
    if (profile) {
      return this.fromCuratedEntry(this.profileService.profileToEntry(profile, 'curated'));
    }
    return null;
  }

  private fromCuratedEntry(entry: SectionFinderEntry): UsSectionFinderEntry {
    return {
      id: entry.legalAuthorityId ?? entry.id,
      legacyActId: entry.legacyActId,
      legacyActShort: entry.legacyActShort,
      legacyActFull: entry.legacyActFull,
      legacySection: entry.legacySection,
      legacyTitle: entry.legacyTitle,
      newActId: entry.newActId,
      newActShort: entry.newActShort,
      newActFull: entry.newActFull,
      newSection: entry.newSection,
      newTitle: entry.newTitle,
      changeType: entry.changeType,
      changeSummary: entry.changeSummary,
      punishment: entry.punishment,
      isBailable: entry.isBailable,
      isCognizable: entry.isCognizable,
      isCompoundable: entry.isCompoundable,
      trialCourt: entry.trialCourt,
      trialCourtLabel: entry.trialCourtLabel,
      bailPosture: entry.bailPosture,
      practiceNote: entry.practiceNote,
      sectionText: entry.sectionText,
      sourceRef: entry.sourceRef,
      transitionDate: new Date().toISOString().slice(0, 10),
      matchSource: entry.matchSource === 'curated' ? 'curated' : 'index',
      isInForce: entry.isInForce ?? true,
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
    jurisdiction?: string,
    curated?: UsSectionFinderEntry | null,
  ): UsSectionFinderEntry {
    if (curated) {
      return {
        ...curated,
        id: authority.id,
        sectionText: authority.fullText ?? curated.sectionText,
        changeSummary:
          authority.summary?.slice(0, 400) ??
          authority.fullText?.slice(0, 400) ??
          curated.changeSummary,
        matchSource: 'corpus',
        sourceRef: authority.sourceUrl ?? curated.sourceRef,
      };
    }

    const statute = findStatuteById(actId);
    const short = statute?.shortName ?? actId;
    const full = statute?.fullName ?? actId;
    const citation = statute ? formatSectionCitation(statute, section) : `${actId} s.${section}`;
    const body = authority.fullText ?? authority.summary ?? authority.title;
    const uscMatch = citation.match(/(\d+)\s*U\.?S\.?C\.?\s*[§]?\s*(\d+[a-zA-Z]?)/i);

    return {
      id: authority.id,
      legacyActId: actId,
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
      trialCourt: 'federal',
      trialCourtLabel: statute?.jurisdiction
        ? `${statute.jurisdiction} state courts (subject to assignment rules)`
        : 'Federal courts (subject to jurisdiction rules)',
      bailPosture: 'Consult applicable federal or state rules and the statute text.',
      sectionText: authority.fullText ?? undefined,
      sourceRef: authority.sourceUrl ?? citation,
      transitionDate: new Date().toISOString().slice(0, 10),
      matchSource: 'corpus',
      isInForce: true,
      stateJurisdiction: statute?.jurisdiction ?? (jurisdiction && jurisdiction !== 'FED' ? jurisdiction : undefined),
      uscTitle: uscMatch ? parseInt(uscMatch[1], 10) : undefined,
      uscSection: uscMatch?.[2],
    };
  }

  private toSectionFinderEntry(entry: UsSectionFinderEntry): SectionFinderEntry {
    return {
      id: entry.id,
      legacyActId: 'other',
      legacyActShort: entry.legacyActShort,
      legacyActFull: entry.legacyActFull,
      legacySection: entry.legacySection,
      legacyTitle: entry.legacyTitle,
      newActId: 'unchanged',
      newActShort: entry.newActShort,
      newActFull: entry.newActFull,
      newSection: entry.newSection,
      newTitle: entry.newTitle,
      changeType: 'unchanged',
      changeSummary: entry.changeSummary,
      punishment: entry.punishment,
      isBailable: entry.isBailable,
      isCognizable: entry.isCognizable,
      isCompoundable: entry.isCompoundable,
      trialCourt: 'special_court',
      trialCourtLabel: entry.trialCourtLabel,
      bailPosture: entry.bailPosture,
      practiceNote: entry.practiceNote,
      sectionText: entry.sectionText,
      sourceRef: entry.sourceRef,
      transitionDate: '2024-07-01',
      legalAuthorityId: entry.id.startsWith('statute-us-') ? entry.id : undefined,
    };
  }
}
