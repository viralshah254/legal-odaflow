import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AI_JOB_TYPES } from '../jobs.constants';
import { NotificationDispatchPayload } from '../jobs.types';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';
import { getFirebaseAdminApp } from '@/common/utils/firebase-admin.util';

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function sendFcmToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ sent: number; skipped: boolean }> {
  const app = await getFirebaseAdminApp();
  if (!app) {
    return { sent: 0, skipped: true };
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) {
    return { sent: 0, skipped: false };
  }

  try {
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
      } catch (err) {
        const code = (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(row.token);
        }
      }
    }

    if (staleTokens.length > 0) {
      await prisma.deviceToken
        .deleteMany({ where: { token: { in: staleTokens } } })
        .catch(() => {});
    }

    return { sent, skipped: false };
  } catch {
    return { sent: 0, skipped: true };
  }
}

async function processNotificationJob(job: Job<NotificationDispatchPayload>) {
  const payload = job.data;

  if (payload.jobType === AI_JOB_TYPES.DEADLINE_AGENT) {
    const tenantId = payload.tenantId ?? '';
    const { aiGateway } = await getWorkerServices();
    const result = await aiGateway.runDeadlineExtraction({
      userId: payload.userId,
      tenantId,
      matterId: payload.params?.matterId as string | undefined,
      matterTitle: payload.params?.matterTitle as string | undefined,
    });

    if (payload.agentJobId) {
      await prisma.agentJob.update({
        where: { id: payload.agentJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: result as object,
        },
      });
    }

    const fcm = await sendFcmToUser(
      payload.userId,
      'Deadline review ready',
      'Copilot extracted procedural deadlines for your matter.',
      {
        matterId: String(payload.params?.matterId ?? ''),
      },
    );

    return { jobType: payload.jobType, result, fcm };
  }

  if (!payload.notificationId) {
    return { status: 'skipped', reason: 'notification_not_found' };
  }

  const notification = await prisma.notification.findUnique({
    where: { id: payload.notificationId },
  });

  if (!notification) {
    return { status: 'skipped', reason: 'notification_not_found' };
  }

  const fcm = await sendFcmToUser(
    payload.userId,
    notification.title,
    notification.body ?? '',
    {
      notificationId: notification.id,
      type: notification.type,
      tenantId: notification.tenantId,
    },
  );

  if (payload.agentJobId) {
    await prisma.agentJob.update({
      where: { id: payload.agentJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: { fcm },
      },
    });
  }

  return { notificationId: notification.id, fcm };
}

export function createNotifyWorker() {
  return new Worker<NotificationDispatchPayload>(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotificationJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 5,
    },
  );
}
