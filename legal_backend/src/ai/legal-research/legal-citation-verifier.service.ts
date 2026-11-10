import { SourceIntegrityService } from './source-integrity.service';
import { citationProposition as propositionContaining } from '@/ai/citations/citation-proposition';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { detectChapterMismatch } from '@/ai/legal-section-chapters';
import type {
  CitationAuditResult,
  CitationAuditEntry,
  LegalAuthority,
  LegalClaim,
  SourceQuality,
} from './legal-authority.types';
import { validateCitationContract } from '@/ai/citations/citation-contract';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';

/**
 * Patterns to detect case citations in markdown output.
 * Covers India (SCC/AIR), US, UK, and Kenya formats.
 */
const CASE_CITATION_PATTERNS: RegExp[] = [
  /\b(?:Petition|Civil Appeal|Criminal Appeal|Civil Application)\s+(?:No\.?\s*)?[A-Z]?\d+\s+of\s+\d{4}/gi,
  /\(\d{4}\)\s+\d+\s+SCC\s+\d+/g,           // India: (2010) 11 SCC 441
  /AIR\s+\d{4}\s+[A-Za-z]+\s+\d+/g,          // India: AIR 1980 SC 1789
  /\b\d+\s+U\.S\.\s+\d+/g,                    // US: 410 U.S. 113
  /\b\d+\s+F\.\s?(?:2d|3d|4th|5th)\s+\d+/g,  // US: 901 F.3d 1
  /\[\d{4}\]\s+(?:UKSC|UKHL|EWCA|EWHC)\s+\w+/g, // UK
  /\[\d{4}\]\s+eKLR(?:\s*(?:(?:at\s*)?(?:para(?:graph)?|¶)\s*\d+[A-Za-z]?|\[\s*\d+[A-Za-z]?\s*\]))?/gi,
  /\[\d{4}\]\s+(?:KESC|KECA|KEHC)\s+\d+(?:\s*\(KLR\))?(?:\s*(?:(?:at\s*)?(?:para(?:graph)?|¶)\s*\d+[A-Za-z]?|\[\s*\d+[A-Za-z]?\s*\]))?/gi,
];

/**
 * Patterns to detect statute citations, e.g. "s.138", "Section 138", "BNSS s.461".
 */
