import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import {
  findPredecessorSection,
  findRemap,
  findStatuteById,
  parseStatuteQuery,
} from '@/legal-search/statute-registry';
import type { SectionRemapEntry } from '@/legal-search/statute-registry';
import {
  HybridSearchService,
  type HybridSearchResult,
} from '@/legal-sources/search/hybrid-search.service';
import { OpenSearchAdapterService } from '@/legal-sources/search/opensearch-adapter.service';
import {
  StatuteIngestService,
  type ResolvedStatuteSection,
} from '@/legal-sources/statute-ingest.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SectionFinderAiFallbackService,
  type SectionFinderAiSuggestion,
} from '@/legal-search/section-finder-ai-fallback.service';
import { detectRepealStatus } from '@/legal-sources/parsers/india-act-text.parser';
import {
  getActStructure,
  isProvisionIdValid,
  loadActStructureReference,
} from '@/legal-sources/act-structure.loader';
import { SectionFinderProfileService, type StatuteSectionProfileRow } from './section-finder-profile.service';
import { SectionFinderPopularService } from './section-finder-popular.service';
import { SectionFinderTranslationService } from './section-finder-translation.service';
import { SectionFinderUnmatchedService } from './section-finder-unmatched.service';
import { SECTION_FINDER_INDEX } from './section-finder.index';
import { normalizeSectionText, resolvePracticeNote, sanitizeSectionFinderEntry, truncateSuggestTitle } from './section-finder-text';
import {
  type LegacyActId,
  type SectionFinderEntry,
} from './section-finder.types';
import {
  findAmendmentOverlay,
} from './amendments-through-2026-06.in';
import {
  LAW_CURRENCY_CUTOFF,
  OMITTED_SENTINELS,
} from './section-finder.types';

export interface SectionFinderQuery {
  q: string;
  countryCode: string;
  locale?: string;
  matterId?: string;
  matterProfile?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterProfile;
  matterGraph?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterGraph;
  /** Deterministic corpus/profile key, e.g. statute-in-income-tax-s59 */
  authorityId?: string;
  actId?: string;
  section?: string;
}

export interface SectionFinderResult {
  query: string;
  countryCode: string;
  matches: SectionFinderEntry[];
  total: number;
  transitionDate: '2024-07-01';
  lawCurrencyCutoff: typeof LAW_CURRENCY_CUTOFF;
  disclaimer: string;
  /** AI candidates that did not resolve in corpus — unverified. */
  aiSuggestions?: SectionFinderAiSuggestion[];
  aiSuggestionModel?: string;
  aiSuggestionsNote?: string;
  actStructure?: {
    actId: string;
    sectionCount: number;
    orderCount?: number;
    scheduleCount?: number;
    structureProfile?: string;
    lastSectionId?: string;
  };
}

export interface SectionFinderSuggestion {
  displayLabel: string;
  normalizedQuery: string;
  actId?: string;
  sectionNumber?: string;
  legalAuthorityId?: string;
  title?: string;
  legacyActShort?: string;
  legacySection?: string;
  matchSource?: SectionFinderEntry['matchSource'] | 'popular' | 'index' | 'profile';
  score?: number;
}

/** Parse deterministic authority IDs, e.g. statute-in-income-tax-s80C */
export function parseSectionAuthorityId(
  id: string,
): { actId: string; section: string } | null {
  const match = id.match(/^statute-in-(.+)-s(.+)$/i);
  if (!match) return null;
  return {
    actId: match[1],
    section: match[2].toUpperCase(),
  };
}

const TRANSITION_DATE = '2024-07-01' as const;
const DISCLAIMER =
  'This section finder draws on curated IPC/CrPC/IEA→BNS/BNSS/BSA crosswalks, the published 2023 codes ' +
  '(effective 1 July 2024), and ingested bare-act sources (NI Act, POCSO, NDPS, PMLA, CPC, and other ' +
  'central statutes). On-demand lookups use official NCRB/PRS/India Code PDFs. This is legal information ' +
  'only — not legal advice. Consult a qualified advocate for your specific matter.';

const LEGACY_ACT_IDS = new Set<string>(['ipc', 'crpc', 'iea', 'ni_act', 'pocso', 'ndps', 'pmla']);
const NEW_ACT_IDS = new Set<string>(['bns', 'bnss', 'bsa']);

const LEGACY_ACT_META: Record<
  LegacyActId,
  { short: string; full: string }
> = {
  ipc: { short: 'IPC', full: 'Indian Penal Code, 1860' },
  crpc: { short: 'CrPC', full: 'Code of Criminal Procedure, 1973' },
  iea: { short: 'IEA', full: 'Indian Evidence Act, 1872' },
  ni_act: { short: 'NI Act', full: 'Negotiable Instruments Act, 1881' },
  pocso: { short: 'POCSO', full: 'Protection of Children from Sexual Offences Act, 2012' },
  ndps: { short: 'NDPS', full: 'Narcotic Drugs and Psychotropic Substances Act, 1985' },
  pmla: { short: 'PMLA', full: 'Prevention of Money Laundering Act, 2002' },
  cpc: { short: 'CPC', full: 'Code of Civil Procedure, 1908' },
  other: { short: '', full: '' },
};

const NEW_ACT_META: Record<'bns' | 'bnss' | 'bsa', { short: string; full: string }> = {
  bns: { short: 'BNS', full: 'Bharatiya Nyaya Sanhita, 2023' },
  bnss: { short: 'BNSS', full: 'Bharatiya Nagarik Suraksha Sanhita, 2023' },
  bsa: { short: 'BSA', full: 'Bharatiya Sakshya Adhiniyam, 2023' },
};

