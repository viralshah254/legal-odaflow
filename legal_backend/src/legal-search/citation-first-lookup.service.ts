import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { HybridSearchResult } from '@/legal-sources/search/hybrid-search.service';
import {
  IN_CASE_CITATION_PATTERNS,
  normaliseIndiaCitation,
} from '@/config/jurisdictions/in-citation-patterns';
import {
  findIndiaCaselawByCitation,
  findIndiaCaselawByTitle,
  toRetrievedAuthority,
} from '@/legal-sources/load-india-caselaw-corpus';
import { KenyaLawJudgmentConnector } from '@/legal-sources/connectors/kenya-law-judgment.connector';
import { publicUrlFromFrbrUri } from '@/legal-sources/ke-frbr.util';

/** Kenya Law reporter / neutral citation patterns. */
export const KE_CASE_CITATION_PATTERNS: RegExp[] = [
  /\[\s*\d{4}\s*\]\s*(?:KESC|KECA|KEHC|KEELRC|KEELC|KEMC|KETAT)\s+\d+/i,
  /\[\s*\d{4}\s*\]\s*eKLR/i,
  /\b(?:KESC|KECA|KEHC|KEELRC)\s+\d+\s+of\s+\d{4}\b/i,
];

@Injectable()
export class CitationFirstLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kenyaLawJudgments: KenyaLawJudgmentConnector,
  ) {}

  /** True when the query looks like a reporter or neutral citation lookup. */
  isCitationQuery(query: string, countryCode = 'IN'): boolean {
    const trimmed = query.trim();
    const code = countryCode.toUpperCase();
    if (code === 'KE') {
      return KE_CASE_CITATION_PATTERNS.some((re) => re.test(trimmed));
    }
    return IN_CASE_CITATION_PATTERNS.some((re) => re.test(trimmed));
  }

  /** Citation, neutral cite, stable corpus id, or party-title lookup. */
  isCitationOrTitleQuery(query: string, countryCode = 'IN'): boolean {
    const trimmed = query.trim();
    const code = countryCode.toUpperCase();
    if (code === 'KE') {
      return (
        this.isCitationQuery(trimmed, 'KE') ||
        /\b(?:v\.?|vs\.?|versus)\s+/i.test(trimmed) ||
        trimmed.startsWith('case-ke-') ||
        trimmed.startsWith('ke-judgment-')
      );
    }
    return (
      this.isCitationQuery(trimmed, 'IN') ||
      /\b(?:v\.?|vs\.?|versus)\s+/i.test(trimmed) ||
      trimmed.startsWith('india-corpus-') ||
      findIndiaCaselawByTitle(trimmed).length > 0
    );
  }

  /** Exact/prefix lookup in LegalAuthority before semantic search. */
  async lookup(query: string, countryCode: string): Promise<HybridSearchResult[]> {
    const code = countryCode.toUpperCase();
    if (code === 'KE') {
      return this.lookupKenya(query);
    }
    if (code !== 'IN') return [];

    const corpusMatches = [
      findIndiaCaselawByCitation(query),
      ...findIndiaCaselawByTitle(query),
    ].filter((entry, index, entries) =>
      Boolean(entry) &&
      entry!.reviewedByHuman &&
      entry!.extractionConfidence !== 'needs_review' &&
      entries.findIndex((candidate) => candidate?.id === entry!.id) === index,
    );
    if (corpusMatches.length > 0) {
      return corpusMatches.slice(0, 5).map((entry, index) => ({
        ...toRetrievedAuthority(entry!),
        holding: entry!.holding ?? null,
        countryCode: entry!.countryCode,
        jurisdiction: entry!.jurisdiction,
        sourceUrl: entry!.sourceUrl ?? null,
        authorityType: 'CASE_LAW',
        score: 1 - index * 0.01,
      }));
    }

    const normalized = normaliseIndiaCitation(query);
    const variants = buildIndiaCitationVariants(query);

    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'IN',
        authorityType: 'CASE_LAW',
        OR: [
          ...variants.map((v) => ({ citation: { equals: v, mode: 'insensitive' as const } })),
          ...variants.map((v) => ({ citation: { contains: v.slice(0, 24), mode: 'insensitive' as const } })),
          { neutralCitation: { equals: normalized, mode: 'insensitive' } },
          { neutralCitation: { contains: normalized.slice(0, 16), mode: 'insensitive' } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row, index) => ({
      id: row.id,
      title: row.title,
      citation: row.citation,
      sourceName: row.sourceName,
      summary: row.summary,
      fullText: row.fullText,
      sourceUrl: row.sourceUrl,
      holding: row.holding,
      countryCode: row.countryCode,
      jurisdiction: row.jurisdiction,
      authorityType: row.authorityType,
      score: 1 - index * 0.05,
    }));
  }

  private async lookupKenya(query: string): Promise<HybridSearchResult[]> {
    const variants = buildKenyaCitationVariants(query);
    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'KE',
        authorityType: 'CASE_LAW',
        OR: [
          ...variants.map((v) => ({ citation: { equals: v, mode: 'insensitive' as const } })),
          ...variants.map((v) => ({
            citation: { contains: v.slice(0, 24), mode: 'insensitive' as const },
          })),
          ...variants.map((v) => ({
            neutralCitation: { contains: v.slice(0, 20), mode: 'insensitive' as const },
          })),
          ...variants.map((v) => ({
            sourceUrl: { contains: v, mode: 'insensitive' as const },
          })),
          { title: { contains: query.trim().slice(0, 48), mode: 'insensitive' } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    if (rows.length > 0) {
      return rows.map((row, index) => ({
        id: row.id,
        title: row.title,
        citation: row.citation,
        sourceName: row.sourceName,
        summary: row.summary,
        fullText: row.fullText,
        sourceUrl: row.sourceUrl,
        holding: row.holding,
        countryCode: row.countryCode,
        jurisdiction: row.jurisdiction,
        authorityType: row.authorityType,
        score: 1 - index * 0.05,
      }));
    }

    // Live Kenya Law search when local corpus misses the citation.
    if (!this.isCitationQuery(query, 'KE') && !/\b(?:v\.?|vs\.?|versus)\s+/i.test(query)) {
      return [];
    }
    try {
      const hits = await this.kenyaLawJudgments.searchJudgments(variants[0] ?? query, 5);
      return hits.map((hit, index) => ({
        id: hit.id,
        title: hit.title,
        citation: hit.citation,
        sourceName: 'Kenya Law',
        summary: hit.summary,
        fullText: null,
        holding: null,
        sourceUrl: hit.sourceUrl || publicUrlFromFrbrUri(hit.expressionFrbrUri),
        countryCode: 'KE',
        jurisdiction: hit.court,
        authorityType: 'CASE_LAW',
        score: 1 - index * 0.05,
      }));
    } catch {
      return [];
    }
  }
}

function buildIndiaCitationVariants(query: string): string[] {
  const trimmed = query.trim();
  const variants = new Set<string>([trimmed, normaliseIndiaCitation(trimmed)]);

  const scc = trimmed.match(/\((\d{4})\)\s*(\d+)\s*SCC\s*(\d+)/i);
  if (scc) {
    variants.add(`(${scc[1]}) ${scc[2]} SCC ${scc[3]}`);
    variants.add(`(${scc[1]}) ${parseInt(scc[2], 10)} SCC ${scc[3]}`);
  }

  const air = trimmed.match(/AIR\s+(\d{4})\s+(\w+)\s+(\d+)/i);
  if (air) {
    variants.add(`AIR ${air[1]} ${air[2].toUpperCase()} ${air[3]}`);
  }

  const neutral = trimmed.match(/(\d{4})\s*INSC\s*(\d+)/i);
  if (neutral) {
    variants.add(`${neutral[1]}INSC${neutral[2]}`);
    variants.add(`${neutral[1]} INSC ${neutral[2]}`);
  }

  return [...variants].filter(Boolean);
}

function buildKenyaCitationVariants(query: string): string[] {
  const trimmed = query.trim();
  const variants = new Set<string>([trimmed]);

  const court = trimmed.match(
    /\[\s*(\d{4})\s*\]\s*(KESC|KECA|KEHC|KEELRC|KEELC|KEMC|KETAT)\s+(\d+)/i,
  );
  if (court) {
    const year = court[1];
    const code = court[2].toUpperCase();
    const num = court[3];
    variants.add(`[${year}] ${code} ${num}`);
    variants.add(`[${year}] ${code} ${num} (KLR)`);
    variants.add(`akn/ke/judgment/${code.toLowerCase()}/${year}/${num}`);
  }

  const eklr = trimmed.match(/\[\s*(\d{4})\s*\]\s*eKLR/i);
  if (eklr) {
    variants.add(`[${eklr[1]}] eKLR`);
  }

  return [...variants].filter(Boolean);
}
