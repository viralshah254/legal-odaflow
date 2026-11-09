import { CalendarReminderScheduler } from './calendar-reminder.scheduler';

describe('calendar reminder source revisions', () => {
  it('uses deterministic notification identity and does not clear a concurrently rescheduled event', async () => {
    const startAt = new Date('2026-11-09T14:00:00Z'), reminderAt = new Date('2026-11-09T13:30:00Z');
    const event = { id: 'e', tenantId: 'firm', userId: 'alice', matterId: 'm', title: 'Private event', startAt, reminderAt };
    const prisma = { calendarEvent: { findMany: jest.fn().mockResolvedValue([event]), updateMany: jest.fn() } };
    const notifications = { createAndDispatch: jest.fn().mockResolvedValue({ id: 'n' }) };
    await new CalendarReminderScheduler(prisma as never, notifications as never).deliverDue();
    expect(notifications.createAndDispatch).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `calendar-e-${startAt.toISOString()}`, metadata: expect.objectContaining({ calendarEventId: 'e', expectedStartAt: startAt.toISOString(), matterId: 'm' }) }));
    expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({ where: { id: 'e', startAt, reminderAt }, data: { reminderAt: null } });
  });
  it('keeps a due reminder pending when notification persistence fails', async () => {
    const prisma = { calendarEvent: { findMany: jest.fn().mockResolvedValue([{ id: 'e', startAt: new Date(), userId: 'alice' }]), updateMany: jest.fn() } };
    const notifications = { createAndDispatch: jest.fn().mockRejectedValue(new Error('Database down')) };
    await new CalendarReminderScheduler(prisma as never, notifications as never).deliverDue();
    expect(prisma.calendarEvent.updateMany).not.toHaveBeenCalled();
  });
});
