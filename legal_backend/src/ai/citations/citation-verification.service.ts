import { SourceIntegrityService } from '@/ai/legal-research/source-integrity.service';
import { citationProposition } from './citation-proposition';
import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CourtListenerConnector } from '@/legal-sources/connectors/courtlistener.connector';
import { IndiaKanoonConnector } from '@/legal-sources/connectors/india-kanoon.connector';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { validateCitationContract } from './citation-contract';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';

export interface CitationAuthority {
  sourceProvenance?: import('@/legal-search/legal-retrieval.types').SourceProvenance;
  id: string;
  title: string;
  citation: string | null;
  sourceName?: string;
  summary?: string | null;
  fullText?: string | null;
  sourceUrl?: string | null;
  authorityType?: string;
  neutralCitation?: string | null;
  court?: string | null;
  decisionDate?: string | Date | null;
  jurisdiction?: string | null;
  currentLawStatus?: string | null;
  isRepealed?: boolean;
  treatmentStatus?: TreatmentStatus;
  bindingStatus?: string | null;
  official?: boolean;
  practiceAreas?: string[];
  topics?: string[];
  paragraph?: string | null;
  page?: number | null;
  actName?: string | null;
  actYear?: number | null;
  section?: string | null;
  heading?: string | null;
  regulator?: string | null;
  instrumentType?: string | null;
  instrumentNumber?: string | null;
  instrumentDate?: string | Date | null;
}

export type TreatmentStatus = 'good_law' | 'overruled' | 'distinguished' | 'superseded' | 'repealed';

export interface VerifiedCitation {
  sourceVerified?: boolean;
  currentLawVerified?: boolean;
  authorityId?: string;
  sourceName: string;
  citation: string;
  neutralCitation?: string;
  confidence: number;
  verified: boolean;
  found?: boolean;
  treatmentStatus?: TreatmentStatus;
  sourceUrl?: string;
  checks?: Array<{
    dimension: 'identity' | 'relevance' | 'passage' | 'pinpoint' | 'jurisdiction' | 'currentLaw' | 'hierarchy' | 'contract';
    state: 'PASS' | 'FAIL' | 'INDETERMINATE';
    reason: string;
  }>;
  missingReasons?: string[];
}

export interface CitationVerificationResult {
  verified: boolean;
  citations: VerifiedCitation[];
  warnings: string[];
  /** Citation-like strings in the output not backed by any provided authority. */
  unverifiableCitations: string[];
  foundCount?: number;
  rejectedCitations?: VerifiedCitation[];
  verificationGaps?: Array<{ citation: string; reasons: string[] }>;
  safeForReliance?: boolean;
}

/**
 * Comprehensive citation patterns for detecting case-law references across jurisdictions.
 * Ordered from most specific (neutral citations) to broader reporter patterns.
 */
const CITATION_PATTERNS: RegExp[] = [
  // India — neutral citations
  /\d{4}\s+INSC\s+\d+/g,                         // Supreme Court: 2024 INSC 100
  /\d{4}\s+IN(?:SC|HC|CIC|CAT|SAT|TDSAT)\s+\d+/g, // Neutral cite variants
  // India — law reporters
  /AIR\s+\d{4}\s+[A-Za-z]{1,6}\s+\d+/g,          // AIR 1980 SC 1789
  /\(\d{4}\)\s+\d+\s+SCC\s+\d+/g,                // (1980) 3 SCC 625
  /\d{4}\s+\(\d+\)\s+SCC\s+\d+/g,                // 2024 (1) SCC 100
  /\d{4}\s+SCC\s+OnLine\s+(?:SC|HC|[A-Za-z]+)\s+\d+/g, // SCC OnLine
  /\(\d{4}\)\s+\d+\s+SCR\s+\d+/g,                // SCR
  /\d{4}\s+CrLJ\s+\d+/g,                          // Cr.LJ
  /\d{4}\s+AIR\s+SC(?:W)?\s+\d+/g,               // AIR SCW
  /\d{4}\s+\(\d+\)\s+Bom(?:CR|LR)?\s+\d+/g,      // Bombay reports
  /\d{4}\s+\(\d+\)\s+(?:Del|Mad|Cal|Raj|P&H|Guj|Ker|Hyd|All|MP)\s+\d+/g, // HC reporters
  // US reporters
  /\b\d+\s+U\.S\.\s+\d+/g,                       // 410 U.S. 113
  /\b\d+\s+F\.\s?(?:2d|3d|4th|Supp(?:\.\s?2d|\.\s?3d)?)\s+\d+/g, // F.3d / F.Supp.2d
  /\b\d+\s+S\.\s?Ct\.\s+\d+/g,                   // S. Ct.
  /\b\d+\s+L\.\s?Ed(?:\.\s?2d)?\s+\d+/g,         // L.Ed.
  // UK
  /\[\d{4}\]\s+(?:UKSC|UKHL|EWCA\s+Civ|EWCA\s+Crim|EWHC\s+\d+\s+\([\w]+\)|\d+\s+QB|\d+\s+AC|\d+\s+WLR)\b/g,
  // Kenya
  /\b(?:Petition|Civil Appeal|Criminal Appeal|Civil Application)\s+(?:No\.?\s*)?[A-Z]?\d+\s+of\s+\d{4}/gi,
  /\[\d{4}\]\s+e?KLR/gi,
  /\[\d{4}\]\s+KE(?:SC|CA|HC)\s+\d+/g,
];

