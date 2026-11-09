import { ForbiddenException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

describe('Calendar confidentiality and validation', () => {
  const actor = { tenantId: 'firm', userId: 'alice', tenantRole: 'ASSOCIATE' };
  const dates = { startAt: '2026-11-09T09:00:00Z', endAt: '2026-11-09T10:00:00Z' };
  function setup() {
    const prisma = {
      calendarEvent: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'event' }), update: jest.fn() },
      matter: { findFirst: jest.fn().mockResolvedValue({ id: 'matter', tenantId: 'firm', clientId: null }) },
      matterAccess: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'firm', accessLevel: 'READ_ONLY' }) },
    };
    const access = { assertMatterReadable: jest.fn().mockResolvedValue(undefined), assertClientReadable: jest.fn().mockResolvedValue(undefined) };
    const matterAccess = { getAccessibleMatterIds: jest.fn().mockResolvedValue(['matter']), hasFullAccess: jest.fn().mockReturnValue(false) };
    const realtime = { publishToTenant: jest.fn(), publishDashboardRefresh: jest.fn() };
    return { prisma, access, service: new CalendarService(prisma as any, realtime as any, access as any, matterAccess as any) };
  }
  it('filters restricted matter events even for a broad-role calendar query', async () => {
    const { prisma, access, service } = setup();
    prisma.calendarEvent.findMany.mockResolvedValue([{ id: 'own', userId: 'alice' }, { id: 'private', userId: 'bob' }, { id: 'wall', matterId: 'blocked' }]);
    access.assertMatterReadable.mockRejectedValue(new ForbiddenException('Ethical wall restriction'));
    expect(await service.findAll('firm', undefined, undefined, undefined, actor)).toEqual([{ id: 'own', userId: 'alice' }]);
  });
  it('includes appointments spanning the visible calendar window', async () => {
    const { prisma, service } = setup();
    await service.findAll('firm', undefined, dates.startAt, dates.endAt, actor);
    expect(prisma.calendarEvent.findMany.mock.calls[0][0].where).toMatchObject({ endAt: { gte: new Date(dates.startAt) }, startAt: { lte: new Date(dates.endAt) } });
  });
  it('does not allow read-only matter members to create or edit court events', async () => {
    const { prisma, service } = setup();
    await expect(service.create('firm', { title: 'Hearing', matterId: 'matter', ...dates }, actor)).rejects.toThrow('write access');
    expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
  });
  it('assigns the authenticated owner to a personal appointment and rejects reversed dates', async () => {
    const { prisma, service } = setup();
    await service.create('firm', { title: 'Private appointment', ...dates }, actor);
    expect(prisma.calendarEvent.create.mock.calls[0][0].data.userId).toBe('alice');
    await expect(service.create('firm', { title: 'Invalid', startAt: dates.endAt, endAt: dates.startAt }, actor)).rejects.toThrow('precedes');
  });
  it('cannot open another user personal event by guessing its ID', async () => {
    const { prisma, service } = setup();
    prisma.calendarEvent.findFirst.mockResolvedValue({ id: 'private', userId: 'bob', matterId: null });
    await expect(service.findOne('firm', 'private', actor)).rejects.toThrow('not found');
  });
});
