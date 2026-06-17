import { ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Roles that always have full visibility regardless of confidentiality level.
 * Mirrors the FULL_ACCESS_ROLES set used by MatterAccessService.
 */
const PARTNER_ROLES = new Set([
  'FIRM_ADMIN',
  'PARTNER',
  'PARTNER_ADMIN',
  'JUNIOR_PARTNER',
]);

@Injectable()
export class MeetingAccessService {
  /**
   * Returns true when the caller is allowed to view a meeting given its
   * confidentiality level and the meeting's recorded creator.
   *
   * Rules:
   *  - standard → any active tenant member may read (gate enforced at TenantGuard level)
   *  - restricted / highly_restricted → creator OR partner-tier role OR explicit allow-list
   */
  canReadMeeting(params: {
    confidentiality: string;
    createdByUserId: string | null | undefined;
    visibilityAllowListUserIds: string[] | null | undefined;
    callerUserId: string;
    callerRole: string | undefined;
  }): boolean {
    const { confidentiality, createdByUserId, visibilityAllowListUserIds, callerUserId, callerRole } = params;

    if (confidentiality === 'standard') {
      return true;
    }

    // Partner-tier roles always have access
    if (callerRole && PARTNER_ROLES.has(callerRole)) {
      return true;
    }

    // Recording creator has access
    if (createdByUserId && createdByUserId === callerUserId) {
      return true;
    }

    // Explicit allow-list
    if (visibilityAllowListUserIds?.includes(callerUserId)) {
      return true;
    }

    return false;
  }

  /**
   * Throws 403 if the caller cannot read the meeting.
   */
  assertCanReadMeeting(params: {
    confidentiality: string;
    createdByUserId: string | null | undefined;
    visibilityAllowListUserIds: string[] | null | undefined;
    callerUserId: string;
    callerRole: string | undefined;
  }): void {
    if (!this.canReadMeeting(params)) {
      throw new ForbiddenException(
        'This recording is restricted. Access is limited to the creator, partners, and firm admins.',
      );
    }
  }

  /**
   * Filters a list of meetings to only those the caller is allowed to see.
   * Keeps standard meetings for everyone; restricted ones only for authorized callers.
   */
  filterMeetings<T extends {
    confidentiality?: string | null;
    createdByUserId?: string | null;
    visibilityAllowListUserIds?: unknown;
  }>(
    meetings: T[],
    callerUserId: string,
    callerRole: string | undefined,
  ): T[] {
    return meetings.filter((m) =>
      this.canReadMeeting({
        confidentiality: m.confidentiality ?? 'standard',
        createdByUserId: m.createdByUserId,
        visibilityAllowListUserIds: Array.isArray(m.visibilityAllowListUserIds)
          ? (m.visibilityAllowListUserIds as string[])
          : null,
        callerUserId,
        callerRole,
      }),
    );
  }
}