const STATUTE_CITATION_PATTERN =
  /(?:Article\s+\d+[A-Z]?(?:\(\d+\))*(?:\s+of\s+the\s+Constitution(?:\s+of\s+Kenya)?)?|(?:Constitution(?:\s+of\s+Kenya)?(?:,\s*2010)?\s*,?\s*)Article\s+\d+[A-Z]?(?:\(\d+\))*|(?:[A-Z][A-Za-z’'(). -]+?\s+Act(?:,\s*(?:No\.\s*\d+\s+of\s+)?\d{4})?(?:,\s*Cap\.?\s*\d+[A-Z]?)?|Cap\.?\s*\d+[A-Z]?|Legal\s+Notice\s+(?:No\.?\s*)?\d+(?:\s+of\s+\d{4})?)\s*,?\s*(?:§|[Ss](?:ection|\.)\s*)\d+[A-Z]?(?:\(\d+[A-Za-z]?\))*|(?:(?:BNSS|BNS|BSA|CrPC|IPC|NI Act|NDPS|POCSO|PMLA|IBC|Contract Act|Constitution|CPC)\s*)?(?:§|[Ss](?:ection|\.)\s*)\d+(?:[A-Z])?(?:\(\d+[A-Za-z]?\))*)/gi;

const ACT_ID_MAP: Record<string, string> = {
  BNSS: 'bnss',
  BNS: 'bns',
  BSA: 'bsa',
  CRPC: 'crpc',
  IPC: 'ipc',
  'NI ACT': 'ni_act',
  NDPS: 'ndps',
  POCSO: 'pocso',
  PMLA: 'pmla',
  'CONTRACT ACT': 'contract-act',
  'CONTRACTS ACT': 'contract-act',
  'INDIAN CONTRACT ACT': 'contract-act',
};

export function extractCaseCitations(markdown: string): string[] {
  const found = new Set<string>();
  for (const pattern of CASE_CITATION_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    const matches = markdown.match(globalPattern);
    if (matches) matches.forEach((m) => found.add(m.trim()));
  }
  return [...found];
}

export function extractStatuteCitations(markdown: string): string[] {
  // "S." inside the U.S. reporter is not a shorthand statutory section.
  const statuteText = markdown.replace(/\b\d+\s+U\.?\s*S\.?\s+\d+/gi, match => ' '.repeat(match.length));
  const matches = statuteText.match(STATUTE_CITATION_PATTERN);
  return matches ? [...new Set(matches.map((m) => m.trim()))] : [];
}

export function parseStatuteCitation(citation: string): {
  actId?: string;
  actName?: string;
  actYear?: number;
  capNumber?: string;
  instrumentType?: 'CONSTITUTION' | 'ACT' | 'LEGAL_NOTICE';
  instrumentNumber?: string;
  section: string;
} {
  const act = citation.match(/\b(BNSS|BNS|BSA|CrPC|IPC|NI\s+Act|NDPS|POCSO|PMLA|Indian\s+Contract\s+Act|Contract\s+Act)\b/i)?.[1]
    ?.replace(/\s+/g, ' ')
    .toUpperCase();
  const article = citation.match(/\bArticle\s+(\d+[A-Z]?(?:\(\d+\))*)/i)?.[1];
  const section =
    article ??
    citation.match(/(?:§|[Ss](?:ection|\.)\s*)(\d+[A-Z]?(?:\(\d+[A-Za-z]?\))*)/i)?.[1] ??
    '';
  const capNumber = citation.match(/\bCap\.?\s*(\d+[A-Z]?)\b/i)?.[1]?.toUpperCase();
  const legalNotice = citation.match(/\bLegal\s+Notice\s+(?:No\.?\s*)?(\d+)(?:\s+of\s+(\d{4}))?/i);
  const namedAct = citation.match(/\b([A-Z][A-Za-z’'(). -]+?\s+Act)\b(?:,\s*(?:No\.\s*\d+\s+of\s+)?(\d{4}))?/);
  const constitution = /\bConstitution(?:\s+of\s+Kenya)?\b|\bArticle\s+\d+.+\bConstitution\b/i.test(citation);
  return {
    actId: act ? ACT_ID_MAP[act] : undefined,
    actName: constitution
      ? 'Constitution of Kenya'
      : legalNotice
        ? 'Legal Notice'
        : namedAct?.[1]?.trim(),
    actYear: constitution ? 2010 : Number(namedAct?.[2] ?? legalNotice?.[2]) || undefined,
    capNumber,
    instrumentType: constitution ? 'CONSTITUTION' : legalNotice ? 'LEGAL_NOTICE' : namedAct || capNumber ? 'ACT' : undefined,
    instrumentNumber: legalNotice?.[1],
    section,
  };
}

/**
 * Normalises a citation string for fuzzy matching (lowercase, collapse spaces,
 * strip punctuation differences).
 */
function normaliseCitation(citation: string): string {
  return citation.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:]/g, '').trim();
}

function citationIdentityMatches(authority: LegalAuthority, citation: string): boolean {
  const needle = normaliseCitation(citation)
    .replace(/\b(?:at\s*)?(?:para(?:graph)?|¶)\s*\d+[a-z]?\b/g, '')
    .replace(/\[\s*\d+[a-z]?\s*\]$/g, '')
    .trim();
  return [authority.citation, authority.neutralCitation, authority.title]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const candidate = normaliseCitation(value);
      return candidate === needle || candidate.includes(needle) || needle.includes(candidate);
    });
}

function citationPinpoint(citation: string): string | undefined {
  const match = citation.match(/(?:at\s*)?(?:para(?:graph)?|¶)\s*(\d+[A-Za-z]?)|\[\s*(\d+[A-Za-z]?)\s*\]\s*$/i);
  return match ? `paragraph ${match[1] ?? match[2]}` : undefined;
}

/** Resolve a shorthand only within one explicitly named, retrieved enactment. */
export function contextualStatuteAuthority(citation: string, query: string, authorities: LegalAuthority[]): LegalAuthority | undefined {
  const parsed = parseStatuteCitation(citation);
  if (!parsed.section || parsed.actId || parsed.actName) return undefined;
  const root = parsed.section.split('(')[0];
  const sectionAuthorities = authorities.flatMap(a => {
    if (a.authorityType !== 'STATUTE' || a.section || a.sourceProvenance?.completeness !== 'COMPLETE') return [a];
    const passage = a.sourcePassages?.find(p => p.sourcePinpoint && p.paragraph === `Section ${root}`);
    if (!passage) return [a];
    const identity = parseStatuteCitation(a.citation ?? a.title);
    return [{ ...a, id: `${a.id}-source-s${root}`, actName: a.actName ?? identity.actName,
      actYear: a.actYear ?? identity.actYear, section: root, extractedText: passage.text,
      pinpoint: passage.paragraph, sourcePassages: [passage] }];
  });
  const candidates = sectionAuthorities.filter(a => {
    if (a.authorityType !== 'STATUTE' || (a.section ?? parseStatuteCitation(a.citation ?? a.title).section).split('(')[0] !== root) return false;
    const act = a.actName ?? parseStatuteCitation(a.citation ?? a.title).actName;
    if (!act || !normaliseCitation(query).includes(normaliseCitation(act))) return false;
    return [...parsed.section.matchAll(/\((\d+[A-Za-z]?)\)/g)].every(m => new RegExp('\\(\\s*' + m[1] + '\\s*\\)').test(a.extractedText));
  });
  const identities = new Set(candidates.map(a => a.sourceProvenance?.documentHash ?? `${normaliseCitation(parseStatuteCitation(a.actName ?? a.citation ?? a.title).actName ?? a.actName ?? '')}:${a.actYear ?? ''}`));
  return identities.size === 1 ? candidates[0] : undefined;
}

/**
 * Computes overall source quality from the retrieved authorities used to ground
 * the answer. Official/primary = reliabilityRank <= 2 or official flag.
 */
function computeSourceQuality(authorities: LegalAuthority[]): SourceQuality {
  if (authorities.length === 0) return 'INSUFFICIENT';
  const hasPrimary = authorities.some((a) => a.official || a.reliabilityRank <= 2);
  const hasSecondary = authorities.some((a) => !a.official && a.reliabilityRank >= 3);
  if (hasPrimary && hasSecondary) return 'MIXED_PRIMARY_SECONDARY';
  if (hasPrimary) return 'OFFICIAL_PRIMARY';
  return 'SECONDARY_ONLY';
}

export type LegalCitationVerifyParams = {
  markdown: string;
  authorities: LegalAuthority[];
  jurisdiction: string;
  taskType: string;
  query?: string;
  legalDomain?: string;
};

function quotedPassage(text: string): string | undefined {
  return text.match(/["“]([^"”]{12,})["”]/)?.[1]?.trim();
}

@Injectable()
export class LegalCitationVerifierService {
  private readonly logger = new Logger(LegalCitationVerifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bareActLookup: BareActLookupService,
    @Optional() private readonly relevance?: RelevanceVerificationService,
  ) {}

  /**
   * Post-generation audit pass.
   *
   * 1. Extracts all case and statute citations from the generated markdown.
   * 2. Checks each against the retrieved authorities list.
   * 3. For misses, checks the durable LegalAuthorityRecord registry.
   * 4. Unverified case citations are replaced with a [Needs verification] label
   *    rather than silently removed, so the attorney can spot them.
   * 5. Returns CitationAuditResult with the patched markdown and audit metadata.
   */
  async verifyLegalResearchOutput(
    params: LegalCitationVerifyParams,
  ): Promise<CitationAuditResult> {
    const { markdown, authorities, jurisdiction } = params;

    const caseCitations = extractCaseCitations(markdown);
    const statuteCitations = extractStatuteCitations(markdown);
    const allCitations = [...caseCitations, ...statuteCitations];

    if (allCitations.length === 0) {
      return {
        verifiedMarkdown: markdown,
        claims: [],
        unsupportedClaims: [],
        citationCount: 0,
        verifiedCitationCount: 0,
        warnings: [],
        totalClaims: 0,
        supportedClaims: 0,
        totalCitations: 0,
        verifiedCitations: 0,
        unverifiedCitations: [],
        sourceQuality: computeSourceQuality(authorities),
        foundCitationCount: 0,
        citations: [],
        rejectedCitations: [],
        verificationGaps: [],
        safeForReliance: false,
      };
    }

    // Build normalised lookup from retrieved authorities.
    const authorityNorms = new Map<string, LegalAuthority>();
    for (const auth of authorities) {
      if (auth.citation) {
        authorityNorms.set(normaliseCitation(auth.citation), auth);
      }
      authorityNorms.set(normaliseCitation(auth.title), auth);
    }
    const findAuthority = (citation: string) =>
      authorities.find((authority) => citationIdentityMatches(authority, citation));

    // For any citation not matched in retrieved authorities, check the registry.
    const unmatched = caseCitations.filter(
      (c) => !findAuthority(c),
    );

    let registryRecords: Array<{ citation: string | null; title: string; neutralCitation?: string | null }> = [];
    if (unmatched.length > 0) {
      try {
        registryRecords = await this.prisma.legalAuthorityRecord.findMany({
          where: {
            jurisdiction: { in: [jurisdiction.toUpperCase(), jurisdiction] },
            OR: unmatched.flatMap((c) => [
              { citation: { contains: c.slice(0, 30), mode: 'insensitive' as const } },
              { neutralCitation: { contains: c.replace(/\s+/g, '').slice(0, 16), mode: 'insensitive' as const } },
            ]),
          },
          select: { citation: true, title: true, neutralCitation: true },
        });

        const authorityRows = await this.prisma.legalAuthority.findMany({
          where: {
            countryCode: jurisdiction.toUpperCase(),
            authorityType: 'CASE_LAW',
            OR: unmatched.flatMap((c) => [
              { citation: { contains: c.slice(0, 30), mode: 'insensitive' as const } },
              { neutralCitation: { contains: c.replace(/\s+/g, '').slice(0, 16), mode: 'insensitive' as const } },
            ]),
          },
          select: { citation: true, title: true, neutralCitation: true },
          take: 50,
        });
        registryRecords.push(...authorityRows);
      } catch (err) {
        this.logger.warn(
          `LegalAuthorityRecord query failed (table may not exist yet): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const registryNorms = new Set(
      registryRecords
        .flatMap((r) => [r.citation, r.title, r.neutralCitation].filter(Boolean))
        .map((s) => normaliseCitation(s!)),
    );

    // Classify each case citation.
    const claims: LegalClaim[] = [];
    const unsupportedClaims: LegalClaim[] = [];
    const warnings: string[] = [];
    let verifiedCount = 0;
    let foundCount = 0;
    const renderableCitations: CitationAuditEntry[] = [];
    const rejectedCitations: CitationAuditEntry[] = [];

    for (const citation of caseCitations) {
      const norm = normaliseCitation(citation);
      const matchedAuthority = findAuthority(citation);
      const inAuthorities = Boolean(matchedAuthority);
      const inRegistry = registryNorms.has(norm);
      const audit = this.auditCitation({
        citation,
        authority: matchedAuthority,
        found: inAuthorities || inRegistry,
        proposition: propositionContaining(markdown, citation),
        query: params.query ?? markdown,
        legalDomain: params.legalDomain,
        expectedJurisdiction: jurisdiction,
      });
      if (audit.found) foundCount++;
      if (audit.verified || audit.sourceVerified) { renderableCitations.push(audit); if (!audit.currentLawVerified) warnings.push(`Source checked for ${citation}; current-law treatment remains unverified.`); }
      else rejectedCitations.push(audit);

      const claim: LegalClaim = {
        claim: propositionContaining(markdown, citation),
        requiredAuthorityType: 'CASE',
        citations: [citation],
        supported: audit.verified || audit.sourceVerified === true,
        confidence: inAuthorities ? 'high' : inRegistry ? 'medium' : 'low',
        issue: audit.verified || audit.sourceVerified ? undefined : audit.missingReasons.join(' '),
      };

      claims.push(claim);
      if (audit.verified) {
        verifiedCount++;
      } else if (!audit.sourceVerified) {
        unsupportedClaims.push(claim);
        warnings.push(
          `Case citation blocked: "${citation}" — ${audit.missingReasons.join('; ')}`,
        );
      }
    }

    let statuteVerifiedCount = 0;
    for (const citation of statuteCitations) {
      const parsed = parseStatuteCitation(citation);
      const unsupported = (reason: string) => {
        const claim: LegalClaim = {
          claim: citation,
          requiredAuthorityType: 'STATUTE',
          citations: [citation],
          supported: false,
          confidence: 'low',
          issue: reason,
        };
        claims.push(claim);
        unsupportedClaims.push(claim);
        warnings.push(reason);
      };

      const retrievedAuthority = findAuthority(citation) ?? contextualStatuteAuthority(citation, params.query ?? '', authorities);
      if ((!parsed.actId && !retrievedAuthority) || !parsed.section) {
        unsupported(`Statute citation lacks an act name and cannot be corpus-verified: "${citation}"`);
        continue;
      }

      const normalised = normaliseCitation(citation);
      const inRetrieved =
        Boolean(retrievedAuthority) ||
        [...authorityNorms.keys()].some((key) => key.includes(normalised));
      let foundInCorpus = false;
      let supportExcerpt: string | undefined;
      let corpusAuthority: LegalAuthority | undefined;
      try {
        if (!parsed.actId) throw new Error('No legacy bare-act identifier; using retrieved Kenya authority');
        const lookup = await this.bareActLookup.lookupExactSection(
          parsed.actId,
          parsed.section,
          jurisdiction,
        );
        foundInCorpus = lookup.found;
        supportExcerpt = lookup.authority?.fullText ?? lookup.authority?.summary ?? undefined;
        if (lookup.authority) {
          corpusAuthority = {
            id: lookup.authority.id,
            jurisdiction: lookup.authority.jurisdiction ?? jurisdiction,
            authorityType: 'STATUTE',
            sourceName: lookup.authority.sourceName ?? 'Bare-act corpus',
            sourceUrl: lookup.authority.sourceUrl ?? undefined,
            official: true,
            title: lookup.authority.title,
            citation: lookup.authority.citation ?? undefined,
            extractedText: lookup.authority.fullText ?? lookup.authority.summary ?? '',
            reliabilityRank: 1,
            currentLawStatus: lookup.authority.isRepealed ? 'SUPERSEDED' : 'GOOD_LAW',
            section: parsed.section,
          };
        }
      } catch (err) {
        if (parsed.actId) {
        this.logger.warn(
          `Bare-act lookup failed for ${citation}: ${err instanceof Error ? err.message : String(err)}`,
        );
        }
      }

      const legacyActId = parsed.actId;
      const mismatch = legacyActId
        ? detectChapterMismatch({
            markdown,
            actId: legacyActId,
            section: parsed.section,
          })
        : undefined;

      if (mismatch) {
        unsupported(`Statute citation proposition mismatch for "${citation}": ${mismatch}`);
        continue;
      }

      const matchedAuthority =
        retrievedAuthority ??
        authorities.find((authority) =>
          [authority.citation, authority.title]
            .filter(Boolean)
            .some((value) => normaliseCitation(value!).includes(normalised)),
        ) ?? corpusAuthority;
      const audit = this.auditCitation({
        citation,
        authority: matchedAuthority,
        found: inRetrieved || foundInCorpus,
        proposition: propositionContaining(markdown, citation),
        query: params.query ?? markdown,
        legalDomain: params.legalDomain,
        expectedJurisdiction: jurisdiction,
      });
      if (audit.found) foundCount++;
      if (audit.verified || audit.sourceVerified) { renderableCitations.push(audit); if (!audit.currentLawVerified) warnings.push(`Source checked for ${citation}; current-law treatment remains unverified.`); }
      else rejectedCitations.push(audit);
      const claim: LegalClaim = {
        claim: propositionContaining(markdown, citation),
        requiredAuthorityType: 'STATUTE',
        citations: [citation],
        supported: audit.verified || audit.sourceVerified === true,
        supportExcerpt,
        confidence: inRetrieved ? 'high' : foundInCorpus ? 'medium' : 'low',
        issue: audit.verified || audit.sourceVerified ? undefined : audit.missingReasons.join(' '),
      };
      claims.push(claim);
      if (audit.verified) {
        statuteVerifiedCount++;
      } else if (!audit.sourceVerified) {
        unsupportedClaims.push(claim);
        warnings.push(`Statute citation blocked: "${citation}" — ${audit.missingReasons.join('; ')}`);
      }
    }

    // Fail closed: rejected citations must not remain as ordinary authoritative
    // prose in the published memo.
    const verifiedMarkdown = this.withholdRejectedCitationPropositions(
      markdown,
      rejectedCitations,
    );

    const verifiedCitationCount = verifiedCount + statuteVerifiedCount;

    this.logger.debug(
      `Citation audit: ${caseCitations.length} case citations, ${verifiedCount} verified, ` +
        `${unsupportedClaims.length} unverified. ${statuteVerifiedCount}/${statuteCitations.length} statute citations verified.`,
    );

    const totalCitations = allCitations.length;
    const unverifiedCitations = unsupportedClaims.map((c) => c.claim);

    return {
      verifiedMarkdown,
      claims,
      unsupportedClaims,
      citationCount: allCitations.length,
      verifiedCitationCount,
      warnings,
      totalClaims: claims.length,
      supportedClaims: claims.filter((c) => c.supported).length,
      totalCitations,
      verifiedCitations: verifiedCitationCount,
      unverifiedCitations,
      sourceQuality: computeSourceQuality(authorities),
      foundCitationCount: foundCount,
      citations: renderableCitations,
      rejectedCitations,
      verificationGaps: rejectedCitations.map((citation) => ({
        citation: citation.citation,
        reasons: citation.missingReasons,
      })),
      safeForReliance:
        renderableCitations.length > 0 && rejectedCitations.length === 0 && renderableCitations.every(entry => entry.verified),
      kenyaVerified:
        jurisdiction.toUpperCase() === 'KE'
          ? renderableCitations.length > 0 &&
            rejectedCitations.length === 0 &&
            renderableCitations.every((entry) => entry.verified && Boolean(entry.deepLinkUrl ?? entry.url))
          : undefined,
      verificationDowngradeReasons:
        jurisdiction.toUpperCase() === 'KE'
          ? [
              ...(renderableCitations.length === 0 ? ['No Kenya authority passed verification.'] : []),
              ...(rejectedCitations.length > 0 ? ['One or more Kenya citations failed verification.'] : []),
              ...(renderableCitations.some((entry) => !entry.deepLinkUrl && !entry.url)
                ? ['One or more Kenya citations lacks a source URL or exact deep link.']
                : []),
            ]
          : undefined,
    };
  }

  private auditCitation(input: {
    citation: string;
    authority?: LegalAuthority;
    found: boolean;
    proposition: string;
    query: string;
    legalDomain?: string;
    expectedJurisdiction: string;
  }): CitationAuditEntry {
    const authority = input.authority;
    const kind =
      authority?.authorityType === 'STATUTE'
        ? 'statute'
        : authority?.authorityType === 'REGULATION' || authority?.authorityType === 'RULE'
          ? 'regulation'
          : 'case';
    const quote = quotedPassage(input.proposition);
    const quoteVerified =
      Boolean(quote) &&
      Boolean(authority?.extractedText.toLowerCase().includes(quote!.toLowerCase()));
    const pinpoint =
      authority?.pinpoint ??
      citationPinpoint(input.citation) ??
      input.proposition.match(/\b(?:para(?:graph)?|¶)\s*\d+[A-Za-z]?\b/i)?.[0];
    const section =
      authority?.section ??
      input.citation.match(/(?:§|[Ss](?:ection|\.)\s*)(\d+[A-Z]?(?:\(\d+\))?)/)?.[1];
    const actYear =
      authority?.actYear ??
      (Number(
          `${authority?.actName ?? ''} ${authority?.title ?? ''} ${authority?.citation ?? ''}`.match(
            /\b(?:18|19|20)\d{2}\b/,
          )?.[0] ?? 0,
        ) || undefined);
    const actName =
      authority?.actName ??
      (/\bConstitution(?:\s+of\s+Kenya)?\b/i.test(input.citation)
        ? 'Constitution of Kenya'
        : undefined) ??
      authority?.title.match(/^(.+?\bAct)(?:,?\s*(?:18|19|20)\d{2})?/i)?.[1];
    const citationActYear = /\bConstitution(?:\s+of\s+Kenya)?\b/i.test(input.citation)
      ? 2010
      : undefined;
    const contract = validateCitationContract({
      kind,
      title: authority?.title,
      court: authority?.court,
      judgmentDate: authority?.decisionDate ?? authority?.date,
      citation: authority?.citation,
      neutralCitation: authority?.neutralCitation,
      pinpoint,
      quotedPassage: quote,
      quotedPassageVerified: quoteVerified,
      proposition: input.proposition,
      actName,
      actYear: actYear ?? citationActYear,
      section,
      heading: authority?.heading ?? authority?.title,
      operativeText: authority?.extractedText,
      regulator: authority?.regulator,
      instrumentType: authority?.instrumentType,
      instrumentNumber: authority?.instrumentNumber,
      instrumentDate: authority?.instrumentDate,
    });
    const checks: CitationAuditEntry['checks'] = [];
    checks.push({
      dimension: 'identity',
      state: input.found ? 'PASS' : 'FAIL',
      reason: input.found ? 'Authority identity was found.' : 'Authority identity was not found.',
    });
    const relevance = authority && this.relevance
      ? this.relevance.assess({
          authority: {
            title: authority.title,
            citation: authority.citation,
            fullText: authority.extractedText,
            summary: authority.summary,
            practiceAreas: authority.practiceAreas,
            topics: authority.topics,
          },
          query: input.query,
          legalDomain: input.legalDomain,
        })
      : undefined;
    checks.push({
      dimension: 'relevance',
      state: !relevance ? 'INDETERMINATE' : relevance.state === 'OFF_POINT' ? 'FAIL' : 'PASS',
      reason: relevance?.reason ?? 'Relevance metadata/check was unavailable.',
    });
    const propositionTokens = this.legalTokens(input.proposition);
    const authorityTokens = new Set(this.legalTokens(authority?.extractedText ?? ''));
    const supportRatio = propositionTokens.length
      ? propositionTokens.filter((token) => authorityTokens.has(token)).length / propositionTokens.length
      : 0;
    checks.push({
      dimension: 'passage',
      state: quoteVerified || supportRatio >= 0.3 ? 'PASS' : authority?.extractedText ? 'FAIL' : 'INDETERMINATE',
      reason:
        quoteVerified || supportRatio >= 0.3
          ? 'Retrieved text supports the cited proposition.'
          : authority?.extractedText
            ? 'Retrieved text does not support the cited proposition.'
            : 'No passage text was available.',
    });
    const pinpointPassed = kind === 'statute' ? Boolean(section) : Boolean(pinpoint || quoteVerified);
    checks.push({
      dimension: 'pinpoint',
      state: pinpointPassed ? 'PASS' : 'INDETERMINATE',
      reason: pinpointPassed
        ? 'A section/paragraph pinpoint or verified quotation is present.'
        : 'No usable pinpoint or verified quotation was present.',
    });
    const jurisdictionMatches = Boolean(
      authority?.jurisdiction &&
        authority.jurisdiction.toUpperCase() === input.expectedJurisdiction.toUpperCase(),
    );
    checks.push({
      dimension: 'jurisdiction',
      state: jurisdictionMatches ? 'PASS' : authority?.jurisdiction ? 'FAIL' : 'INDETERMINATE',
      reason: jurisdictionMatches
        ? 'Authority jurisdiction matches the request.'
        : authority?.jurisdiction
          ? 'Authority jurisdiction does not match the request.'
          : 'Jurisdiction metadata was unavailable.',
    });
    const currentLawPass =
      authority?.currentLawStatus === 'GOOD_LAW' ||
      (kind === 'statute' && authority?.isRepealed === false);
    const prospectiveAuthority =
      authority?.prospectiveOnly === true ||
      authority?.sourceClass === 'OFFICIAL_PROSPECTIVE';
    checks.push({
      dimension: 'currentLaw',
      state: prospectiveAuthority
        ? 'FAIL'
        : currentLawPass
        ? 'PASS'
        : authority?.currentLawStatus && authority.currentLawStatus !== 'UNKNOWN'
          ? 'FAIL'
          : 'INDETERMINATE',
      reason: prospectiveAuthority
        ? 'Prospective authority cannot establish law in force.'
        : currentLawPass
        ? 'Authority is marked current/good law.'
        : authority?.currentLawStatus
          ? `Authority status is ${authority.currentLawStatus}.`
          : 'Current-law metadata was unavailable.',
    });
    const hierarchyPass =
      kind !== 'case'
        ? Boolean(authority?.official)
        : Boolean(authority?.court && authority.bindingStatus && authority.bindingStatus !== 'UNKNOWN');
    checks.push({
      dimension: 'hierarchy',
      state: hierarchyPass ? 'PASS' : 'INDETERMINATE',
      reason: hierarchyPass
        ? 'Authority hierarchy metadata is sufficient.'
        : 'Hierarchy/binding-status metadata was unavailable.',
    });
    checks.push({
      dimension: 'contract',
      state: contract.passed ? 'PASS' : 'FAIL',
      reason: contract.passed
        ? 'Authority satisfies the citation contract.'
        : contract.missingReasons.join(' '),
    });
    const integrity = new SourceIntegrityService().assess(authority?.sourceProvenance);
    const sourceVerified = integrity.state === 'PASS' && input.found && checks.filter(check => check.dimension !== 'currentLaw').every(check => check.state === 'PASS') && !prospectiveAuthority && (currentLawPass || !authority?.currentLawStatus || authority.currentLawStatus === 'UNKNOWN');
    const missingReasons = checks
      .filter((check) => check.state !== 'PASS')
      .map((check) => `${check.dimension}: ${check.reason}`);
    if (integrity.state !== 'PASS') missingReasons.push(`sourceIntegrity: ${integrity.reasons.join('; ')}`);
    return {
      sourceVerified,
      currentLawVerified: currentLawPass,
      citation: input.citation,
      authorityId: authority?.id,
      found: input.found,
      verified: sourceVerified && checks.every((check) => check.state === 'PASS'),
      url: authority?.canonicalUrl ?? authority?.sourceUrl,
      deepLinkUrl: authority?.deepLinkUrl,
      pinpoint,
      checks,
      missingReasons,
    };
  }

  private legalTokens(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !['section', 'court', 'shall', 'under', 'with', 'that'].includes(token));
  }

  private withholdRejectedCitationPropositions(
    markdown: string,
    rejected: CitationAuditEntry[],
  ): string {
    let output = markdown;
    for (const entry of rejected) {
      const citation = entry.citation?.trim();
      if (!citation || !output.includes(citation)) continue;
      const escaped = citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      output = output.replace(
        new RegExp(`[^.!?\\n]*${escaped}[^.!?\\n]*[.!?]?`, 'gi'),
        '\n> Proposition withheld because its cited authority did not pass verification.\n',
      );
    }
    return output.replace(
      /(?:\n> Proposition withheld because its cited authority did not pass verification\.\n\s*){2,}/g,
      '\n> One or more propositions were withheld because their cited authorities did not pass verification.\n',
    );
  }
}
