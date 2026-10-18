import { Injectable, Logger } from '@nestjs/common';
import { SectionFinderService } from '@/legal-search/india-section-finder/section-finder.service';
import { KeSectionFinderService } from '@/legal-search/ke-section-finder/ke-section-finder.service';
import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { truncateAtSentence } from '@/legal-search/text-truncate';
import type { LegalDomain } from './legal-research-classifier.service';
import { allowsCriminalGrounding } from '@/legal-search/legal-domain-profile';
import { extractNamedStatuteQueries } from './named-statute-extract';
import { extractStatuteReferences } from '@/ai/citations/statute-reference';
import { parseStatuteQuery, resolveAcronym } from '@/legal-search/statute-registry';

export interface ResearchSectionFinderContext {
  queries: string[];
  matches: SectionFinderEntry[];
  promptBlock: string;
  authorities: RetrievedAuthority[];
  verifiedSectionLabels: string[];
}

const SECTION_PATTERNS = [
  /\b(?:crpc|cr\.?\s*p\.?\s*c\.?)\s*§?\s*(\d+[a-z]?)/gi,
  /\b(?:ipc)\s*§?\s*(\d+[a-z]?)/gi,
  /\b(?:bnss|bns|bsa)\s*§?\s*(\d+[a-z]?)/gi,
  /\b(?:iea|evidence\s+act)\s*§?\s*(\d+[a-z]?)/gi,
  /\bsection\s+(\d+[a-z]?)\s+(?:of\s+)?(?:the\s+)?(?:crpc|ipc|bnss|bns|bsa|code of criminal procedure|indian penal code|bharatiya\s+nyaya|bharatiya\s+nagarik|bharatiya\s+sakshya)/gi,
  /\b(\d+[a-z]?)\s+(?:crpc|ipc|bnss|bns|bsa)\b/gi,
];

const KE_SECTION_PATTERNS = [
  /\bcap\.?\s*(\d+[a-z]?)\s*(?:s\.?|sec\.?|section)?\s*(\d+[a-z]?)?/gi,
  /\bsection\s+(\d+[a-z]?)\s+(?:of\s+)?(?:the\s+)?([a-z\s]+act(?:,?\s*\d{4})?)/gi,
  /\b(?:penal code|employment act|companies act|land registration act|constitution)\s*(?:s\.?|sec\.?|section|art\.?|article)?\s*(\d+[a-z]?)/gi,
  /\b(\d+[a-z]?)\s+(?:penal code|employment act|companies act)\b/gi,
];

const TOPIC_HINTS: Array<{ pattern: RegExp; queries: string[] }> = [
  { pattern: /maintenance|alimony|wife|husband|125\b|144\b/i, queries: ['144 BNSS', '125 CrPC'] },
  { pattern: /anticipatory\s+bail|438\b|482\b/i, queries: ['482 BNSS', '438 CrPC'] },
  { pattern: /\bbail\b|480\b|483\b|437\b|439\b/i, queries: ['480 BNSS', '483 BNSS'] },
  { pattern: /cheque|ni.?138|138\b/i, queries: ['138 NI Act'] },
  { pattern: /murder|302\b|101\b/i, queries: ['101 BNS', '302 IPC'] },
  { pattern: /cheat(?:ing|ed)?|420\b|318\b/i, queries: ['318 BNS', '420 IPC'] },
  { pattern: /private\s+defen[cs]e|100\b|38\b/i, queries: ['38 BNS', '100 IPC'] },
  { pattern: /theft|379\b|303\b/i, queries: ['303 BNS', '379 IPC'] },
  { pattern: /robbery|392\b|309\b/i, queries: ['309 BNS', '392 IPC'] },
  { pattern: /evidence|res\s+gestae|bsa|iea/i, queries: ['6 BSA', '6 IEA'] },
];

const KE_TOPIC_HINTS: Array<{ pattern: RegExp; queries: string[] }> = [
  { pattern: /employment|termination|redundancy|unfair dismissal/i, queries: ['Employment Act 2007 s.41'] },
  { pattern: /land registration|title|adverse possession|leasehold/i, queries: ['Land Registration Act s.26'] },
  { pattern: /murder|penal|criminal|theft|robbery/i, queries: ['Penal Code s.203', 'Cap 63 s.203'] },
  { pattern: /company|director|shareholder|insolvency/i, queries: ['Companies Act 2015 s.2'] },
  { pattern: /constitutional|fair hearing|article 47|bill of rights/i, queries: ['Constitution Article 47'] },
];

@Injectable()
export class ResearchSectionFinderGroundingService {
  private readonly logger = new Logger(ResearchSectionFinderGroundingService.name);

  constructor(
    private readonly sectionFinder: SectionFinderService,
    private readonly keSectionFinder: KeSectionFinderService,
  ) {}

