import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '@/cache/cache.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthorityBundle, AuthorityBundleEntry, RetrievedAuthority } from './legal-retrieval.types';

@Injectable()
export class AuthorityThreadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async saveBundle(params: {
    scope: AuthorityBundle['scope'];
    scopeId: string;
    query: string;
    queryHash: string;
    countryCode: string;
    jurisdiction?: string;
    authorities: RetrievedAuthority[];
    parentBundleId?: string;
  }): Promise<AuthorityBundle> {
    const bundle: AuthorityBundle = {
      id: `bundle_${Date.now()}_${params.scopeId.slice(0, 8)}`,
      scope: params.scope,
      scopeId: params.scopeId,
      query: params.query,
      queryHash: params.queryHash,
      countryCode: params.countryCode,
      jurisdiction: params.jurisdiction,
      parentBundleId: params.parentBundleId,
      createdAt: new Date().toISOString(),
      entries: params.authorities.map((a) => this.toEntry(a)),
    };

    const cacheKey = this.cache.buildKey('authority-thread', [params.scope, params.scopeId]);
    const existing = (await this.cache.get<AuthorityBundle[]>(cacheKey)) ?? [];
    existing.push(bundle);
    await this.cache.set(cacheKey, existing.slice(-10));

    return bundle;
  }

  async loadChain(params: {
    consumerCaseId?: string;
    leadId?: string;
    matterId?: string;
  }): Promise<AuthorityBundle[]> {
    const bundles: AuthorityBundle[] = [];

    if (params.consumerCaseId) {
      const intake = await this.cache.get<AuthorityBundle[]>(
        this.cache.buildKey('authority-thread', ['intake', params.consumerCaseId]),
      );
      if (intake) bundles.push(...intake);
    }
    if (params.leadId) {
      const lead = await this.cache.get<AuthorityBundle[]>(
        this.cache.buildKey('authority-thread', ['lead', params.leadId]),
      );
      if (lead) bundles.push(...lead);
    }
    if (params.matterId) {
      const matter = await this.cache.get<AuthorityBundle[]>(
        this.cache.buildKey('authority-thread', ['matter', params.matterId]),
      );
      if (matter) bundles.push(...matter);

      const matterRow = await this.prisma.matter.findUnique({
        where: { id: params.matterId },
        select: { consumerCaseId: true, sourceLeadId: true },
      });
      if (matterRow?.consumerCaseId) {
        const intake = await this.cache.get<AuthorityBundle[]>(
          this.cache.buildKey('authority-thread', ['intake', matterRow.consumerCaseId]),
        );
        if (intake) bundles.unshift(...intake);
      }
      if (matterRow?.sourceLeadId) {
        const lead = await this.cache.get<AuthorityBundle[]>(
          this.cache.buildKey('authority-thread', ['lead', matterRow.sourceLeadId]),
        );
        if (lead) bundles.push(...lead.filter((b) => !bundles.some((x) => x.id === b.id)));
      }
    }

    return bundles;
  }

  buildPriorAuthoritiesPrompt(bundles: AuthorityBundle[]): string {
    if (bundles.length === 0) return '';
    const entries = bundles.flatMap((b) => b.entries).slice(0, 15);
    const lines = entries.map(
      (e) => `- ${e.title}${e.citation ? ` (${e.citation})` : ''} [${e.sourceTier}] from ${e.sourceName}`,
    );
    return [
      'Prior grounded authorities for this matter (intake → lead → research lineage):',
      ...lines,
      'Prefer consistency with these authorities unless newer primary sources supersede.',
    ].join('\n');
  }

  async persistToAiOutput(aiOutputId: string, bundle: AuthorityBundle): Promise<void> {
    const output = await this.prisma.aIOutput.findUnique({
      where: { id: aiOutputId },
      select: { citations: true },
    });
    if (!output) return;

    const citations = (output.citations as Prisma.JsonObject) ?? {};
    await this.prisma.aIOutput.update({
      where: { id: aiOutputId },
      data: {
        citations: {
          ...citations,
          authorityBundle: bundle,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private toEntry(authority: RetrievedAuthority): AuthorityBundleEntry {
    return {
      authorityId: authority.id,
      title: authority.title,
      citation: authority.citation,
      sourceName: authority.sourceName,
      sourceUrl: authority.sourceUrl,
      sourceTier: authority.sourceTier,
      retrievedAt: new Date().toISOString(),
    };
  }
}