/** Infer legacy IPC/CrPC/IEA section from BNS/BNSS/BSA section body text. */
function inferLegacyFromSectionText(
  fullText: string,
  newActId: string,
): { actId: LegacyActId; section: string } | null {
  const text = fullText.slice(0, 800);
  if (newActId === 'bns') {
    const m =
      text.match(/(?:Replaces|replaces|formerly)\s+IPC\s+section\s+(\d+[A-Z]?)/i) ??
      text.match(/IPC\s+section\s+(\d+[A-Z]?)/i);
    if (m) return { actId: 'ipc', section: m[1].toUpperCase() };
  }
  if (newActId === 'bnss') {
    const m =
      text.match(/(?:Replaces|replaces|formerly)\s+Cr\.?\s*P\.?\s*C\.?\s+section\s+(\d+[A-Z]?)/i) ??
      text.match(/Cr\.?\s*P\.?\s*C\.?\s+section\s+(\d+[A-Z]?)/i);
    if (m) return { actId: 'crpc', section: m[1].toUpperCase() };
  }
  if (newActId === 'bsa') {
    const m =
      text.match(
        /(?:Replaces|replaces|formerly)\s+(?:IEA|Indian Evidence Act)\s+section\s+(\d+[A-Z]?)/i,
      ) ?? text.match(/(?:IEA|Indian Evidence Act)\s+section\s+(\d+[A-Z]?)/i);
    if (m) return { actId: 'iea', section: m[1].toUpperCase() };
  }
  return null;
}

function extractPunishmentHint(fullText: string): string {
  const m = fullText.match(
    /(?:shall be punished with|punished with|punishment[^.]{0,40}—)\s*([^.]{10,200})/i,
  );
  return m?.[1]?.trim() ?? 'See published bare act';
}

function applyAmendmentOverlay(entry: SectionFinderEntry): SectionFinderEntry {
  const actForOverlay =
    entry.newActId !== 'unchanged' && entry.newSection
      ? entry.newActId
      : entry.legacyActId;
  const sectionForOverlay =
    entry.newActId !== 'unchanged' && entry.newSection
      ? entry.newSection
      : entry.legacySection;
  const overlay = findAmendmentOverlay(actForOverlay, sectionForOverlay);
  if (!overlay) return entry;
  return {
    ...entry,
    effectiveAsOf: overlay.effectiveAsOf,
    lastVerifiedAt: overlay.lastVerifiedAt,
    amendingInstrument: overlay.amendingInstrument,
    changeSummary:
      overlay.summaryDelta && overlay.changeType !== 'commencement_pending'
        ? `${entry.changeSummary} [Amendment: ${overlay.summaryDelta}]`
        : entry.changeSummary,
    practiceNote:
      overlay.changeType === 'commencement_pending'
        ? [entry.practiceNote, overlay.summaryDelta].filter(Boolean).join(' ')
        : entry.practiceNote,
  };
}

function applyRepealFromText(entry: SectionFinderEntry, fullText: string): SectionFinderEntry {
  const { isRepealed, repealNotes } = detectRepealStatus(fullText);
  if (!isRepealed) return entry;
  return {
    ...entry,
    changeType: 'omitted',
    isInForce: false,
    punishment: OMITTED_SENTINELS.punishment,
    bailPosture: OMITTED_SENTINELS.bailPosture,
    isCognizable: false,
    isBailable: false,
    officialRemovalNote: repealNotes,
    changeSummary:
      `${entry.legacyActShort} §${entry.legacySection} — ${repealNotes ?? '[Omitted]'}. No longer in force.`,
  };
}

@Injectable()
export class SectionFinderService {
  private readonly logger = new Logger(SectionFinderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bareActLookup: BareActLookupService,
    private readonly statuteIngest: StatuteIngestService,
    private readonly hybridSearch: HybridSearchService,
    private readonly profileService: SectionFinderProfileService,
    private readonly popularService: SectionFinderPopularService,
    private readonly translationService: SectionFinderTranslationService,
    private readonly unmatchedService: SectionFinderUnmatchedService,
    @Optional() private readonly aiFallback?: SectionFinderAiFallbackService | null,
    @Optional() private readonly openSearch?: OpenSearchAdapterService,
  ) {}

  /** Bare citation / act+section lookup — not a free-text fact pattern. */
  private isBareSectionRef(
    query: SectionFinderQuery,
    actId: string | null,
    sectionToken: string | null,
  ): boolean {
    if (query.authorityId?.trim() || (query.actId?.trim() && query.section?.trim())) {
      return true;
    }
    return Boolean(actId && sectionToken);
  }

