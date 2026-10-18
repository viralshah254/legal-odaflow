import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface AuthorityRecordInput {
  jurisdiction: string;
  title: string;
  citation?: string | null;
  neutralCitation?: string | null;
  court?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  summary?: string | null;
  practiceArea?: string | null;
  currentLawStatus?: string | null;
  official?: boolean;
  reliabilityRank?: number;
  autoDiscovered?: boolean;
  legalAuthorityId?: string;
}

@Injectable()
export class AuthorityRecordRegistryService {
  private readonly logger = new Logger(AuthorityRecordRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  buildRecordId(citation: string | null | undefined, title: string): string {
    if (citation?.trim()) {
      return `reg-${citation.replace(/\s+/g, '-').replace(/[()]/g, '').toLowerCase().slice(0, 120)}`;
    }
    return `reg-${title.replace(/\s+/g, '-').toLowerCase().slice(0, 80)}`;
  }

  async register(input: AuthorityRecordInput): Promise<string> {
    const id = this.buildRecordId(input.citation, input.title);
    try {
      await this.prisma.legalAuthorityRecord.upsert({
        where: { id },
        update: {
          title: input.title,
          citation: input.citation ?? undefined,
          neutralCitation: input.neutralCitation ?? undefined,
          court: input.court ?? undefined,
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl ?? undefined,
          summary: input.summary ?? undefined,
          practiceArea: input.practiceArea ?? undefined,
          currentLawStatus: input.currentLawStatus ?? undefined,
          official: input.official ?? false,
          reliabilityRank: input.reliabilityRank ?? 2,
          autoDiscovered: input.autoDiscovered ?? true,
          verifiedAt: new Date(),
          verificationSource: input.sourceName,
        },
        create: {
          id,
          jurisdiction: input.jurisdiction,
          authorityType: 'CASE',
          title: input.title,
          citation: input.citation ?? null,
          neutralCitation: input.neutralCitation ?? null,
          court: input.court ?? null,
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl ?? null,
          summary: input.summary ?? null,
          practiceArea: input.practiceArea ?? null,
          currentLawStatus: input.currentLawStatus ?? 'good_law',
          official: input.official ?? false,
          reliabilityRank: input.reliabilityRank ?? 2,
          autoDiscovered: input.autoDiscovered ?? true,
          draftKinds: [],
          verifiedAt: new Date(),
          verificationSource: input.sourceName,
        },
      });
      return id;
    } catch (err) {
      this.logger.warn(
        `Failed to register authority record for "${input.citation ?? input.title}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return id;
    }
  }

  async registerFromLegalAuthority(authorityId: string): Promise<void> {
    const authority = await this.prisma.legalAuthority.findUnique({
      where: { id: authorityId },
    });
    if (!authority || authority.authorityType !== 'CASE_LAW') return;

    const practiceAreas = Array.isArray(authority.practiceAreas)
      ? (authority.practiceAreas as string[])
      : [];

    await this.register({
      jurisdiction: authority.countryCode,
      title: authority.title,
      citation: authority.citation,
      neutralCitation: authority.neutralCitation,
      court: authority.court,
      sourceName: authority.sourceName,
      sourceUrl: authority.sourceUrl,
      summary: authority.summary,
      practiceArea: practiceAreas[0] ?? null,
      currentLawStatus: authority.treatmentStatus ?? 'good_law',
      official: authority.sourceName.includes('e-SCR') || authority.sourceName.includes('Supreme Court'),
      reliabilityRank: authority.sourceName.includes('e-SCR') ? 1 : 2,
      autoDiscovered: !authority.reviewedByHuman,
      legalAuthorityId: authority.id,
    });
  }
}
