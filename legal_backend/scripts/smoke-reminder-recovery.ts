/** Fault-injection smoke test. Requires an isolated local umbrella_execution DB.
 * No Firebase calls or real queue writes occur; all records are disposable. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NotificationVisibilityService } from '../src/notifications/notification-visibility.service';
import { NotificationDeliveryService } from '../src/notifications/notification-delivery.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { CalendarReminderScheduler } from '../src/calendar/calendar-reminder.scheduler';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/umbrella_execution')) {
    throw new Error('Isolated local test database required');
  }
  const prisma = new PrismaClient();
  const tenantId = `reminder-qa-${randomUUID()}`;
  const userId = `reminder-user-${randomUUID()}`;
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: 'LOCAL REMINDER FAULT INJECTION', primaryCountry: 'KE', defaultCurrency: 'KES' } });
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid`, userType: 'LAWYER' } });
    await prisma.tenantUser.create({ data: { tenantId, userId, role: 'FIRM_ADMIN' } });
    const startAt = new Date(Date.now() + 60_000);
    const event = await prisma.calendarEvent.create({ data: {
      tenantId, userId, title: 'Fictional reminder QA', startAt,
      endAt: new Date(startAt.getTime() + 3_600_000), reminderMinutes: 30, reminderAt: new Date(Date.now() - 1000),
    } });
    let queueCalls = 0;
    const jobs = { enqueueNotificationDispatch: async () => ({ status: ++queueCalls === 1 ? 'FAILED' : 'QUEUED' }) };
    const visibility = new NotificationVisibilityService(prisma as never, {
      assertMatterReadable: async () => undefined, assertClientReadable: async () => undefined,
    } as never);
    const delivery = new NotificationDeliveryService(prisma as never, jobs as never);
    const notifications = new NotificationsService(prisma as never, {} as never, jobs as never,
      { publishToUser: () => undefined } as never, visibility, delivery);
    const scheduler = new CalendarReminderScheduler(prisma as never, notifications);

    await Promise.all([scheduler.deliverDue(), scheduler.deliverDue()]);
    const rows = await prisma.notification.findMany({ where: { tenantId }, include: { delivery: true } });
    assert.equal(rows.length, 1, 'Concurrent scans must create one notification');
    assert.equal(rows[0].delivery?.status, 'PENDING');
    assert.equal(queueCalls, 1);
    assert.equal((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: event.id } })).reminderAt, null);

    await prisma.notificationDelivery.update({ where: { notificationId: rows[0].id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    await delivery.reconcile();
    assert.equal(queueCalls, 2);
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { notificationId: rows[0].id } })).status, 'QUEUED');
    await delivery.reconcile();
    assert.equal(queueCalls, 2, 'An unexpired queue lease must not enqueue again');
    await prisma.notificationDelivery.update({ where: { notificationId: rows[0].id }, data: { status: 'DELIVERED' } });
    await delivery.enqueue(rows[0].id);
    assert.equal(queueCalls, 2, 'A completed intent must not enqueue again');

    assert.equal(await visibility.canRead(rows[0]), true);
    await prisma.calendarEvent.update({ where: { id: event.id }, data: { startAt: new Date(startAt.getTime() + 60_000) } });
    assert.equal(await visibility.canRead(rows[0]), false, 'Rescheduled reminders must be hidden');
    await prisma.tenantUser.update({ where: { tenantId_userId: { tenantId, userId } }, data: { status: 'SUSPENDED' } });
    assert.equal(await visibility.canRead({ ...rows[0], metadata: {} }), false);
    console.log(JSON.stringify({ actualDatabase: true, concurrentScansDeduplicated: true,
      outageRecovered: true, completedIntentNotResent: true, sourceRevocationEnforced: true, externalPushes: 0 }));
  } finally {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Reminder smoke test failed'); process.exitCode = 1; });
