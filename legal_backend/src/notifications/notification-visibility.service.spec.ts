import { ForbiddenException } from '@nestjs/common';
import { NotificationVisibilityService } from './notification-visibility.service';

describe('notification source access at read and delivery', () => {
  function setup() {
    const prisma = {
      tenantUser: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', role: 'FIRM_ADMIN' }) },
      task: { findFirst: jest.fn().mockResolvedValue({ matterId: 'protected', assigneeId: 'alice' }) },
      calendarEvent: { findFirst: jest.fn() }, courtDraftRecord: { findFirst: jest.fn() }, contractEntity: { findFirst: jest.fn() },
    };
    const access = { assertMatterReadable: jest.fn().mockResolvedValue(undefined), assertClientReadable: jest.fn() };
    return { prisma, access, policy: new NotificationVisibilityService(prisma as never, access as never) };
  }
  const notice = { tenantId: 'firm', userId: 'alice', metadata: { taskId: 'task' } };

  it('rechecks a task matter and does not bypass walls for an administrator', async () => {
    const { policy, access } = setup();
    access.assertMatterReadable.mockRejectedValue(new ForbiddenException('Wall'));
    expect(await policy.canRead(notice)).toBe(false);
    expect(access.assertMatterReadable).toHaveBeenCalledWith({ tenantId: 'firm', userId: 'alice', tenantRole: 'FIRM_ADMIN' }, 'protected');
  });
  it.each([null, { status: 'SUSPENDED', role: 'FIRM_ADMIN' }])('suppresses removed or suspended firm recipients', async member => {
    const { policy, prisma, access } = setup();
    prisma.tenantUser.findUnique.mockResolvedValue(member as any);
    expect(await policy.canRead(notice)).toBe(false);
    expect(access.assertMatterReadable).not.toHaveBeenCalled();
  });
  it('suppresses a deleted source instead of leaking its old title', async () => {
    const { policy, prisma } = setup();
    prisma.task.findFirst.mockResolvedValue(null as any);
    expect(await policy.canRead(notice)).toBe(false);
  });
  it('checks both direct and indirect source links', async () => {
    const { policy, access } = setup();
    expect(await policy.canRead({ ...notice, metadata: { matterId: 'direct', taskId: 'task' } })).toBe(true);
    expect(access.assertMatterReadable.mock.calls.map(call => call[1])).toEqual(['direct', 'protected']);
  });
  it('retries a transient database failure rather than recording a denied delivery', async () => {
    const { policy, access } = setup();
    access.assertMatterReadable.mockRejectedValue(new Error('Database unavailable'));
    await expect(policy.canRead(notice)).rejects.toThrow('Database unavailable');
  });
  it('does not expose another user’s private calendar event', async () => {
    const { policy, prisma } = setup();
    prisma.calendarEvent.findFirst.mockResolvedValue({ matterId: null, userId: 'bob' } as never);
    expect(await policy.canRead({ ...notice, metadata: { eventId: 'private' } })).toBe(false);
  });
});