// Pattern for Indian citations (AIR + SCC family + neutral) for targeted lookup
const IN_CITATION_PATTERN = /AIR\s+\d{4}\s+[A-Za-z]+\s+\d+|\(\d{4}\)\s+\d+\s+SCC\s+\d+|\d{4}\s+INSC\s+\d+/i;

@Injectable()
export class CitationVerificationService {
  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly courtListener?: CourtListenerConnector,
    @Optional() private readonly indiaKanoon?: IndiaKanoonConnector,
    @Optional() private readonly hybridSearch?: HybridSearchService,
    @Optional() private readonly relevance?: RelevanceVerificationService,
  ) {}

  /**
   * Verify citations in an AI-drafted document and persist the result
   * as a JSON note on the Document record.
   */
  async verifyDocumentDraftCitations(params: {
    documentId: string;
    tenantId: string;
    htmlContent: string;
    countryCode?: string;
  }): Promise<CitationVerificationResult> {
    const result = await this.verifyCitations({
      outputMarkdown: params.htmlContent,
      authorities: [],
      countryCode: params.countryCode ?? 'IN',
    });

    if (this.prisma) {
      try {
        await this.prisma.document.update({
          where: { id: params.documentId },
          data: {
            aiDraftStatus: `cited:${result.verified ? 'ok' : 'warn'}:${result.warnings.length}w`,
          },
        });
      } catch { /* non-fatal */ }
    }

    return result;
  }

  async verifyCitations(params: {
    outputMarkdown: string;
    authorities: CitationAuthority[];
    countryCode?: string;
    /** When true, skip live IK and hybrid-search fallbacks — corpus-only check. */
    fastMode?: boolean;
    query?: string;
    legalDomain?: string;
  }): Promise<CitationVerificationResult> {
    const warnings: string[] = [];
    const output = params.outputMarkdown;
    const outputLower = output.toLowerCase();
    const countryCode = (params.countryCode ?? 'IN').toUpperCase();

    const citations: VerifiedCitation[] = [];
    const rejectedCitations: VerifiedCitation[] = [];
    let foundCount = 0;
    for (const authority of params.authorities) {
      const label = authority.citation ?? authority.title;
      const mentioned =
        outputLower.includes(authority.title.toLowerCase()) ||
        (authority.citation != null &&
          outputLower.includes(authority.citation.toLowerCase()));

      if (!mentioned) {
        warnings.push(`Citation not referenced in output: ${label}`);
        continue;
      }

      // Warn if a superseded or overruled case is cited
      const treatment = (authority as { treatmentStatus?: TreatmentStatus }).treatmentStatus;
      if (mentioned && treatment === 'overruled') {
        warnings.push(`⚠ Overruled authority cited: ${label} — verify manually before filing.`);
      }
      if (mentioned && treatment === 'superseded') {
        warnings.push(`Note: ${label} has been superseded — cite the successor authority alongside.`);
      }

      const audited = this.auditAuthority(
        authority,
        label,
        output,
        params.query ?? output,
        params.legalDomain,
        countryCode,
      );
      foundCount += audited.found ? 1 : 0;
      if (audited.verified || audited.sourceVerified) {
        citations.push(audited);
        if (!audited.currentLawVerified) warnings.push(`Source and pinpoint checked for ${label}; subsequent treatment/current law remains unverified.`);
      }
      else {
        rejectedCitations.push(audited);
        warnings.push(`Citation blocked: ${label} — ${audited.missingReasons?.join('; ')}`);
      }
    }

    const knownCitations = params.authorities
      .map((a) => (a.citation ?? '').toLowerCase())
      .filter(Boolean);

    const unverifiableSet = new Set<string>();
    for (const pattern of CITATION_PATTERNS) {
      const matches = output.match(pattern) ?? [];
      for (const match of matches) {
        const normalized = match.trim().toLowerCase().replace(/\s+/g, ' ');
        const backed = knownCitations.some(
          (known) => known.includes(normalized) || normalized.includes(known),
        );
        if (!backed) {
          unverifiableSet.add(match.trim());
        }
      }
    }

    let unverifiableCitations = Array.from(unverifiableSet);

    // Hybrid-search and live IK lookups for IN citations — skipped in FAST mode
    const skipLiveLookups = params.fastMode ?? false;

    if (!skipLiveLookups && countryCode === 'IN' && this.hybridSearch) {
      const inCitations = unverifiableCitations.filter((c) => IN_CITATION_PATTERN.test(c));
      for (const citation of inCitations) {
        try {
          const hits = await this.hybridSearch.search(citation, {
            countryCode: 'IN',
            limit: 3,
          });
          const match = hits.find(
            (h) =>
              h.citation?.toLowerCase().includes(citation.toLowerCase()) ||
              citation.toLowerCase().includes((h.citation ?? '').toLowerCase()),
          );
          if (match) {
            unverifiableCitations = unverifiableCitations.filter((c) => c !== citation);
            rejectedCitations.push({
              authorityId: match.id,
              sourceName: match.sourceName ?? 'Legal corpus',
              citation: match.citation ?? citation,
              confidence: 0.9,
              found: true,
              verified: false,
              treatmentStatus: (match as { treatmentStatus?: TreatmentStatus }).treatmentStatus ?? 'good_law',
              sourceUrl: (match as { sourceUrl?: string }).sourceUrl ?? undefined,
              missingReasons: ['Rich case metadata and seven-dimension checks were unavailable.'],
            });
            foundCount++;
          }
        } catch {
          /* non-fatal */
        }
      }
    }

    // India Kanoon fallback for remaining IN citations — skipped in FAST mode
    if (
      !skipLiveLookups &&
      this.indiaKanoon?.isConfigured() &&
      unverifiableCitations.some((c) => IN_CITATION_PATTERN.test(c))
    ) {
      try {
        for (const citation of [...unverifiableCitations]) {
          if (!IN_CITATION_PATTERN.test(citation)) continue;
          const hits = await this.indiaKanoon.search({ query: citation, limit: 3 });
          const match = hits.find(
            (h) =>
              h.citation?.toLowerCase().includes(citation.toLowerCase()) ||
              citation.toLowerCase().includes((h.citation ?? '').toLowerCase()),
          );
          if (match) {
            unverifiableCitations = unverifiableCitations.filter((c) => c !== citation);
            rejectedCitations.push({
              sourceName: 'Indian Kanoon',
              citation: match.citation ?? citation,
              neutralCitation: (match as { neutralCitation?: string }).neutralCitation ?? undefined,
              confidence: 0.88,
              found: true,
              verified: false,
              treatmentStatus: 'good_law',
              sourceUrl: (match as { sourceUrl?: string }).sourceUrl ?? undefined,
              missingReasons: ['Rich case metadata and seven-dimension checks were unavailable.'],
            });
            foundCount++;
          }
        }
      } catch {
        /* non-fatal */
      }
    }

    // CourtListener citation lookup for US case-law references
    if (
      this.courtListener?.isConfigured() &&
      unverifiableCitations.some((c) => /\b\d+\s+U\.S\.|\bF\.\s?(?:2d|3d|4th)\b/i.test(c))
    ) {
      try {
        const hits = await this.courtListener.lookupCitationsInText(output);
        for (const hit of hits) {
          if (hit.status !== 200 || !hit.citation) continue;
          const idx = unverifiableCitations.findIndex(
            (c) =>
              c.toLowerCase().includes(hit.citation.toLowerCase()) ||
              hit.normalizedCitations.some((n) =>
                c.toLowerCase().includes(n.toLowerCase()),
              ),
          );
          if (idx >= 0) {
            unverifiableCitations.splice(idx, 1);
            rejectedCitations.push({
              sourceName: 'CourtListener',
              citation: hit.citation,
              confidence: 0.92,
              found: true,
              verified: false,
              missingReasons: ['Rich case metadata and seven-dimension checks were unavailable.'],
            });
            foundCount++;
          }
        }
      } catch {
        /* non-fatal */
      }
    }

    for (const citation of unverifiableCitations) {
      warnings.push(
        `Unverifiable citation in output (not backed by a retrieved authority): ${citation}`,
      );
    }

    return {
      verified:
        citations.length > 0 &&
        citations.every((row) => row.verified) &&
        rejectedCitations.length === 0 &&
        unverifiableCitations.length === 0,
      citations,
      warnings,
      unverifiableCitations,
      foundCount,
      rejectedCitations,
      verificationGaps: rejectedCitations.map((citation) => ({
        citation: citation.citation,
        reasons: citation.missingReasons ?? ['Citation failed verification.'],
      })),
      safeForReliance:
        citations.length > 0 &&
        citations.every(citation => citation.verified) &&
        rejectedCitations.length === 0 &&
        unverifiableCitations.length === 0,
    };
  }

  private auditAuthority(
    authority: CitationAuthority,
    label: string,
    output: string,
    query: string,
    legalDomain: string | undefined,
    countryCode: string,
  ): VerifiedCitation {
    const kind = /statute/i.test(authority.authorityType ?? '')
      ? 'statute'
      : /regulation|rule/i.test(authority.authorityType ?? '')
        ? 'regulation'
        : 'case';
    const proposition = citationProposition(output, label);
    const quote = proposition.match(/["“]([^"”]{12,})["”]/)?.[1];
    const text = authority.fullText ?? authority.summary ?? '';
    const quoteVerified = Boolean(quote && text.toLowerCase().includes(quote.toLowerCase()));
    const pinpoint =
      authority.paragraph ??
      (typeof authority.page === 'number' ? `page ${authority.page}` : undefined) ??
      proposition.match(/\b(?:para(?:graph)?|¶)\s*\d+[A-Za-z]?\b/i)?.[0];
    const section =
      authority.section ??
      authority.citation?.match(/(?:§|[Ss](?:ection|\.)\s*)(\d+[A-Z]?(?:\(\d+\))?)/)?.[1];
    const contract = validateCitationContract({
      kind,
      title: authority.title,
      court: authority.court,
      judgmentDate: authority.decisionDate,
      citation: authority.citation,
      neutralCitation: authority.neutralCitation,
      pinpoint,
      quotedPassage: quote,
      quotedPassageVerified: quoteVerified,
      proposition,
      actName:
        authority.actName ??
        authority.title.match(/^(.+?\bAct)(?:,?\s*(?:18|19|20)\d{2})?/i)?.[1],
      actYear:
        authority.actYear ??
        (Number(
          `${authority.title} ${authority.citation ?? ''}`.match(/\b(?:18|19|20)\d{2}\b/)?.[0] ??
            0,
        ) || undefined),
      section,
      heading: authority.heading ?? authority.title,
      operativeText: text,
      regulator: authority.regulator,
      instrumentType: authority.instrumentType,
      instrumentNumber: authority.instrumentNumber,
      instrumentDate: authority.instrumentDate,
    });
    const checks: NonNullable<VerifiedCitation['checks']> = [];
    checks.push({ dimension: 'identity', state: authority.id ? 'PASS' : 'FAIL', reason: authority.id ? 'Authority identity found.' : 'Authority identity missing.' });
    const relevance = this.relevance?.assess({
      authority: {
        title: authority.title,
        citation: authority.citation,
        fullText: authority.fullText,
        summary: authority.summary,
        practiceAreas: authority.practiceAreas,
        topics: authority.topics,
      },
      query,
      legalDomain,
    });
    checks.push({
      dimension: 'relevance',
      state: !relevance ? 'INDETERMINATE' : relevance.state === 'OFF_POINT' ? 'FAIL' : 'PASS',
      reason: relevance?.reason ?? 'Relevance check unavailable.',
    });
    const propositionTokens = this.tokens(proposition);
    const sourceTokens = new Set(this.tokens(text));
    const overlap = propositionTokens.length
      ? propositionTokens.filter((token) => sourceTokens.has(token)).length / propositionTokens.length
      : 0;
    checks.push({
      dimension: 'passage',
      state: quoteVerified || overlap >= 0.3 ? 'PASS' : text ? 'FAIL' : 'INDETERMINATE',
      reason: quoteVerified || overlap >= 0.3 ? 'Passage supports proposition.' : text ? 'Passage support failed.' : 'Passage unavailable.',
    });
    const pinpointPass = kind === 'statute' ? Boolean(section) : Boolean(pinpoint || quoteVerified);
    checks.push({ dimension: 'pinpoint', state: pinpointPass ? 'PASS' : 'INDETERMINATE', reason: pinpointPass ? 'Pinpoint present.' : 'Pinpoint unavailable.' });
    const jurisdictionPass = authority.jurisdiction?.toUpperCase() === countryCode;
    checks.push({ dimension: 'jurisdiction', state: jurisdictionPass ? 'PASS' : authority.jurisdiction ? 'FAIL' : 'INDETERMINATE', reason: jurisdictionPass ? 'Jurisdiction matches.' : authority.jurisdiction ? 'Jurisdiction mismatch.' : 'Jurisdiction unavailable.' });
    const currentPass =
      authority.currentLawStatus === 'GOOD_LAW' ||
      authority.treatmentStatus === 'good_law' ||
      (kind === 'statute' && authority.isRepealed === false);
    const adverse = ['OVERRULED', 'SUPERSEDED', 'REPEALED'].includes(authority.currentLawStatus?.toUpperCase() ?? '') ||
      ['overruled', 'superseded', 'repealed'].includes(authority.treatmentStatus ?? 'good_law');
    checks.push({ dimension: 'currentLaw', state: currentPass ? 'PASS' : adverse ? 'FAIL' : 'INDETERMINATE', reason: currentPass ? 'Current-law status passed.' : adverse ? 'Authority is adversely treated.' : 'Current-law status unavailable.' });
    const hierarchyPass = kind === 'case'
      ? Boolean(authority.court && authority.bindingStatus && authority.bindingStatus !== 'UNKNOWN')
      : Boolean(authority.official);
    checks.push({ dimension: 'hierarchy', state: hierarchyPass ? 'PASS' : 'INDETERMINATE', reason: hierarchyPass ? 'Hierarchy metadata passed.' : 'Hierarchy metadata unavailable.' });
    checks.push({ dimension: 'contract', state: contract.passed ? 'PASS' : 'FAIL', reason: contract.passed ? 'Citation contract passed.' : contract.missingReasons.join(' ') });
    const integrity = new SourceIntegrityService().assess(authority.sourceProvenance);
    const sourceVerified = integrity.state === 'PASS' && checks.filter(check => check.dimension !== 'currentLaw').every(check => check.state === 'PASS') && !adverse;
    const missingReasons = checks.filter((check) => check.state !== 'PASS').map((check) => `${check.dimension}: ${check.reason}`);
    if (integrity.state !== 'PASS') missingReasons.push(`sourceIntegrity: ${integrity.reasons.join('; ')}`);
    return {
      sourceVerified,
      currentLawVerified: currentPass,
      authorityId: authority.id,
      sourceName: authority.sourceName ?? 'Legal authority',
      citation: label,
      neutralCitation: authority.neutralCitation ?? undefined,
      confidence: missingReasons.length === 0 ? 0.95 : 0.35,
      found: Boolean(authority.id),
      verified: sourceVerified && missingReasons.length === 0,
      treatmentStatus: authority.treatmentStatus,
      sourceUrl: authority.sourceUrl ?? undefined,
      checks,
      missingReasons,
    };
  }

  private tokens(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 3);
  }
}
