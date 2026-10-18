import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Tracks per-authority trust from verification strips and user corrections.
 * Used by LegalRetrievalOrchestrator / LegalReranker to boost or penalize authorities.
 */
@Injectable()
export class AuthorityTrustService {
  private readonly logger = new Logger(AuthorityTrustService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordCited(authorityId: string, countryCode = 'IN'): Promise<void> {
    await this.bump(authorityId, countryCode, { timesCited: 1 });
  }

  async recordVerified(authorityId: string, countryCode = 'IN'): Promise<void> {
    await this.bump(authorityId, countryCode, { timesCited: 1, timesVerified: 1 });
  }

  async recordStrip(citationOrId: string, countryCode = 'IN'): Promise<void> {
    // Use citation text as a soft key when we lack a stable authorityId
    const authorityId = citationOrId.trim().slice(0, 200);
    if (!authorityId) return;
    await this.bump(authorityId, countryCode, { timesStripped: 1 });
  }

  async recordUserRemoved(authorityId: string, countryCode = 'IN'): Promise<void> {
    await this.bump(authorityId, countryCode, { timesUserRemoved: 1 });
  }

  async recordUserReadded(authorityId: string, countryCode = 'IN'): Promise<void> {
    await this.bump(authorityId, countryCode, { timesUserReadded: 1 });
  }

  /**
   * Returns a map of authorityId → trustScore for the given country.
   * Scores are in roughly [-1, 1].
   */
  async getTrustMap(countryCode = 'IN', limit = 2000): Promise<Map<string, number>> {
    const rows = await (this.prisma as any).authorityTrustScore.findMany({
      where: { countryCode: countryCode.toUpperCase() },
      select: { authorityId: true, trustScore: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }).catch(() => []);

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.authorityId, row.trustScore);
    }
    return map;
  }

  /**
   * Apply trust adjustments to a scored authority list (mutates score in place).
   * Returns a new array sorted by adjusted score descending.
   */
  applyTrustBoost<T extends { id: string; score?: number; citation?: string | null }>(
    authorities: T[],
    trustMap: Map<string, number>,
  ): T[] {
    return authorities
      .map((a) => {
        const trust =
          trustMap.get(a.id) ??
          (a.citation ? trustMap.get(a.citation) : undefined) ??
          0;
        // Soft multiplicative boost: ±15% max
        const factor = 1 + Math.max(-0.15, Math.min(0.15, trust * 0.15));
        const base = a.score ?? 0;
        return { ...a, score: base * factor };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  private async bump(
    authorityId: string,
    countryCode: string,
    deltas: Partial<{
      timesCited: number;
      timesVerified: number;
      timesStripped: number;
      timesUserRemoved: number;
      timesUserReadded: number;
    }>,
  ): Promise<void> {
    const cc = countryCode.toUpperCase();
    try {
      const existing = await (this.prisma as any).authorityTrustScore.findUnique({
        where: { authorityId_countryCode: { authorityId, countryCode: cc } },
      });

      const timesCited = (existing?.timesCited ?? 0) + (deltas.timesCited ?? 0);
      const timesVerified = (existing?.timesVerified ?? 0) + (deltas.timesVerified ?? 0);
      const timesStripped = (existing?.timesStripped ?? 0) + (deltas.timesStripped ?? 0);
      const timesUserRemoved = (existing?.timesUserRemoved ?? 0) + (deltas.timesUserRemoved ?? 0);
      const timesUserReadded = (existing?.timesUserReadded ?? 0) + (deltas.timesUserReadded ?? 0);

      const trustScore = this.computeTrust({
        timesCited,
        timesVerified,
        timesStripped,
        timesUserRemoved,
        timesUserReadded,
      });

      await (this.prisma as any).authorityTrustScore.upsert({
        where: { authorityId_countryCode: { authorityId, countryCode: cc } },
        create: {
          authorityId,
          countryCode: cc,
          timesCited,
          timesVerified,
          timesStripped,
          timesUserRemoved,
          timesUserReadded,
          trustScore,
        },
        update: {
          timesCited,
          timesVerified,
          timesStripped,
          timesUserRemoved,
          timesUserReadded,
          trustScore,
        },
      });
    } catch (err) {
      this.logger.debug(`Authority trust bump failed for ${authorityId}: ${String(err)}`);
    }
  }

  private computeTrust(stats: {
    timesCited: number;
    timesVerified: number;
    timesStripped: number;
    timesUserRemoved: number;
    timesUserReadded: number;
  }): number {
    const positive = stats.timesVerified * 1.0 + stats.timesUserReadded * 1.5;
    const negative = stats.timesStripped * 1.2 + stats.timesUserRemoved * 1.5;
    const total = Math.max(stats.timesCited + stats.timesStripped + stats.timesUserRemoved, 1);
    const raw = (positive - negative) / total;
    return Math.max(-1, Math.min(1, raw));
  }
}
