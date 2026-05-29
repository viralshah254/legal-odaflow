import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JobsService } from '@/jobs/jobs.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
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
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        userId: userId || undefined,
        type: type || undefined,
        isRead: isRead === undefined ? undefined : isRead === 'true',
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
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

  async findOne(tenantId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async update(
    tenantId: string,
    notificationId: string,
    dto: UpdateNotificationDto,
  ) {
    await this.findOne(tenantId, notificationId);

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: dto,
    });
  }

  async markRead(tenantId: string, userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId, userId },
    });

    if (!notification) {
      return { success: false };
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { success: true };
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
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type ?? 'INFO',
        metadata: input.metadata,
      },
    });

    if (input.push !== false) {
      await this.jobsService.enqueueNotificationDispatch({
        notificationId: notification.id,
        userId: input.userId,
        tenantId: input.tenantId,
      });
    }

    this.realtime.publishToUser(input.userId, REALTIME_EVENTS.NOTIFICATION_CREATED, {
      tenantId: input.tenantId,
      entityId: notification.id,
      action: 'created',
      data: {
        title: notification.title,
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

    for (const row of tokens) {
      try {
        await messaging.send({
          token: row.token,
          notification: { title, body },
          data,
        });
        sent += 1;
      } catch (error) {
        this.logger.warn(
          `FCM send failed for token prefix ${row.token.slice(0, 8)}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    return { sent, skipped: false };
  }

  private async getFirebaseApp(): Promise<import('firebase-admin').app.App | null> {
    if (this.firebaseApp) {
      return this.firebaseApp;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID', '').trim();
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL', '').trim();
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY', '')
      .replace(/\\n/g, '\n')
      .trim();

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    try {
      const admin = await import('firebase-admin');
      if (!admin.apps.length) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        this.firebaseApp = admin.app();
      }
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
