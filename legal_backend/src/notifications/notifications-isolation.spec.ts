import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('Notification recipient isolation', () => {
  const user = { id: 'alice', tenantId: 'firm' } as any;
  function setup() {
    const service = { findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), registerDeviceToken: jest.fn() };
    return { service, controller: new NotificationsController(service as any) };
  }
  it('does not widen a filtered inbox to all firm users', () => {
    const { controller, service } = setup();
    controller.getInbox('firm', user, undefined, undefined, undefined, undefined, 'DEADLINE');
    expect(service.findAll).toHaveBeenCalledWith('firm', 'alice', undefined, 'DEADLINE');
    expect(() => controller.getInbox('firm', user, undefined, undefined, 'bob')).toThrow('access denied');
  });
  it('checks the recipient for detail and read-state updates', () => {
    const { controller, service } = setup();
    controller.findOne('firm', user, 'notice');
    controller.update('firm', user, 'notice', { isRead: true });
    expect(service.findOne).toHaveBeenCalledWith('firm', 'notice', 'alice');
    expect(service.update).toHaveBeenCalledWith('firm', 'notice', { isRead: true }, 'alice');
  });
  it('binds device registration to the authenticated tenant', () => {
    const { controller, service } = setup();
    controller.registerDevice('firm', user, { token: 'device', tenantId: 'foreign-firm' });
    expect(service.registerDeviceToken).toHaveBeenCalledWith('alice', { token: 'device', tenantId: 'firm' });
  });
  it('filters service reads by recipient as well as tenant', async () => {
    const prisma = { notification: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new NotificationsService(prisma as any, {} as any, {} as any, {} as any);
    await expect(service.findOne('firm', 'notice', 'alice')).rejects.toThrow('not found');
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: 'notice', tenantId: 'firm', userId: 'alice' } });
  });
});