  extractQueries(query: string, legalDomain?: LegalDomain, countryCode = 'IN'): string[] {
    const code = countryCode.toUpperCase();
    const queries = new Set<string>();
    const haystack = query.trim();
    if (!haystack) return [];

    const topicHints = code === 'KE' ? KE_TOPIC_HINTS : TOPIC_HINTS;
    const patterns = code === 'KE' ? KE_SECTION_PATTERNS : SECTION_PATTERNS;
    const named = extractNamedStatuteQueries(haystack);
    for (const token of named) queries.add(token);

    // Named statutes are a targeted check — do not dump topic-hint sections.
    if (named.length === 0) {
      if (code === 'IN' && allowsCriminalGrounding(legalDomain, haystack)) {
        for (const hint of topicHints) {
          if (hint.pattern.test(haystack)) {
            for (const q of hint.queries) queries.add(q);
          }
        }
      }

      if (code === 'KE') {
        for (const hint of topicHints) {
          if (hint.pattern.test(haystack)) {
            for (const q of hint.queries) queries.add(q);
          }
        }
      }

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        for (const m of haystack.matchAll(pattern)) {
          const token = m[0].trim();
          if (token.length >= 4) queries.add(token);
        }
      }
    }

    return [...queries].slice(0, 12);
  }

  async buildContext(
    query: string,
    legalDomain?: LegalDomain,
    countryCode = 'IN',
  ): Promise<ResearchSectionFinderContext> {
    const code = countryCode.toUpperCase();
    if (code !== 'IN' && code !== 'KE') {
      // No Section Finder corpus exists for this jurisdiction. Ground what can
      // be grounded — the statute's identity from the registry — rather than
      // leaving the run with no statutory anchor at all.
      return this.buildRegistryGrounding(query, code);
    }
    const queries = this.extractQueries(query, legalDomain, code);
    const matchMap = new Map<string, SectionFinderEntry>();

    for (const q of queries) {
      try {
        const result =
          code === 'KE'
            ? await this.keSectionFinder.find({ q, countryCode: 'KE' })
            : await this.sectionFinder.find({ q, countryCode: 'IN' });
        for (const match of result.matches.slice(0, 2)) {
          if (this.isVerifiedCorpusMatch(match)) matchMap.set(match.id, match);
        }
      } catch (err) {
        this.logger.warn(
          `Section Finder lookup failed for "${q}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const allowBroadLookup =
      code === 'IN'
        ? allowsCriminalGrounding(legalDomain, query)
        : code === 'KE';

    if (
      matchMap.size === 0 &&
      query.trim().length >= 40 &&
      allowBroadLookup &&
      extractNamedStatuteQueries(query).length === 0
    ) {
      try {
        const result =
          code === 'KE'
            ? await this.keSectionFinder.find({
                q: query.slice(0, 280),
                countryCode: 'KE',
              })
            : await this.sectionFinder.find({
                q: query.slice(0, 280),
                countryCode: 'IN',
              });
        for (const match of result.matches.slice(0, 3)) {
          if (this.isVerifiedCorpusMatch(match)) matchMap.set(match.id, match);
        }
      } catch (err) {
        this.logger.warn(
          `Section Finder fact-pattern lookup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const matches = [...matchMap.values()];
    const verifiedSectionLabels: string[] = [];
    const header =
      code === 'KE'
        ? 'SECTION FINDER VERIFIED (Kenya Law — prefer consolidated statute text and Cap citations):'
        : 'SECTION FINDER VERIFIED (same source as India Section Finder UI — prefer current BNS/BNSS/BSA successors):';
    const lines: string[] = [header];

    for (const match of matches.slice(0, 6)) {
      const crosswalk =
        code === 'KE' || match.newActShort === 'unchanged' || !match.newSection
          ? `${match.legacyActShort} §${match.legacySection}`
          : `${match.legacyActShort} §${match.legacySection} → ${match.newActShort} §${match.newSection}`;
      verifiedSectionLabels.push(crosswalk);
      lines.push(`- ${crosswalk}: ${match.newTitle || match.legacyTitle}`);
      if (match.sectionText) {
        lines.push(`  Section text: ${truncateAtSentence(match.sectionText, 500)}`);
      } else if (match.changeSummary) {
        lines.push(`  Summary: ${truncateAtSentence(match.changeSummary, 220)}`);
      }
      if (match.practiceNote) {
        lines.push(`  Practice note: ${truncateAtSentence(match.practiceNote, 180)}`);
      }
      if (match.bailPosture && code === 'IN') {
        lines.push(
          `  Bail/forum: ${match.trialCourtLabel} · ${match.bailPosture.slice(0, 120)}`,
        );
      }
      if (match.transitionWarning) {
        lines.push(`  Note: ${match.transitionWarning}`);
      }
    }

    if (matches.length === 0) {
      lines.push(
        code === 'KE'
          ? '(No Section Finder match for this query — rely on retrieved Kenya Law corpus and do not invent Cap or section numbers.)'
          : '(No Section Finder match for this query — rely on retrieved corpus authorities and do not invent BNS/BNSS/BSA section numbers.)',
      );
    } else if (code === 'IN') {
      lines.push(
        'Cite current-code successors (BNS/BNSS/BSA) as primary law for post-1-July-2024 facts. Legacy IPC/CrPC/IEA may be noted as predecessors only.',
      );
    } else if (code === 'KE') {
      lines.push(
        'Cite the consolidated Kenya Law version shown above. Note commencement dates and subsidiary legislation where relevant.',
      );
    }

    return {
      queries,
      matches,
      promptBlock: lines.join('\n'),
      authorities: matches.slice(0, 6).map((m) => this.toAuthority(m, code)),
      verifiedSectionLabels,
    };
  }

  /**
   * Statute grounding for jurisdictions without a Section Finder corpus.
   *
   * The registry can confirm an Act's identity (official name, year, status,
   * official source) even when we hold no section text. That is genuine
   * grounding against inventing statutes, and the prompt block is explicit that
   * the section *wording* was not retrieved so it must not be quoted.
   */
  private buildRegistryGrounding(query: string, code: string): ResearchSectionFinderContext {
    const references = extractStatuteReferences(query, code);
    const authorities: RetrievedAuthority[] = [];
    const verifiedSectionLabels: string[] = [];
    const lines: string[] = [
      `STATUTE REGISTRY VERIFIED (${code} — Act identity confirmed; section text NOT retrieved):`,
    ];
    const seen = new Set<string>();

    for (const reference of references) {
      const statute =
        resolveAcronym(reference.act, code) ?? parseStatuteQuery(reference.raw, code).statute;
      if (!statute || statute.countryCode !== code) continue;

      const sectionNumber = Number.parseInt(reference.section, 10);
      const withinAct =
        !statute.sectionCount ||
        !Number.isFinite(sectionNumber) ||
        sectionNumber <= statute.sectionCount;
      if (!withinAct) {
        lines.push(
          `- ${statute.shortName} s.${reference.section}: NOT FOUND — the Act has ${statute.sectionCount} sections. Treat this section number as incorrect.`,
        );
        continue;
      }

      const citation = `${statute.shortName} s.${reference.section}`;
      if (seen.has(citation)) continue;
      seen.add(citation);
      verifiedSectionLabels.push(citation);

      const statusNote =
        statute.status && statute.status !== 'active' ? ` (status: ${statute.status})` : '';
      lines.push(
        `- ${citation} — ${statute.fullName}${statute.year ? `, ${statute.year}` : ''}${statusNote}${
          statute.sourceUrl ? ` · ${statute.sourceUrl}` : ''
        }`,
      );

      authorities.push({
        id: `statute-registry-${statute.id}-${reference.section}`,
        title: `${citation}: ${statute.fullName}`,
        citation,
        sourceName: `${code} statute registry`,
        summary: `Act identity confirmed from the statute registry. Section text was not retrieved — do not quote wording for this section.`,
        fullText: null,
        sourceUrl: statute.sourceUrl ?? null,
        sourceTier: 'primary',
        authorityType: 'STATUTE',
        score: 0.8,
        isRepealed: statute.status === 'repealed',
        repealNotes: statute.repealedBy ? `Repealed by ${statute.repealedBy}` : null,
      });
    }

    if (authorities.length === 0) {
      lines.push(
        `(No registry match for this query — do not invent ${code} act names, years, or section numbers.)`,
      );
    } else {
      lines.push(
        'The Act names, years, and section numbers above are confirmed. Section wording was NOT retrieved: describe the effect of the provision as analysis, do not present it as a quotation.',
      );
    }

    return {
      queries: references.map((reference) => reference.raw),
      matches: [],
      promptBlock: lines.join('\n'),
      authorities,
      verifiedSectionLabels,
    };
  }

  /** AI-only / unverified rows must never enter research prompt grounding. */
  private isVerifiedCorpusMatch(match: SectionFinderEntry): boolean {
    if (match.matchSource === 'ai') return false;
    if (match.verificationState === 'ai_suggested') return false;
    return true;
  }

  private toAuthority(match: SectionFinderEntry, countryCode: string): RetrievedAuthority {
    const isCurrent = match.newActId !== 'unchanged' && Boolean(match.newSection);
    const actShort = isCurrent ? match.newActShort : match.legacyActShort;
    const section = isCurrent ? match.newSection : match.legacySection;
    const title = isCurrent ? match.newTitle : match.legacyTitle;
    const citation = `${actShort} §${section}`;
    const summaryParts = [
      match.changeSummary,
      match.practiceNote,
      countryCode === 'IN' && match.bailPosture ? `Bail: ${match.bailPosture}` : null,
      countryCode === 'IN' && match.punishment ? `Punishment: ${match.punishment}` : null,
    ].filter(Boolean);

    return {
      id: `section-finder-${match.id}`,
      title: `${citation}: ${title}`,
      citation,
      sourceName: countryCode === 'KE' ? 'Kenya Section Finder' : 'India Section Finder',
      summary: summaryParts.join(' · ') || null,
      fullText: match.sectionText ?? null,
      sourceUrl: match.sourceRef?.startsWith('http') ? match.sourceRef : null,
      sourceTier: 'primary',
      authorityType: 'STATUTE',
      score: 1,
      isRepealed: false,
      repealNotes:
        isCurrent && match.legacyActShort
          ? `Predecessor: ${match.legacyActShort} §${match.legacySection}`
          : null,
    };
  }
}
