import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  SectionFinderUnmatchedService,
  UNMATCHED_QUERY_STATUSES,
  type UnmatchedQueryStatus,
} from '@/legal-search/india-section-finder/section-finder-unmatched.service';
import { StatuteIngestService } from '@/legal-sources/statute-ingest.service';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';

@Injectable()
export class UnmatchedSectionsService {
  constructor(
    private readonly unmatchedService: SectionFinderUnmatchedService,
    private readonly statuteIngest: StatuteIngestService,
    private readonly bareActLookup: BareActLookupService,
  ) {}

  list(query: {
    status?: string;
    countryCode?: string;
    sort?: 'searchCount' | 'lastSearchedAt';
    limit?: number;
    offset?: number;
  }) {
    return this.unmatchedService.list(query);
  }

  getStats() {
    return this.unmatchedService.getStats();
  }

  updateStatus(
    id: string,
    data: {
      status?: string;
      resolvedNote?: string;
      resolvedByUserId?: string;
      resolvedAuthorityId?: string;
    },
  ) {
    if (data.status && !UNMATCHED_QUERY_STATUSES.includes(data.status as UnmatchedQueryStatus)) {
      throw new BadRequestException(`Invalid status: ${data.status}`);
    }
    return this.unmatchedService.updateStatus(id, {
      status: data.status as UnmatchedQueryStatus | undefined,
      resolvedNote: data.resolvedNote,
      resolvedByUserId: data.resolvedByUserId,
      resolvedAuthorityId: data.resolvedAuthorityId,
    });
  }

  async triggerIngest(id: string) {
    const row = await this.unmatchedService.getById(id);
    const actId = row.parsedActId;
    const section = row.parsedSection;
    const countryCode = row.countryCode;

    if (!actId || !section) {
      throw new BadRequestException(
        'Cannot trigger ingest: parsed act and section are required on this unmatched query',
      );
    }

    const resolved = await this.statuteIngest.resolveSectionOnDemand(
      actId,
      section,
      countryCode,
    );

    const resolvedAuthorityId =
      resolved != null
        ? this.bareActLookup.buildSectionId(countryCode, actId, section)
        : undefined;

    if (resolved) {
      await this.unmatchedService.updateStatus(id, {
        status: 'resolved',
        resolvedAuthorityId,
        resolvedNote: `Ingest triggered — section resolved from ${resolved.sourceName}`,
      });
    }

    return {
      ok: Boolean(resolved),
      actId,
      section,
      countryCode,
      resolvedAuthorityId,
      sectionTitle: resolved?.title ?? null,
      sourceName: resolved?.sourceName ?? null,
    };
  }
}
