import { NotificationDeliveryService } from './notification-delivery.service';

describe('durable notification dispatch', () => {
  function setup() {
    const prisma = { notificationDelivery: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([]) },
      notification: { findUnique: jest.fn().mockResolvedValue({ id: 'n', tenantId: 'firm', userId: 'alice' }) } };
    const jobs = { enqueueNotificationDispatch: jest.fn().mockResolvedValue({ status: 'QUEUED' }) };
    return { prisma, jobs, service: new NotificationDeliveryService(prisma as never, jobs as never) };
  }
  it('retains a pending intent after a recorded queue outage', async () => {
    const { service, prisma, jobs } = setup();
    jobs.enqueueNotificationDispatch.mockResolvedValue({ status: 'FAILED' });
    await service.enqueue('n');
    expect(prisma.notificationDelivery.updateMany.mock.calls[1][0]).toMatchObject({ where: { notificationId: 'n', status: 'QUEUING' }, data: { status: 'PENDING', lastErrorClass: 'QUEUE_UNAVAILABLE' } });
  });
  it('does not dispatch an intent another worker already leased', async () => {
    const { service, prisma, jobs } = setup();
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });
    await service.enqueue('n');
    expect(jobs.enqueueNotificationDispatch).not.toHaveBeenCalled();
  });
  it('does not overwrite a delivery completed while enqueue returned', async () => {
    const { service, prisma } = setup();
    await service.enqueue('n');
    expect(prisma.notificationDelivery.updateMany.mock.calls[1][0].where).toEqual({ notificationId: 'n', status: 'QUEUING' });
  });
});
