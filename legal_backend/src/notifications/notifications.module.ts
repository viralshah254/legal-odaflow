import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationVisibilityService } from './notification-visibility.service';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationVisibilityService, NotificationDeliveryService],
  exports: [NotificationsService, NotificationVisibilityService],
})
export class NotificationsModule {}
