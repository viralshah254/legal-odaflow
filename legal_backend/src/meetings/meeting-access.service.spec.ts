import { ForbiddenException } from '@nestjs/common';
import { MeetingAccessService } from './meeting-access.service';

describe('MeetingAccessService', () => {
  let svc: MeetingAccessService;

  beforeEach(() => {
    svc = new MeetingAccessService();
  });

  // ──────────────────────────────────────────────────────────────
  // Standard meetings — always readable by any tenant member
  // ──────────────────────────────────────────────────────────────

  it('allows any role to read a standard meeting', () => {
    expect(
      svc.canReadMeeting({
        confidentiality: 'standard',
        createdByUserId: 'user-a',
        visibilityAllowListUserIds: null,
        callerUserId: 'user-b',
        callerRole: 'ASSOCIATE',
      }),
    ).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Restricted meetings — creator access
  // ──────────────────────────────────────────────────────────────

  it('allows the recording creator to read a restricted meeting', () => {
    expect(
      svc.canReadMeeting({
        confidentiality: 'restricted',
        createdByUserId: 'creator-1',
        visibilityAllowListUserIds: null,
        callerUserId: 'creator-1',
        callerRole: 'ASSOCIATE',
      }),
    ).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Restricted meetings — partner-tier access
  // ──────────────────────────────────────────────────────────────

  it.each(['FIRM_ADMIN', 'PARTNER', 'PARTNER_ADMIN', 'JUNIOR_PARTNER'])(
    'allows %s role to read a restricted meeting',
    (role) => {
      expect(
        svc.canReadMeeting({
          confidentiality: 'restricted',
          createdByUserId: 'creator-1',
          visibilityAllowListUserIds: null,
          callerUserId: 'some-partner',
          callerRole: role,
        }),
      ).toBe(true);
    },
  );

  // ──────────────────────────────────────────────────────────────
  // Restricted meetings — non-partner, non-creator denied
  // ──────────────────────────────────────────────────────────────

  it.each(['ASSOCIATE', 'PARALEGAL', 'FINANCE', 'INTAKE', 'RECEPTION', 'READ_ONLY'])(
    'denies %s role from reading a restricted meeting they did not create',
    (role) => {
      expect(
        svc.canReadMeeting({
          confidentiality: 'restricted',
          createdByUserId: 'creator-1',
          visibilityAllowListUserIds: null,
          callerUserId: 'other-user',
          callerRole: role,
        }),
      ).toBe(false);
    },
  );

  it('denies an associate from reading a highly_restricted meeting', () => {
    expect(
      svc.canReadMeeting({
        confidentiality: 'highly_restricted',
        createdByUserId: 'creator-1',
        visibilityAllowListUserIds: null,
        callerUserId: 'other-user',
        callerRole: 'ASSOCIATE',
      }),
    ).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // Allow-list
  // ──────────────────────────────────────────────────────────────

  it('allows a user on the explicit allow-list to read a restricted meeting', () => {
    expect(
      svc.canReadMeeting({
        confidentiality: 'restricted',
        createdByUserId: 'creator-1',
        visibilityAllowListUserIds: ['allowed-user'],
        callerUserId: 'allowed-user',
        callerRole: 'ASSOCIATE',
      }),
    ).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // assertCanReadMeeting throws
  // ──────────────────────────────────────────────────────────────

  it('assertCanReadMeeting throws ForbiddenException for unauthorized caller', () => {
    expect(() =>
      svc.assertCanReadMeeting({
        confidentiality: 'highly_restricted',
        createdByUserId: 'creator-1',
        visibilityAllowListUserIds: null,
        callerUserId: 'bad-actor',
        callerRole: 'PARALEGAL',
      }),
    ).toThrow(ForbiddenException);
  });

  it('assertCanReadMeeting does not throw for authorized caller', () => {
    expect(() =>
      svc.assertCanReadMeeting({
        confidentiality: 'highly_restricted',
        createdByUserId: 'creator-1',
        visibilityAllowListUserIds: null,
        callerUserId: 'admin',
        callerRole: 'FIRM_ADMIN',
      }),
    ).not.toThrow();
  });

  // ──────────────────────────────────────────────────────────────
  // filterMeetings
  // ──────────────────────────────────────────────────────────────

  it('filterMeetings removes confidential meetings the caller cannot see', () => {
    const meetings = [
      { confidentiality: 'standard', createdByUserId: 'creator-1', visibilityAllowListUserIds: null, id: 'a' },
      { confidentiality: 'restricted', createdByUserId: 'creator-1', visibilityAllowListUserIds: null, id: 'b' },
      { confidentiality: 'highly_restricted', createdByUserId: 'associate', visibilityAllowListUserIds: null, id: 'c' },
    ];

    const visible = svc.filterMeetings(meetings, 'associate', 'ASSOCIATE');
    expect(visible.map((m) => m.id)).toEqual(['a', 'c']); // standard + own recording
  });

  it('filterMeetings returns all meetings for a PARTNER_ADMIN', () => {
    const meetings = [
      { confidentiality: 'standard', createdByUserId: 'a', visibilityAllowListUserIds: null },
      { confidentiality: 'restricted', createdByUserId: 'b', visibilityAllowListUserIds: null },
      { confidentiality: 'highly_restricted', createdByUserId: 'c', visibilityAllowListUserIds: null },
    ];

    const visible = svc.filterMeetings(meetings, 'partner', 'PARTNER_ADMIN');
    expect(visible).toHaveLength(3);
  });
});