  /**
   * Resolve a single AI candidate against curated/corpus/on-demand only.
   * Never invents AI text — returns null when corpus cannot confirm.
   */
  private async resolveCandidateInCorpus(
    actId: string,
    sectionToken: string,
  ): Promise<SectionFinderEntry | null> {
    const curatedKey = `${actId.toUpperCase()}-${sectionToken.toUpperCase()}`;
    const curatedEntry = SECTION_FINDER_INDEX.get(curatedKey);
    if (curatedEntry) {
      return { ...curatedEntry, matchSource: curatedEntry.matchSource ?? 'curated' };
    }

    const profile = await this.profileService.findProfile('IN', actId, sectionToken);
    if (profile) {
      const exactHit = await this.bareActLookup.lookupExactSection(actId, sectionToken, 'IN');
      if (exactHit.found && exactHit.authority) {
        return this.profileService.mergeProfileWithAuthority(
          profile,
          exactHit.authority,
          exactHit.authority.score >= 1 ? 'corpus' : 'curated',
        );
      }
      return this.profileService.profileToEntry(profile, 'curated');
    }

    if (NEW_ACT_IDS.has(actId)) {
      const byNew = await this.profileService.findProfileByNewAct('IN', actId, sectionToken);
      if (byNew) return this.profileService.profileToEntry(byNew, 'curated');
    }

    const byLegacy = await this.profileService.findProfileByLegacyKey(
      'IN',
      actId,
      sectionToken,
    );
    if (byLegacy) return this.profileService.profileToEntry(byLegacy, 'curated');

    const exactHit = await this.bareActLookup.lookupExactSection(actId, sectionToken, 'IN');
    if (exactHit.found && exactHit.authority) {
      return this.buildFromAuthority(exactHit.authority, actId, sectionToken);
    }

    const remap = findRemap('IN', actId, sectionToken);
    if (remap) {
      const built = await this.buildFromRemap(remap, 'remap');
      if (built) return built;
    }

    if (NEW_ACT_IDS.has(actId)) {
      const reverse = findPredecessorSection('IN', actId, sectionToken);
      if (reverse) {
        const built = await this.buildFromRemap(reverse, 'remap');
        if (built) return built;
      }
    }

    if (this.statuteIngest.isActInManifest(actId, 'IN')) {
      try {
        const resolved = await this.statuteIngest.resolveSectionOnDemand(
          actId,
          sectionToken,
          'IN',
        );
        if (resolved) return this.buildFromResolved(resolved);
      } catch (err) {
        this.logger.warn(
          `Candidate on-demand resolve failed for ${actId} §${sectionToken}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return null;
  }

  async getPopular(countryCode: string, limit = 10) {
    if (countryCode !== 'IN') {
      throw new BadRequestException('India Section Finder is only available for India (IN).');
    }
    return this.popularService.getPopular(countryCode, limit);
  }

  /** Act structure counts from bundled India Code PDFs (sections, orders, schedules, articles). */
  listActStructures(countryCode = 'IN') {
    if (countryCode !== 'IN') {
      throw new BadRequestException('India Section Finder is only available for India (IN).');
    }
    const ref = loadActStructureReference();
    return Object.values(ref.acts)
      .filter((entry) => entry.registryActId)
      .map((entry) => {
        const statute = findStatuteById(entry.registryActId!);
        return {
          actId: entry.registryActId,
          manifestActId: entry.manifestActId,
          shortName: statute?.shortName ?? entry.registryActId,
          fullName: statute?.fullName,
          sectionCount: entry.sectionCount,
          orderCount: entry.orderCount ?? 0,
          scheduleCount: entry.scheduleCount ?? 0,
          articleCount: entry.articleCount ?? 0,
          structureProfile: entry.structure.structureProfile ?? 'sections',
          lastSectionId:
            entry.structure.sections?.lastId ??
            entry.structure.articles?.lastId,
        };
      })
      .sort((a, b) => (a.shortName ?? '').localeCompare(b.shortName ?? ''));
  }

  async suggest(
    q: string,
    countryCode = 'IN',
    limit = 10,
  ): Promise<SectionFinderSuggestion[]> {
    if (countryCode !== 'IN') {
      throw new BadRequestException('India Section Finder is only available for India (IN).');
    }

    const raw = (q ?? '').trim();
    if (raw.length < 2) {
      return [];
    }

    const parsedLimit = Math.min(Math.max(limit, 1), 25);
    const lower = raw.toLowerCase();
    const upper = raw.toUpperCase();
    const suggestions: SectionFinderSuggestion[] = [];
    const seen = new Set<string>();

    const pushSuggestion = (item: SectionFinderSuggestion) => {
      const key = item.normalizedQuery.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const safeTitle = truncateSuggestTitle(item.title);
      const title =
        safeTitle &&
        safeTitle.toLowerCase() !== item.displayLabel.toLowerCase() &&
        !item.displayLabel.toLowerCase().includes(safeTitle.toLowerCase().slice(0, 40))
          ? safeTitle
          : undefined;
      suggestions.push({ ...item, title });
    };

    // 1. Popular query prefix
    const popular = await this.popularService.getPopular(countryCode, 25);
    for (const row of popular) {
      if (
        row.normalizedQuery.startsWith(lower) ||
        row.displayLabel.toLowerCase().includes(lower)
      ) {
        pushSuggestion({
          displayLabel: row.displayLabel,
          normalizedQuery: row.normalizedQuery,
          actId: row.actId,
          sectionNumber: row.sectionNumber,
          legalAuthorityId: row.legalAuthorityId,
          title: row.title,
          matchSource: 'popular',
          score: 1 + row.searchCount / 100,
        });
      }
      if (suggestions.length >= parsedLimit) break;
    }

    // 2. In-memory curated index scan
    if (suggestions.length < parsedLimit) {
      for (const entry of SECTION_FINDER_INDEX.values()) {
        const sectionMatch =
          entry.legacySection.toUpperCase().startsWith(upper) ||
          entry.newSection.toUpperCase().startsWith(upper);
        const titleMatch =
          entry.legacyTitle.toLowerCase().includes(lower) ||
          entry.newTitle.toLowerCase().includes(lower) ||
          entry.legacyActShort.toLowerCase().includes(lower);
        if (!sectionMatch && !titleMatch) continue;

        const normalizedQuery = `${entry.legacySection} ${entry.legacyActShort}`.toLowerCase();
        pushSuggestion({
          displayLabel: `${entry.legacyActShort} §${entry.legacySection}`,
          normalizedQuery,
          actId: entry.legacyActId !== 'other' ? entry.legacyActId : undefined,
          sectionNumber: entry.legacySection,
          legalAuthorityId: entry.legalAuthorityId,
          title: entry.legacyTitle,
          legacyActShort: entry.legacyActShort,
          legacySection: entry.legacySection,
          matchSource: 'index',
          score: sectionMatch ? 0.95 : 0.75,
        });
        if (suggestions.length >= parsedLimit) break;
      }
    }

    // 3. Profile DB prefix search
    if (suggestions.length < parsedLimit) {
      const profiles = await this.profileService.suggestProfiles(
        raw,
        countryCode,
        parsedLimit,
      );
      for (const profile of profiles) {
        const normalizedQuery = `${profile.sectionNumber} ${profile.legacyActShort}`.toLowerCase();
        pushSuggestion({
          displayLabel: `${profile.legacyActShort} §${profile.sectionNumber}`,
          normalizedQuery,
          actId: profile.actId,
          sectionNumber: profile.sectionNumber,
          legalAuthorityId: profile.legalAuthorityId ?? undefined,
          title: profile.legacyTitle,
          legacyActShort: profile.legacyActShort,
          legacySection: profile.sectionNumber,
          matchSource: 'profile',
          score: 0.7,
        });
        if (suggestions.length >= parsedLimit) break;
      }
    }

    // 4. LegalAuthority corpus (pg GIN — no network)
    if (suggestions.length < parsedLimit) {
      const corpusHits = await this.hybridSearch.searchStatuteSectionsPg(raw, {
        countryCode,
        limit: parsedLimit,
      });
      for (const hit of corpusHits) {
        const parsedAuthority = parseSectionAuthorityId(hit.id);
        const actId = parsedAuthority?.actId;
        const sectionNumber = parsedAuthority?.section;
        const displayLabel =
          actId && sectionNumber
            ? `${sectionNumber} ${actId.toUpperCase()}`
            : hit.title;
        const normalizedQuery =
          actId && sectionNumber
            ? `${sectionNumber} ${actId}`.toLowerCase()
            : hit.title.toLowerCase();

        pushSuggestion({
          displayLabel,
          normalizedQuery,
          actId,
          sectionNumber,
          legalAuthorityId: hit.id,
          title: hit.title.replace(/^Section\s+\S+\s+/i, '').trim() || hit.title,
          matchSource: 'corpus',
          score: hit.score,
        });
        if (suggestions.length >= parsedLimit) break;
      }
    }

    return suggestions
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, parsedLimit);
  }

  async find(query: SectionFinderQuery): Promise<SectionFinderResult> {
    if (query.countryCode !== 'IN') {
      throw new BadRequestException(
        'India Section Finder is only available for India (IN). ' +
          'For other jurisdictions, use the general statute search.',
      );
    }

    const raw = (query.q ?? '').trim();
    if (!raw) {
      throw new BadRequestException('Query string is required');
    }

    const statuteHint = query.matterGraph?.statutes?.[0];
    const contextualQuery =
      statuteHint && !raw.toLowerCase().includes(statuteHint.act.toLowerCase())
        ? `${statuteHint.act} ${statuteHint.section ?? ''} ${raw}`.trim()
        : raw;

    const parsed = parseStatuteQuery(contextualQuery, 'IN');
    let actId = parsed.actId ?? null;
    let sectionToken = parsed.section?.toUpperCase() ?? null;

    if (query.authorityId) {
      const fromAuthority = parseSectionAuthorityId(query.authorityId);
      if (fromAuthority) {
        actId = fromAuthority.actId;
        sectionToken = fromAuthority.section;
      }
    } else if (query.actId?.trim() && query.section?.trim()) {
      actId = query.actId.trim();
      sectionToken = query.section.trim().toUpperCase();
    }

    const orderMatch = raw.match(/\border\s+([IVXLC\d]+)\b/i);
    const scheduleMatch = raw.match(/\bschedule\s+([IVXLC\d]+)\b/i);
    const articleMatch = raw.match(/\barticle\s+(\d+[A-Z]?)\b/i);

    if (orderMatch) {
      sectionToken = `order-${orderMatch[1].toUpperCase()}`;
      actId = actId ?? (raw.toLowerCase().includes('cpc') ? 'cpc' : actId);
    } else if (scheduleMatch) {
      sectionToken = `schedule-${scheduleMatch[1].toUpperCase()}`;
    } else if (articleMatch) {
      sectionToken = articleMatch[1].toUpperCase();
      actId = actId ?? 'constitution';
    }

    if (actId && sectionToken) {
      const validation = isProvisionIdValid(actId, sectionToken);
      if (!validation.valid && validation.message) {
        throw new BadRequestException(validation.message);
      }
    }

    const structureMeta = actId ? getActStructure(actId) : undefined;
    const matches: SectionFinderEntry[] = [];
    const seen = new Set<string>();
    const fallbackTrail: string[] = [];
    let aiSuggestions: SectionFinderAiSuggestion[] = [];
    let aiSuggestionModel: string | undefined;

    const pushMatch = (entry: SectionFinderEntry) => {
      if (seen.has(entry.id)) return;
      // Never treat AI-only rows as verified corpus hits.
      if (entry.matchSource === 'ai') return;
      seen.add(entry.id);
      matches.push(entry);
    };

    const bareRef = this.isBareSectionRef(query, actId, sectionToken);

    // Intent-first for natural-language queries: AI proposes → corpus verifies.
    if (!bareRef && this.aiFallback) {
      fallbackTrail.push('ai_intent');
      try {
        const proposed = await this.aiFallback.proposeCandidatesFromIntent({
          query: raw,
          countryCode: 'IN',
        });
        aiSuggestionModel = proposed.modelName;
        const unresolved: SectionFinderAiSuggestion[] = [];
        for (const candidate of proposed.suggestions) {
          const resolved = await this.resolveCandidateInCorpus(
            candidate.actId,
            candidate.section,
          );
          if (resolved) {
            pushMatch(resolved);
          } else {
            unresolved.push(candidate);
          }
        }
        aiSuggestions = unresolved;
      } catch (err) {
        this.logger.warn(
          `Intent candidate proposal failed for "${raw}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    fallbackTrail.push('db_exact');
    if (actId && sectionToken) {
      const curatedKey = `${actId.toUpperCase()}-${sectionToken}`;
      const curatedEntry = SECTION_FINDER_INDEX.get(curatedKey);
      if (curatedEntry) {
        pushMatch({ ...curatedEntry, matchSource: curatedEntry.matchSource ?? 'curated' });
      }

      const exactHit = await this.bareActLookup.lookupExactSection(actId, sectionToken, 'IN');
      const profile = await this.profileService.findProfile('IN', actId, sectionToken);

      if (profile) {
        if (exactHit.found && exactHit.authority) {
          pushMatch(
            this.profileService.mergeProfileWithAuthority(
              profile,
              exactHit.authority,
              exactHit.authority.score >= 1 ? 'corpus' : 'curated',
            ),
          );
        } else {
          pushMatch(this.profileService.profileToEntry(profile, 'curated'));
        }
      } else if (exactHit.found && exactHit.authority) {
        const built = await this.buildFromAuthority(exactHit.authority, actId, sectionToken);
        if (built) pushMatch(built);
      }
    }

    // 2. Profile lookup by new-act key (e.g. 318 BNS)
    if (matches.length === 0 && sectionToken && actId && NEW_ACT_IDS.has(actId)) {
      const profile = await this.profileService.findProfileByNewAct('IN', actId, sectionToken);
      if (profile) {
        pushMatch(this.profileService.profileToEntry(profile, 'curated'));
      }
    }

    // 3. Profile lookup by legacy act key when act token resolves differently
    if (matches.length === 0 && sectionToken && actId) {
      const profile = await this.profileService.findProfileByLegacyKey('IN', actId, sectionToken);
      if (profile) {
        pushMatch(this.profileService.profileToEntry(profile, 'curated'));
      }
    }

    // 4. Section-only DB profile fuzzy match
    if (matches.length === 0 && sectionToken && !actId) {
      const profiles = await this.prisma.statuteSectionProfile.findMany({
        where: {
          countryCode: 'IN',
          OR: [
            { sectionNumber: sectionToken },
            { newSection: { startsWith: sectionToken } },
          ],
        },
        take: 5,
      });
      for (const profile of profiles) {
        pushMatch(this.profileService.profileToEntry(profile, 'curated'));
      }
    }

    // 5. Title search in DB profiles
    if (matches.length === 0) {
      fallbackTrail.push('profile_title');
      const lower = raw.toLowerCase();
      const profiles = await this.prisma.statuteSectionProfile.findMany({
        where: {
          countryCode: 'IN',
          OR: [
            { legacyTitle: { contains: lower, mode: 'insensitive' } },
            { newTitle: { contains: lower, mode: 'insensitive' } },
          ],
        },
        take: 5,
      });
      for (const profile of profiles) {
        pushMatch(this.profileService.profileToEntry(profile, 'curated'));
      }
    }

    // 5b. Keyword corpus search (pg GIN + optional OpenSearch BM25)
    if (matches.length === 0) {
      fallbackTrail.push('keyword_corpus');
      try {
        const [pgHits, osHits] = await Promise.all([
          this.hybridSearch.searchStatuteSectionsPg(raw, { countryCode: 'IN', limit: 10 }),
          this.openSearch?.isEnabled
            ? this.openSearch.search({
                query: raw,
                countryCode: 'IN',
                authorityType: 'STATUTE_SECTION',
                limit: 10,
              })
            : Promise.resolve([]),
        ]);

        const merged = new Map<string, HybridSearchResult>();
        for (const hit of [...pgHits, ...osHits]) {
          const existing = merged.get(hit.id);
          if (!existing || hit.score > existing.score) {
            merged.set(hit.id, hit);
          }
        }

        for (const hit of [...merged.values()]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)) {
          const built = await this.buildFromAuthority(hit, actId, sectionToken);
          if (built) pushMatch(built);
        }
      } catch (err) {
        this.logger.warn(
          `Keyword corpus fallback failed for "${raw}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 6. Official remap table (legacy → new, or reverse new → legacy)
    if (matches.length === 0 && actId && sectionToken) {
      fallbackTrail.push('remap');
      const forward = findRemap('IN', actId, sectionToken);
      if (forward) {
        const built = await this.buildFromRemap(forward, 'remap');
        if (built) pushMatch(built);
      }

      if (matches.length === 0 && NEW_ACT_IDS.has(actId)) {
        const reverse = findPredecessorSection('IN', actId, sectionToken);
        if (reverse) {
          const built = await this.buildFromRemap(reverse, 'remap');
          if (built) pushMatch(built);
        }
      }
    }

    // 7. Ingested bare-act corpus (fuzzy)
    if (matches.length === 0) {
      fallbackTrail.push('bare_act_fuzzy');
      try {
        const hits = await this.bareActLookup.lookupSection(raw, 'IN');
        for (const hit of hits.slice(0, 3)) {
          const built = await this.buildFromAuthority(hit, actId, sectionToken);
          if (built) pushMatch(built);
        }
      } catch (err) {
        this.logger.warn(
          `Bare-act fallback failed for "${raw}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 8. On-demand fetch from official PDF sources (manifest-backed acts)
    if (
      matches.length === 0 &&
      actId &&
      sectionToken &&
      this.statuteIngest.isActInManifest(actId, 'IN')
    ) {
      fallbackTrail.push('on_demand');
      try {
        const resolved = await this.statuteIngest.resolveSectionOnDemand(
          actId,
          sectionToken,
          'IN',
        );
        if (resolved) {
          const built = await this.buildFromResolved(resolved);
          if (built) pushMatch(built);
        }
      } catch (err) {
        this.logger.warn(
          `On-demand section fetch failed for "${raw}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 9. AI fallback suggestions (unverified) — unified via SectionFinderAiFallbackService
    if (matches.length === 0 && aiSuggestions.length === 0 && this.aiFallback) {
      fallbackTrail.push('ai');
      try {
        const ai = await this.aiFallback.suggest({
          query: raw,
          countryCode: 'IN',
          nearMisses: actId && sectionToken
            ? [{ label: `${actId.toUpperCase()} §${sectionToken}` }]
            : undefined,
        });
        aiSuggestions = ai.suggestions;
        aiSuggestionModel = ai.modelName;
      } catch (err) {
        this.logger.warn(
          `AI fallback failed for "${raw}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Promote curated exact section when fuzzy corpus returned schedule/order junk
    if (
      actId &&
      sectionToken &&
      matches.length > 0 &&
      matches.every(
        (m) =>
          /^SCHEDULE-/i.test(m.legacySection) ||
          /^ORDER-/i.test(m.legacySection),
      )
    ) {
      const curatedKey = `${actId.toUpperCase()}-${sectionToken}`;
      const curatedEntry = SECTION_FINDER_INDEX.get(curatedKey);
      if (curatedEntry && !seen.has(curatedEntry.id)) {
        matches.unshift({ ...curatedEntry, matchSource: 'curated' });
        seen.add(curatedEntry.id);
      }
    }

    const enriched = matches.slice(0, 10).map((m) => applyAmendmentOverlay(m));

    const localized = await Promise.all(
      enriched.map(async (entry) => {
        const resolvedActId =
          actId ??
          (entry.legacyActId !== 'other'
            ? entry.legacyActId === 'ni_act'
              ? 'nia'
              : entry.legacyActId
            : null);
        const resolvedSection = sectionToken ?? entry.legacySection;
        const authorityId =
          entry.legalAuthorityId ??
          (resolvedActId && resolvedSection
            ? this.bareActLookup.buildSectionId('IN', resolvedActId, resolvedSection)
            : undefined);
        const localizedEntry = await this.translationService.localizeEntry(
          entry,
          query.locale,
          authorityId,
        );
        return sanitizeSectionFinderEntry(localizedEntry);
      }),
    );

    if (localized.length > 0) {
      await this.popularService.recordSearch(
        query.countryCode,
        raw,
        localized[0],
        localized[0].legalAuthorityId,
      );
    } else {
      await this.unmatchedService.recordUnmatched(
        query.countryCode,
        raw,
        {
          actId,
          section: sectionToken,
          actToken: parsed.actToken ?? null,
        },
        fallbackTrail,
      );
    }

    return {
      query: raw,
      countryCode: query.countryCode,
      matches: localized,
      total: matches.length,
      transitionDate: TRANSITION_DATE,
      lawCurrencyCutoff: LAW_CURRENCY_CUTOFF,
      disclaimer: DISCLAIMER,
      ...(aiSuggestions.length > 0
        ? {
            aiSuggestions,
            aiSuggestionModel,
            aiSuggestionsNote:
              'AI-suggested — not verified. Confirm via corpus/connector before treating as Verified.',
          }
        : {}),
      ...(structureMeta && actId
        ? {
            actStructure: {
              actId,
              sectionCount: structureMeta.sectionCount,
              orderCount: structureMeta.orderCount,
              scheduleCount: structureMeta.scheduleCount,
              structureProfile: structureMeta.structure.structureProfile,
              lastSectionId:
                structureMeta.structure.sections?.lastId ??
                structureMeta.structure.orders?.lastId,
            },
          }
        : {}),
    };
  }

  /** Return enriched profiles from DB (for browsing) */
  async list(countryCode: string): Promise<SectionFinderResult> {
    if (countryCode !== 'IN') {
      throw new BadRequestException('India Section Finder is only available for India (IN).');
    }

    const profiles = await this.prisma.statuteSectionProfile.findMany({
      where: { countryCode: 'IN' },
      orderBy: [{ legacyActShort: 'asc' }, { sectionNumber: 'asc' }],
    });

    const matches = profiles.map((profile: StatuteSectionProfileRow) =>
      this.profileService.profileToEntry(profile, 'curated'),
    );

    return {
      query: '',
      countryCode,
      matches,
      total: matches.length,
      transitionDate: TRANSITION_DATE,
      lawCurrencyCutoff: LAW_CURRENCY_CUTOFF,
      disclaimer: DISCLAIMER,
    };
  }

  private async buildFromResolved(
    resolved: ResolvedStatuteSection,
  ): Promise<SectionFinderEntry | null> {
    const matchSource: SectionFinderEntry['matchSource'] = resolved.fromNetwork
      ? 'network'
      : 'corpus';
    const actId = resolved.actId;
    const section = resolved.section;

    if (NEW_ACT_IDS.has(actId)) {
      const reverse = findPredecessorSection('IN', actId, section);
      if (reverse) {
        return this.buildFromRemap(reverse, matchSource);
      }

      const inferred = inferLegacyFromSectionText(resolved.fullText, actId);
      if (inferred && LEGACY_ACT_META[inferred.actId]) {
        return this.buildCrosswalkFromText(resolved, inferred, matchSource);
      }

      return this.buildNewCodeOnlyEntry(resolved, matchSource);
    }

    if (LEGACY_ACT_IDS.has(actId)) {
      const remap = findRemap('IN', actId, section);
      if (remap) {
        return this.buildFromRemap(remap, matchSource);
      }
      return this.buildLegacyOnlyEntry(resolved, actId as LegacyActId, matchSource);
    }

    return this.buildGenericStatuteEntry(resolved, matchSource);
  }

  private buildCrosswalkFromText(
    resolved: ResolvedStatuteSection,
    inferred: { actId: LegacyActId; section: string },
    matchSource: SectionFinderEntry['matchSource'],
  ): SectionFinderEntry {
    const legacyMeta = LEGACY_ACT_META[inferred.actId];
    const newMeta = NEW_ACT_META[resolved.actId as 'bns' | 'bnss' | 'bsa'];
    const isProcedural = resolved.actId === 'bnss' || inferred.actId === 'crpc';
    const repeal = detectRepealStatus(resolved.fullText);

    const base: SectionFinderEntry = {
      id: `${inferred.actId.toUpperCase()}-${inferred.section}`,
      legacyActId: inferred.actId,
      legacyActShort: legacyMeta.short,
      legacyActFull: legacyMeta.full,
      legacySection: inferred.section,
      legacyTitle: resolved.title,
      newActId: resolved.actId as 'bns' | 'bnss' | 'bsa',
      newActShort: newMeta.short,
      newActFull: newMeta.full,
      newSection: resolved.section,
      newTitle: resolved.title,
      changeType: 'renumbered',
      changeSummary:
        `${legacyMeta.short} s.${inferred.section} → ${newMeta.short} s.${resolved.section}. ` +
        'Cross-reference inferred from published bare-act text.',
      punishment: isProcedural
        ? 'N/A — procedural provision'
        : extractPunishmentHint(resolved.fullText),
      isCognizable: !isProcedural,
      isBailable: isProcedural,
      isCompoundable: false,
      trialCourt: isProcedural ? 'magistrate_first_class' : 'sessions',
      trialCourtLabel: isProcedural ? 'Judicial Magistrate' : 'Court of Session',
      bailPosture: isProcedural
        ? 'Procedural provision — bail posture depends on the substantive offence charged.'
        : 'Refer to Schedule I classification and offence gravity.',
      sectionText: normalizeSectionText(resolved.fullText),
      transitionWarning:
        'FIRs and proceedings instituted before 1 July 2024 may retain legacy act framing.',
      sourceRef: `${newMeta.short}, 2023, s.${resolved.section} (formerly ${legacyMeta.short} s.${inferred.section})`,
      transitionDate: TRANSITION_DATE,
      matchSource,
    };

    return applyAmendmentOverlay(
      repeal.isRepealed ? applyRepealFromText(base, resolved.fullText) : base,
    );
  }

  private buildNewCodeOnlyEntry(
    resolved: ResolvedStatuteSection,
    matchSource: SectionFinderEntry['matchSource'],
  ): SectionFinderEntry {
    const newMeta = NEW_ACT_META[resolved.actId as 'bns' | 'bnss' | 'bsa'];
    const isProcedural = resolved.actId === 'bnss';

    return {
      id: `${newMeta.short}-${resolved.section.toUpperCase()}`,
      legacyActId: 'ipc',
      legacyActShort: newMeta.short,
      legacyActFull: newMeta.full,
      legacySection: resolved.section,
      legacyTitle: resolved.title,
      newActId: 'unchanged',
      newActShort: '',
      newActFull: '',
      newSection: resolved.section,
      newTitle: resolved.title,
      changeType: 'new_provision',
      changeSummary: `${newMeta.short} s.${resolved.section} — ${resolved.title}. Sourced from official bare act (${resolved.sourceName}).`,
      punishment: isProcedural
        ? 'N/A — procedural provision'
        : extractPunishmentHint(resolved.fullText),
      isCognizable: !isProcedural,
      isBailable: isProcedural,
      isCompoundable: false,
      trialCourt: isProcedural ? 'magistrate_first_class' : 'sessions',
      trialCourtLabel: isProcedural ? 'Judicial Magistrate' : 'Court of Session',
      bailPosture: 'Refer to Schedule I classification and offence gravity.',
      sectionText: normalizeSectionText(resolved.fullText),
      sourceRef: `${newMeta.short}, 2023, s.${resolved.section}`,
      transitionDate: TRANSITION_DATE,
      matchSource,
    };
  }

  private buildLegacyOnlyEntry(
    resolved: ResolvedStatuteSection,
    legacyActId: LegacyActId,
    matchSource: SectionFinderEntry['matchSource'],
  ): SectionFinderEntry {
    const legacyMeta = LEGACY_ACT_META[legacyActId];
    const isProcedural = legacyActId === 'crpc';

    return {
      id: `${legacyActId.toUpperCase()}-${resolved.section.toUpperCase()}`,
      legacyActId,
      legacyActShort: legacyMeta.short,
      legacyActFull: legacyMeta.full,
      legacySection: resolved.section,
      legacyTitle: resolved.title,
      newActId: 'unchanged',
      newActShort: '',
      newActFull: '',
      newSection: resolved.section,
      newTitle: resolved.title,
      changeType: 'unchanged',
      changeSummary:
        `${legacyMeta.short} s.${resolved.section} — sourced from official bare act. ` +
        'Check BNS/BNSS/BSA equivalent separately for post-July 2024 matters.',
      punishment: isProcedural
        ? 'N/A — procedural provision'
        : extractPunishmentHint(resolved.fullText),
      isCognizable: !isProcedural,
      isBailable: isProcedural,
      isCompoundable: false,
      trialCourt: 'magistrate_first_class',
      trialCourtLabel: 'As per offence / procedure',
      bailPosture: 'Refer to the substantive provision and Schedule I classification.',
      sectionText: normalizeSectionText(resolved.fullText),
      sourceRef: resolved.sourceName,
      transitionDate: TRANSITION_DATE,
      matchSource,
    };
  }

  private buildGenericStatuteEntry(
    resolved: ResolvedStatuteSection,
    matchSource: SectionFinderEntry['matchSource'],
  ): SectionFinderEntry {
    const statute = findStatuteById(resolved.actId);
    const short = statute?.shortName ?? resolved.actId.toUpperCase();
    const full = statute?.fullName ?? short;

    return {
      id: `${short.replace(/\s+/g, '_').toUpperCase()}-${resolved.section.toUpperCase()}`,
      legacyActId: 'ni_act',
      legacyActShort: short,
      legacyActFull: full,
      legacySection: resolved.section,
      legacyTitle: resolved.title,
      newActId: 'unchanged',
      newActShort: '',
      newActFull: '',
      newSection: resolved.section,
      newTitle: resolved.title,
      changeType: 'unchanged',
      changeSummary: `${short} s.${resolved.section} — sourced from official bare act (${resolved.sourceName}).`,
      punishment: extractPunishmentHint(resolved.fullText),
      isCognizable: false,
      isBailable: true,
      isCompoundable: false,
      trialCourt: 'magistrate_first_class',
      trialCourtLabel: 'As per offence / procedure',
      bailPosture: 'Refer to the substantive provision.',
      sectionText: normalizeSectionText(resolved.fullText),
      sourceRef: resolved.sourceName,
      transitionDate: TRANSITION_DATE,
      matchSource,
    };
  }

  private async buildFromRemap(
    remap: SectionRemapEntry,
    matchSource: SectionFinderEntry['matchSource'],
  ): Promise<SectionFinderEntry | null> {
    const legacyActId = remap.from.actId as LegacyActId;
    const legacyMeta = LEGACY_ACT_META[legacyActId];
    const newActId = remap.to.actId as 'bns' | 'bnss' | 'bsa';
    const newMeta = NEW_ACT_META[newActId];
    if (!legacyMeta || !newMeta) return null;

    const [legacyHit, newHit] = await Promise.all([
      this.bareActLookup.lookupExactSection(remap.from.actId, remap.from.section, 'IN'),
      this.bareActLookup.lookupExactSection(remap.to.actId, remap.to.section, 'IN'),
    ]);

    let legacyResolved: ResolvedStatuteSection | null = null;
    let newResolved: ResolvedStatuteSection | null = null;
    if (!legacyHit.found) {
      legacyResolved = await this.statuteIngest.resolveSectionOnDemand(
        remap.from.actId,
        remap.from.section,
        'IN',
      );
    }
    if (!newHit.found) {
      newResolved = await this.statuteIngest.resolveSectionOnDemand(
        remap.to.actId,
        remap.to.section,
        'IN',
      );
    }

    const legacyTitle =
      legacyHit.authority?.title?.replace(/^Section\s+\S+\s+/i, '').trim() ??
      legacyResolved?.title ??
      remap.note ??
      'See published bare act';
    const newTitle =
      newHit.authority?.title?.replace(/^Section\s+\S+\s+/i, '').trim() ??
      newResolved?.title ??
      remap.note ??
      legacyTitle;

    const summary =
      newHit.authority?.summary ??
      newResolved?.summary ??
      legacyHit.authority?.summary ??
      legacyResolved?.summary ??
      remap.note ??
      '';

    const fullText =
      newHit.authority?.fullText ??
      newResolved?.fullText ??
      legacyHit.authority?.fullText ??
      legacyResolved?.fullText ??
      '';

    const isProcedural = ['crpc', 'bnss'].includes(remap.from.actId) || remap.to.actId === 'bnss';
    const sectionText = normalizeSectionText(fullText);
    const practiceNote = resolvePracticeNote(
      summary ? summary : `Mapped from official Schedule I crosswalk. ${remap.note ?? ''}`.trim(),
      sectionText,
    );

    return {
      id: `${legacyActId.toUpperCase()}-${remap.from.section.toUpperCase()}`,
      legacyActId,
      legacyActShort: legacyMeta.short,
      legacyActFull: legacyMeta.full,
      legacySection: remap.from.section,
      legacyTitle,
      newActId,
      newActShort: newMeta.short,
      newActFull: newMeta.full,
      newSection: remap.to.section,
      newTitle,
      changeType: 'renumbered',
      changeSummary:
        `${legacyMeta.short} s.${remap.from.section} is now ${newMeta.short} s.${remap.to.section}` +
        (remap.note ? ` — ${remap.note}` : '') +
        '.',
      punishment: isProcedural
        ? 'N/A — procedural provision'
        : extractPunishmentHint(fullText),
      isCognizable: !isProcedural,
      isBailable: isProcedural,
      isCompoundable: false,
      trialCourt: isProcedural ? 'magistrate_first_class' : 'sessions',
      trialCourtLabel: isProcedural ? 'Judicial Magistrate' : 'Court of Session',
      bailPosture: isProcedural
        ? 'Procedural provision — bail posture depends on the substantive offence charged.'
        : 'Refer to the substantive offence provision for bail classification.',
      practiceNote,
      sectionText,
      transitionWarning:
        'FIRs and proceedings instituted before 1 July 2024 may retain legacy act framing. ' +
        'Verify which code applies to your matter.',
      sourceRef: `${newMeta.short}, 2023, s.${remap.to.section} (formerly ${legacyMeta.short} s.${remap.from.section})`,
      transitionDate: TRANSITION_DATE,
      matchSource,
    };
  }

  private async buildFromAuthority(
    hit: HybridSearchResult,
    actId: string | null,
    section: string | null,
  ): Promise<SectionFinderEntry | null> {
    let resolvedActId = actId;
    let resolvedSection = section;

    if (!resolvedActId || !resolvedSection) {
      const parsed = parseSectionAuthorityId(hit.id);
      if (parsed) {
        resolvedActId = resolvedActId ?? parsed.actId;
        resolvedSection = resolvedSection ?? parsed.section;
      }
    }

    if (!resolvedActId || !resolvedSection) {
      return null;
    }

    const statute = findStatuteById(resolvedActId);

    const title = hit.title?.replace(/^Section\s+\S+\s+/i, '').trim() ?? hit.citation ?? 'Section provision';
    const isLegacy = LEGACY_ACT_IDS.has(resolvedActId);
    const isNew = NEW_ACT_IDS.has(resolvedActId);

    if (isLegacy) {
      const remap = findRemap('IN', resolvedActId, resolvedSection);
      if (remap) {
        return this.buildFromRemap(remap, 'corpus');
      }

      const legacyActId = resolvedActId as LegacyActId;
      const legacyMeta = LEGACY_ACT_META[legacyActId];
      if (!legacyMeta) return null;

      return {
        id: `${legacyActId.toUpperCase()}-${resolvedSection.toUpperCase()}`,
        legacyActId,
        legacyActShort: legacyMeta.short,
        legacyActFull: legacyMeta.full,
        legacySection: resolvedSection,
        legacyTitle: title,
        newActId: 'unchanged',
        newActShort: '',
        newActFull: '',
        newSection: resolvedSection,
        newTitle: title,
        changeType: 'unchanged',
        changeSummary: `${legacyMeta.short} s.${resolvedSection} — sourced from ingested bare-act corpus.`,
        punishment: extractPunishmentHint(hit.fullText ?? hit.summary ?? ''),
        isCognizable: legacyActId !== 'crpc',
        isBailable: legacyActId === 'crpc',
        isCompoundable: false,
        trialCourt: 'magistrate_first_class',
        trialCourtLabel: 'As per offence / procedure',
        bailPosture: 'Refer to the substantive provision and Schedule I classification.',
        sectionText: normalizeSectionText(hit.fullText ?? hit.summary ?? undefined),
        sourceRef: hit.citation ?? hit.sourceName ?? statute?.shortName ?? legacyMeta.short,
        transitionDate: TRANSITION_DATE,
        matchSource: 'corpus',
        legalAuthorityId: hit.id,
      };
    }

    if (isNew) {
      const reverse = findPredecessorSection('IN', resolvedActId, resolvedSection);
      if (reverse) {
        return this.buildFromRemap(reverse, 'corpus');
      }

      const inferred = inferLegacyFromSectionText(hit.fullText ?? hit.summary ?? '', resolvedActId);
      if (inferred) {
        return this.buildCrosswalkFromText(
          {
            actId: resolvedActId,
            countryCode: 'IN',
            section: resolvedSection,
            title,
            summary: hit.summary ?? hit.fullText?.slice(0, 400) ?? title,
            fullText: hit.fullText ?? hit.summary ?? '',
            sourceName: hit.sourceName ?? statute?.shortName ?? resolvedActId,
            sourceUrl: hit.sourceUrl ?? undefined,
            fromCache: true,
            fromNetwork: false,
          },
          inferred,
          'corpus',
        );
      }

      return this.buildNewCodeOnlyEntry(
        {
          actId: resolvedActId,
          countryCode: 'IN',
          section: resolvedSection,
          title,
          summary: hit.summary ?? hit.fullText?.slice(0, 400) ?? title,
          fullText: hit.fullText ?? hit.summary ?? '',
          sourceName: hit.sourceName ?? statute?.shortName ?? resolvedActId,
          sourceUrl: hit.sourceUrl ?? undefined,
          fromCache: true,
          fromNetwork: false,
        },
        'corpus',
      );
    }

    return this.buildGenericStatuteEntry(
      {
        actId: resolvedActId,
        countryCode: 'IN',
        section: resolvedSection,
        title,
        summary: hit.summary ?? hit.fullText?.slice(0, 400) ?? title,
        fullText: hit.fullText ?? hit.summary ?? '',
        sourceName: hit.sourceName ?? statute?.shortName ?? resolvedActId,
        sourceUrl: hit.sourceUrl ?? undefined,
        fromCache: true,
        fromNetwork: false,
      },
      'corpus',
    );
  }
}
