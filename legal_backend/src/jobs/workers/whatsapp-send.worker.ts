import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { QUEUE_NAMES } from '../jobs.constants';

const prisma = new PrismaClient();

export interface WhatsappSendJobData {
  messageId: string;
  campaignId: string;
  to: string;
  templateName: string;
  firstName: string;
  city: string;
  /** True when 'to' came from the phone field rather than a confirmed whatsapp field */
  isPhoneFallback?: boolean;
}

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

/** Meta error codes that mean the number is not registered on WhatsApp */
const NOT_ON_WHATSAPP_CODES = new Set([131026, 132000, 130429]);

export class NotOnWhatsAppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotOnWhatsAppError';
  }
}

/** Meta Graph API expects E.164 digits only (no + or spaces). */
export function normalizeToMetaPhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

async function callMetaApi(data: WhatsappSendJobData): Promise<string> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  if (!phoneNumberId || !apiToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_TOKEN not configured');
  }

  const to = normalizeToMetaPhone(data.to);
  if (!to) {
    throw new Error(`Invalid recipient phone number: ${data.to}`);
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: data.templateName,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: data.firstName },
            { type: 'text', text: data.city || 'India' },
          ],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Check if Meta is telling us this number isn't on WhatsApp
    try {
      const errJson = JSON.parse(errText) as { error?: { code?: number; error_subcode?: number } };
      const code = errJson.error?.code ?? errJson.error?.error_subcode ?? 0;
      if (NOT_ON_WHATSAPP_CODES.has(code)) {
        throw new NotOnWhatsAppError(`Number not on WhatsApp (Meta code ${code}): ${data.to}`);
      }
    } catch (e) {
      if (e instanceof NotOnWhatsAppError) throw e;
    }
    throw new Error(`Meta API error ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as { messages?: Array<{ id: string }> };
  const waMessageId = json.messages?.[0]?.id;
  if (!waMessageId) throw new Error('Meta API returned no message ID');
  return waMessageId;
}

async function processWhatsappSend(job: Job<WhatsappSendJobData>) {
  const { messageId, campaignId, to, templateName, firstName, city } = job.data;

  // Check if campaign is paused — skip this message if so
  const campaign = await prisma.whatsappCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  if (!campaign) {
    // Campaign was deleted — discard job without retrying.
    return { skipped: true, reason: 'campaign_deleted' };
  }

  if (campaign.status === 'PAUSED') {
    // Re-queue with a delay so it can be picked up when campaign resumes
    throw Object.assign(new Error('Campaign paused — deferring message'), {
      bullmqStallSilently: true,
    });
  }

  const waMessageId = await callMetaApi({ messageId, campaignId, to, templateName, firstName, city });

  await prisma.whatsappMessage.update({
    where: { id: messageId },
    data: { status: 'SENT', waMessageId, sentAt: new Date() },
  });
  await prisma.whatsappCampaign.update({
    where: { id: campaignId },
    data: { totalSent: { increment: 1 } },
  });

  // Phone-fallback succeeded → the number is confirmed on WhatsApp; promote it
  if (job.data.isPhoneFallback) {
    await prisma.lawyerProspect.updateMany({
      where: { phone: to, whatsapp: null },
      data: { whatsapp: to, whatsappConfidence: 'high' },
    });
  }

  return { waMessageId };
}

export function createWhatsappSendWorker() {
  const worker = new Worker<WhatsappSendJobData>(
    QUEUE_NAMES.WHATSAPP_SEND,
    processWhatsappSend,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      // Rate limit: 60 messages per minute = 1/sec
      limiter: {
        max: 60,
        duration: 60_000,
      },
    },
  );

  worker.on('failed', async (job: Job<WhatsappSendJobData> | undefined, err: Error) => {
    if (!job) return;

    const isNotOnWhatsApp = err instanceof NotOnWhatsAppError;

    // For "not on WhatsApp" errors, don't retry — fail immediately and update prospect
    const exhausted = isNotOnWhatsApp || job.attemptsMade >= (job.opts.attempts ?? 3);

    if (exhausted) {
      try {
        await prisma.whatsappMessage.update({
          where: { id: job.data.messageId },
          data: { status: 'FAILED', errorCode: err.message.slice(0, 255) },
        });
        await prisma.whatsappCampaign.update({
          where: { id: job.data.campaignId },
          data: { totalFailed: { increment: 1 } },
        });

        // If number is not on WhatsApp, update the prospect record so future campaigns skip it
        if (isNotOnWhatsApp) {
          await prisma.lawyerProspect.updateMany({
            where: {
              OR: [{ whatsapp: job.data.to }, { phone: job.data.to }],
            },
            data: {
              whatsapp: null,
              whatsappConfidence: 'none',
            },
          });
        }
      } catch {
        // best-effort
      }
    }
  });

  return worker;
}
