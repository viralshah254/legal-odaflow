import { createHash } from 'node:crypto';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationVisibilityService } from './notification-visibility.service';
import { ForbiddenException } from '@nestjs/common';
import concurrencyLimit from '@/common/utils/concurrency-limit';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JobsService } from '@/jobs/jobs.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { getFirebaseAdminApp } from '@/common/utils/firebase-admin.util';
import {
  CreateNotificationDto,
  RegisterDeviceTokenDto,
  UpdateNotificationDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: import('firebase-admin').app.App | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jobsService: JobsService,
    private readonly realtime: RealtimePublisherService,
    private readonly visibility: NotificationVisibilityService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  async create(tenantId: string, dto: CreateNotificationDto) {
    return this.createAndDispatch({
      tenantId,
      userId: dto.userId,
      title: dto.title,
      body: dto.body,
      type: dto.type,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  async findAll(
    tenantId: string,
    userId?: string,
    isRead?: string,
    type?: string,
    limit = 50,
  ) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        userId: userId || undefined,
        type: type || undefined,
        isRead: isRead === undefined ? undefined : isRead === 'true',
      },
      orderBy: { createdAt: 'desc' },
      take: Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50,
    });
    const bound = concurrencyLimit(4);
    const visible = await Promise.all(notifications.map(notification => bound(() => this.visibility.canRead(notification))));
    return notifications.filter((_, index) => visible[index]);
  }

  async getInbox(
    tenantId: string,
    userId: string,
    limit = 50,
    unreadOnly = false,
  ) {
    return this.findAll(
      tenantId,
      userId,
      unreadOnly ? 'false' : undefined,
      undefined,
      limit,
    );
  }

  async findOne(tenantId: string, notificationId: string, userId?: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId, ...(userId ? { userId } : {}) },
    });

    if (!notification || !(await this.visibility.canRead(notification))) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async update(
    tenantId: string,
    notificationId: string,
    dto: UpdateNotificationDto,
    userId?: string,
  ) {
    await this.findOne(tenantId, notificationId, userId);

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: dto,
    });
  }

  async markRead(tenantId: string, userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, tenantId, userId },
      data: { isRead: true },
    });

    return { success: result.count > 0 };
  }

  async markAllRead(tenantId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true },
    });

    return { count: result.count };
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        tenantId: dto.tenantId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        userId,
        tenantId: dto.tenantId,
        platform: dto.platform,
      },
    });
  }

  async listDeviceTokens(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeDeviceToken(userId: string, token: string) {
    const deviceToken = await this.prisma.deviceToken.findFirst({
      where: { userId, token },
    });

    if (!deviceToken) {
      throw new NotFoundException('Device token not found');
    }

    await this.prisma.deviceToken.delete({ where: { id: deviceToken.id } });
    return { success: true };
  }

  async createAndDispatch(input: {
    tenantId: string;
    userId: string;
    title: string;
    body?: string;
    type?: string;
    metadata?: Prisma.InputJsonValue;
    push?: boolean;
    idempotencyKey?: string;
  }) {
    if (!(await this.visibility.canRead(input))) throw new ForbiddenException('Notification source access denied');
    const id = input.idempotencyKey ? 'notice_' + createHash('sha256').update(JSON.stringify([input.tenantId, input.userId, input.idempotencyKey])).digest('hex') : undefined;
    const data = {
      ...(id ? { id } : {}),
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type ?? 'INFO',
      metadata: input.metadata,
      ...(input.push !== false ? { delivery: { create: {} } } : {}),
    };
    // Notification and delivery intent commit together. An enqueue failure must
    // not lose the durable intent or make a successful inbox write look failed.
    const notification = id
      ? await this.prisma.notification.upsert({ where: { id }, create: data, update: {} }).catch(async error => {
          // Nested delivery creation can make Prisma emulate upsert. A competing
          // scheduler may win the unique ID; use that committed intent.
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const existing = await this.prisma.notification.findUnique({ where: { id } });
            if (existing?.tenantId === input.tenantId && existing.userId === input.userId) return existing;
          }
          throw error;
        })
      : await this.prisma.notification.create({ data });
    if (input.push !== false) {
      await this.delivery.enqueue(notification.id).catch(error => {
        this.logger.warn(`Notification delivery remains pending: ${error instanceof Error ? error.name : 'unknown error'}`);
      });
    }

    this.realtime.publishToUser(input.userId, REALTIME_EVENTS.NOTIFICATION_CREATED, {
      tenantId: input.tenantId,
      entityId: notification.id,
      action: 'created',
      data: {
        title: 'Umbrella update',
        type: notification.type,
      },
    });

    return notification;
  }

  async notifyCopilotDraftReady(
    tenantId: string,
    userId: string,
    matterTitle: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.createAndDispatch({
      tenantId,
      userId,
      title: 'Copilot draft ready',
      body: `Draft for "${matterTitle}" is ready to review.`,
      type: 'COPILOT_DRAFT_READY',
      metadata,
    });
  }

  /**
   * Sends a push notification to every user who has at least one registered
   * device token.  Runs in batches to stay within FCM rate limits.
   * Returns a summary of how many messages were sent vs skipped.
   */
  async broadcastPush(
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ totalUsers: number; totalSent: number; skipped: boolean }> {
    const app = await this.getFirebaseApp();
    if (!app) {
      this.logger.warn('broadcastPush: Firebase Admin not configured — skipped.');
      return { totalUsers: 0, totalSent: 0, skipped: true };
    }

    // Fetch all distinct user IDs that have at least one device token.
    const rows = await this.prisma.deviceToken.findMany({
      select: { userId: true, token: true },
      distinct: ['token'],
    });

    if (rows.length === 0) {
      return { totalUsers: 0, totalSent: 0, skipped: false };
    }

    const messaging = app.messaging();
    let totalSent = 0;
    const userSet = new Set(rows.map((r) => r.userId));

    // Send in batches of 500 (FCM multicast limit).
    const BATCH = 500;
    const tokens = rows.map((r) => r.token);

    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data,
          android: { notification: { channelId: 'umbrella_notifications' } },
        });
        totalSent += response.successCount;
        // Clean up stale tokens that FCM reports as unregistered.
        response.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            resp.error?.code === 'messaging/registration-token-not-registered'
          ) {
            this.prisma.deviceToken
              .deleteMany({ where: { token: batch[idx] } })
              .catch(() => {});
          }
        });
      } catch (err) {
        this.logger.error(
          `broadcastPush batch ${i}–${i + batch.length} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(
      `broadcastPush complete — ${totalSent}/${tokens.length} tokens across ${userSet.size} users.`,
    );

    return { totalUsers: userSet.size, totalSent, skipped: false };
  }

  async sendFcmToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ sent: number; skipped: boolean }> {
    const app = await this.getFirebaseApp();
    if (!app) {
      return { sent: 0, skipped: true };
    }

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return { sent: 0, skipped: false };
    }

    const messaging = app.messaging();
    let sent = 0;

    const staleTokens: string[] = [];

    for (const row of tokens) {
      try {
        await messaging.send({
          token: row.token,
          notification: { title, body },
          data,
          android: { notification: { channelId: 'umbrella_notifications', priority: 'high' } },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
        sent += 1;
      } catch (error) {
        const code = (error as { errorInfo?: { code?: string } })?.errorInfo?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          staleTokens.push(row.token);
        }
        this.logger.warn(
          `FCM send failed for token prefix ${row.token.slice(0, 8)}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    if (staleTokens.length > 0) {
      this.prisma.deviceToken
        .deleteMany({ where: { token: { in: staleTokens } } })
        .catch(() => {});
    }

    return { sent, skipped: false };
  }

  private async getFirebaseApp(): Promise<import('firebase-admin').app.App | null> {
    if (this.firebaseApp) {
      return this.firebaseApp;
    }

    try {
      this.firebaseApp = await getFirebaseAdminApp();
      return this.firebaseApp;
    } catch (error) {
      this.logger.warn(
        `Firebase Admin init skipped: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }
}
