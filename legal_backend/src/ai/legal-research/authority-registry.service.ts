import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

export interface RegistryAuthorityInput {
  jurisdiction: string;
  subJurisdiction?: string;
  authorityType: 'STATUTE' | 'CASE' | 'RULE' | 'REGULATION' | 'SECONDARY';
  title: string;
  citation?: string;
  neutralCitation?: string;
  court?: string;
  bench?: string;
  judgeNames?: string[];
  date?: Date;
  sourceName: string;
  sourceUrl?: string;
  official?: boolean;
  reliabilityRank?: number;
  summary?: string;
  holdings?: string[];
  provisions?: string[];
  currentLawStatus?: string;
}

export interface RegistryMatch {
  citation: string | null;
  title: string;
  currentLawStatus?: string | null;
  reviewedByHuman?: boolean | null;
  official?: boolean | null;
  reliabilityRank?: number | null;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:]/g, '').trim();
}

/** Derive practice area tag from draft kind — mirrors resolveCuratedDraftCategory in draft-intent helpers. */
function practiceAreaFromKind(kind: string): string | undefined {
  if (/maintenance|divorce|custody|family|muslim_maintenance/i.test(kind)) return 'Family';
  if (/bail|criminal|quashing|slp/i.test(kind)) return 'Criminal';
  if (/writ|civil_appeal|civil_revision|civil_plaint/i.test(kind)) return 'Civil';
  if (/consumer/i.test(kind)) return 'Consumer';
  if (/cheque|ni_act/i.test(kind)) return 'Criminal';
  if (/nda|agreement|partnership|contract/i.test(kind)) return 'Commercial';
  return undefined;
}

/** Regex that matches real SCC/AIR/Cr.LJ/SLT citation strings — used to gate write-through. */
const CITATION_PATTERN = /\(\d{4}\)\s+\d+\s+SCC|\bAIR\s+\d{4}\b|\bCr\.?LJ\b|\bSCC\s*\(\w+\)\b|\bSLT\b/i;

/**
 * Durable verified-authority registry. Stores leading/verified authorities and
 * provides fuzzy lookup used by the citation auditor as a fallback verification
 * source (so frequently cited authorities can be confirmed without a live pass)
 * and to surface current-law status / attorney-reviewed flags.
 */
