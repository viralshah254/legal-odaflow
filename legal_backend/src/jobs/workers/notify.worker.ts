import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AI_JOB_TYPES } from '../jobs.constants';
import { NotificationDispatchPayload } from '../jobs.types';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';

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
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (!projectId || !clientEmail || !privateKey) {
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin') as typeof import('firebase-admin');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    const messaging = admin.messaging();
    let sent = 0;

    for (const row of tokens) {
      try {
        await messaging.send({
          token: row.token,
          notification: { title, body },
          data,
        });
        sent += 1;
      } catch {
        // Invalid tokens can be pruned in a later pass.
      }
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
