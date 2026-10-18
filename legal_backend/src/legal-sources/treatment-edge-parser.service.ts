import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';

export interface TreatmentEdge {
  fromCitation: string;
  toCitation: string;
  treatment: 'overruled' | 'followed' | 'distinguished' | 'doubted' | 'reversed' | 'affirmed';
  context?: string;
  sourceAuthorityId?: string;
  sourceName?: string;
  sourceUrl?: string;
  observedAt?: string;
  contextHash?: string;
}

const TREATMENT_PATTERNS: Array<{ re: RegExp; treatment: TreatmentEdge['treatment'] }> = [
  { re: /\boverruled\s+(?:in\s+)?([^(]+?\(\d{4}\)[^.;,\n]{0,40})/gi, treatment: 'overruled' },
  { re: /\breversed\s+(?:in\s+)?([^(]+?\(\d{4}\)[^.;,\n]{0,40})/gi, treatment: 'reversed' },
  { re: /\bfollowed\s+(?:in\s+)?([^(]+?\(\d{4}\)[^.;,\n]{0,40})/gi, treatment: 'followed' },
  { re: /\bdistinguished\s+(?:in\s+)?([^(]+?\(\d{4}\)[^.;,\n]{0,40})/gi, treatment: 'distinguished' },
  { re: /\bdoubted\s+(?:in\s+)?([^(]+?\(\d{4}\)[^.;,\n]{0,40})/gi, treatment: 'doubted' },
  { re: /\baffirmed\s+(?:in\s+)?([^(]+?\(\d{4}\)[^.;,\n]{0,40})/gi, treatment: 'affirmed' },
];

@Injectable()
export class TreatmentEdgeParserService {
  constructor(private readonly prisma: PrismaService) {}

  parseTreatmentEdges(fullText: string, sourceCitation: string | null): TreatmentEdge[] {
    const edges: TreatmentEdge[] = [];
    for (const { re, treatment } of TREATMENT_PATTERNS) {
      let match: RegExpExecArray | null;
      const pattern = new RegExp(re.source, re.flags);
      while ((match = pattern.exec(fullText)) !== null) {
        const target = extractCitationFromFragment(match[1] ?? '');
        if (target && sourceCitation) {
          edges.push({
            fromCitation: sourceCitation,
            toCitation: target,
            treatment,
            context: match[0].slice(0, 200),
          });
        }
      }
    }
    return dedupeEdges(edges);
  }

  /** Persist treatment edges on LegalAuthority topics and update treatmentStatus when overruled. */
  async persistForAuthority(authorityId: string, fullText: string): Promise<TreatmentEdge[]> {
    const authority = await this.prisma.legalAuthority.findUnique({
      where: { id: authorityId },
      select: {
        id: true,
        citation: true,
        topics: true,
        treatmentStatus: true,
        sourceName: true,
        sourceUrl: true,
      },
    });
    if (!authority) return [];

    const observedAt = new Date().toISOString();
    const edges = this.parseTreatmentEdges(fullText, authority.citation).map((edge) => ({
      ...edge,
      sourceAuthorityId: authority.id,
      sourceName: authority.sourceName,
      sourceUrl: authority.sourceUrl ?? undefined,
      observedAt,
      contextHash: createHash('sha256').update(edge.context ?? '').digest('hex'),
    }));
    if (edges.length === 0) return [];

    const existingTopics = Array.isArray(authority.topics)
      ? (authority.topics as string[])
      : [];
    const edgeTopics = edges.map(
      (e) =>
        `treatment:v2:${e.treatment}:${normalizeCitation(e.toCitation)}:${authority.id}:${e.contextHash?.slice(0, 12)}`,
    );
    const mergedTopics = [...new Set([...existingTopics, ...edgeTopics])];

    const hasAdverse = edges.some((e) =>
      ['overruled', 'reversed'].includes(e.treatment),
    );

    await this.prisma.legalAuthority.update({
      where: { id: authorityId },
      data: {
        topics: mergedTopics,
        treatmentStatus: hasAdverse ? 'overruled' : authority.treatmentStatus,
      },
    });

    for (const edge of edges) {
      if (['overruled', 'reversed'].includes(edge.treatment)) {
        await this.markTargetOverruled(edge.toCitation);
      }
    }

    return edges;
  }

  private async markTargetOverruled(citation: string): Promise<void> {
    const normalized = normalizeCitation(citation);
    const [authorities, records] = await Promise.all([
      this.prisma.legalAuthority.findMany({
        where: { authorityType: 'CASE_LAW', citation: { not: null } },
        select: { id: true, citation: true },
      }),
      this.prisma.legalAuthorityRecord.findMany({
        where: { citation: { not: null } },
        select: { id: true, citation: true },
      }),
    ]);
    const authorityIds = authorities
      .filter((candidate) => normalizeCitation(candidate.citation ?? '') === normalized)
      .map((candidate) => candidate.id);
    const recordIds = records
      .filter((candidate) => normalizeCitation(candidate.citation ?? '') === normalized)
      .map((candidate) => candidate.id);

    if (authorityIds.length > 0) {
      await this.prisma.legalAuthority.updateMany({
        where: { id: { in: authorityIds } },
        data: { treatmentStatus: 'overruled' },
      });
    }
    if (recordIds.length > 0) {
      await this.prisma.legalAuthorityRecord.updateMany({
        where: { id: { in: recordIds } },
        data: {
          currentLawStatus: 'overruled',
          verifiedAt: new Date(),
          verificationSource: 'source-attributed-treatment-edge',
        },
      });
    }
  }
}

function extractCitationFromFragment(fragment: string): string | null {
  const scc = fragment.match(/\(\d{4}\)\s*\d+\s*SCC\s*\d+/i)?.[0];
  if (scc) return scc;
  const air = fragment.match(/AIR\s+\d{4}\s+[A-Za-z]+\s+\d+/i)?.[0];
  if (air) return air;
  const scr = fragment.match(/\[\d{4}\]\s*\d+\s*SCR\s*\d+/i)?.[0];
  if (scr) return scr;
  return fragment.trim().slice(0, 80) || null;
}

function dedupeEdges(edges: TreatmentEdge[]): TreatmentEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.fromCitation}|${e.toCitation}|${e.treatment}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeCitation(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