@Injectable()
export class AuthorityRegistryService {
  private readonly logger = new Logger(AuthorityRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Looks up registry records that may match any of the supplied citations for a
   * jurisdiction. Returns a lightweight projection for verification + treatment.
   */
  async lookupByCitations(
    jurisdiction: string,
    citations: string[],
  ): Promise<RegistryMatch[]> {
    if (citations.length === 0) return [];
    try {
      const records = await this.prisma.legalAuthorityRecord.findMany({
        where: {
          jurisdiction: { in: [jurisdiction.toUpperCase(), jurisdiction] },
          OR: citations.flatMap((c) => [
            { citation: { contains: c.slice(0, 30) } },
            { neutralCitation: { contains: c.slice(0, 30) } },
          ]),
        },
        select: {
          citation: true,
          title: true,
          currentLawStatus: true,
          reviewedByHuman: true,
          official: true,
          reliabilityRank: true,
        },
      });
      return records;
    } catch (err) {
      this.logger.warn(
        `Authority registry lookup failed (table may be unmigrated): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }

  /**
   * Returns a normalised lookup set of citation/title strings present in the
   * registry for the given jurisdiction + candidate citations.
   */
  async buildVerifiedSet(
    jurisdiction: string,
    citations: string[],
  ): Promise<Set<string>> {
    const matches = await this.lookupByCitations(jurisdiction, citations);
    const set = new Set<string>();
    for (const m of matches) {
      if (m.citation) set.add(normalise(m.citation));
      set.add(normalise(m.title));
    }
    return set;
  }

  /**
   * Stores or updates a verified authority. Dedupes by textHash (computed from
   * title + citation) so repeated stores do not create duplicates.
   */
  async upsertAuthority(input: RegistryAuthorityInput): Promise<void> {
    const textHash = createHash('sha256')
      .update(`${normalise(input.title)}|${normalise(input.citation ?? '')}`)
      .digest('hex');

    try {
      const existing = await this.prisma.legalAuthorityRecord.findFirst({
        where: { textHash },
        select: { id: true },
      });

      const data = {
        jurisdiction: input.jurisdiction.toUpperCase(),
        subJurisdiction: input.subJurisdiction,
        authorityType: input.authorityType,
        title: input.title,
        citation: input.citation,
        neutralCitation: input.neutralCitation,
        court: input.court,
        bench: input.bench,
        judgeNames: input.judgeNames ? (input.judgeNames as unknown as object) : undefined,
        date: input.date,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        official: input.official ?? false,
        reliabilityRank: input.reliabilityRank ?? 3,
        textHash,
        summary: input.summary,
        holdingsJson: input.holdings ? (input.holdings as unknown as object) : undefined,
        provisionsJson: input.provisions ? (input.provisions as unknown as object) : undefined,
        currentLawStatus: input.currentLawStatus,
      };

      if (existing) {
        await this.prisma.legalAuthorityRecord.update({
          where: { id: existing.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: data as any,
        });
      } else {
        await this.prisma.legalAuthorityRecord.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: data as any,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Authority registry upsert failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Returns verified authorities from the registry that are relevant to the given
   * draft kind and country. Used by DraftResearchGroundingService to seed the
   * verified block before hitting live connectors.
   */
  async findForDraftKind(
    kind: string,
    countryCode: string,
    limit = 12,
  ): Promise<RetrievedAuthority[]> {
    const practiceArea = practiceAreaFromKind(kind);
    try {
      const records = await this.prisma.legalAuthorityRecord.findMany({
        where: {
          jurisdiction: { in: [countryCode.toUpperCase(), 'IN', 'US', 'GB'] },
          AND: [
            {
              OR: [
                { draftKinds: { has: kind } },
                practiceArea ? { practiceArea } : {},
              ],
            },
          ],
        },
        orderBy: [
          { reviewedByHuman: 'desc' },
          { reliabilityRank: 'desc' },
          { autoDiscovered: 'asc' },
        ],
        take: limit,
        select: {
          id: true,
          title: true,
          citation: true,
          sourceName: true,
          summary: true,
          sourceUrl: true,
          court: true,
        },
      });

      return records.map((r) => ({
        id: `registry__${r.id}`,
        title: r.title,
        citation: r.citation,
        sourceName: r.sourceName,
        summary: r.summary,
        sourceUrl: r.sourceUrl ?? undefined,
        sourceTier: 'case_law' as const,
        authorityType: 'CASE_LAW',
      }));
    } catch (err) {
      this.logger.warn(
        `findForDraftKind failed (table may not be migrated yet): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }

  /**
   * Quality-gated write-through: persists newly discovered case-law authorities
   * from live retrieval back to the registry so future drafts benefit from them.
   *
   * Gates:
   * - sourceTier must be 'case_law' (Kanoon / CourtListener — not raw Tavily web)
   * - citation must look like a real SCC/AIR/Cr.LJ citation
   * - summary must be non-empty
   * Silently skips authorities that fail any gate. Never throws.
   */
  async upsertFromRetrieval(
    authorities: RetrievedAuthority[],
    kind: string,
  ): Promise<void> {
    const practiceArea = practiceAreaFromKind(kind);
    const qualified = authorities.filter(
      (a) =>
        a.sourceTier === 'case_law' &&
        a.citation &&
        CITATION_PATTERN.test(a.citation) &&
        (a.summary?.trim().length ?? 0) > 20,
    );

    for (const a of qualified) {
      const textHash = createHash('sha256')
        .update(`${normalise(a.title)}|${normalise(a.citation ?? '')}`)
        .digest('hex');

      try {
        const existing = await this.prisma.legalAuthorityRecord.findFirst({
          where: { textHash },
          select: { id: true, draftKinds: true },
        });

        if (existing) {
          // Add this kind to the draftKinds array if not already there
          if (!existing.draftKinds.includes(kind)) {
            await this.prisma.legalAuthorityRecord.update({
              where: { id: existing.id },
              data: { draftKinds: { push: kind } },
            });
          }
        } else {
          await this.prisma.legalAuthorityRecord.create({
            data: {
              jurisdiction: 'IN',
              authorityType: 'CASE',
              title: a.title,
              citation: a.citation,
              sourceName: a.sourceName,
              sourceUrl: a.sourceUrl,
              summary: a.summary,
              textHash,
              reliabilityRank: 2,
              official: false,
              reviewedByHuman: false,
              autoDiscovered: true,
              practiceArea: practiceArea ?? null,
              draftKinds: [kind],
            },
          });
        }
      } catch (err) {
        this.logger.warn(
          `upsertFromRetrieval failed for "${a.title}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
