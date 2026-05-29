import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  CreateNotificationDto,
  RegisterDeviceTokenDto,
  UpdateNotificationDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(TenantGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(tenantId, dto);
  }

  /** Inbox for the current user (tenant-scoped). */
  @Get()
  getInbox(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('userId') userId?: string,
    @Query('isRead') isRead?: string,
    @Query('type') type?: string,
  ) {
    if (userId || isRead || type) {
      return this.notificationsService.findAll(tenantId, userId, isRead, type);
    }

    return this.notificationsService.getInbox(
      tenantId,
      user.id,
      limit ? Number(limit) : 50,
      unreadOnly === 'true',
    );
  }

  @Get(':notificationId')
  findOne(
    @TenantId() tenantId: string,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.findOne(tenantId, notificationId);
  }

  @Patch(':notificationId')
  update(
    @TenantId() tenantId: string,
    @Param('notificationId') notificationId: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(tenantId, notificationId, dto);
  }

  @Patch(':notificationId/read')
  markRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(tenantId, user.id, notificationId);
  }

  @Post('read-all')
  markAllRead(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(tenantId, user.id);
  }

  @Post('devices/register')
  registerDevice(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(user.id, {
      ...dto,
      tenantId: dto.tenantId ?? tenantId,
    });
  }

  @Post('device-tokens')
  registerDeviceToken(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(user.id, {
      ...dto,
      tenantId: dto.tenantId ?? tenantId,
    });
  }

  @Get('device-tokens/list')
  listDeviceTokens(@CurrentUser() user: RequestUser) {
    return this.notificationsService.listDeviceTokens(user.id);
  }

  @Delete('device-tokens/:token')
  removeDeviceToken(
    @CurrentUser() user: RequestUser,
    @Param('token') token: string,
  ) {
    return this.notificationsService.removeDeviceToken(user.id, token);
  }
}
