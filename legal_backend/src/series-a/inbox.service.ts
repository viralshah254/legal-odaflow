import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async listThreads(tenantId: string, matterId?: string, clientId?: string) {
    return this.prisma.unifiedInboxThread.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        clientId: clientId || undefined,
      },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
  }

  async getThread(tenantId: string, threadId: string) {
    return this.prisma.unifiedInboxThread.findFirst({
      where: { id: threadId, tenantId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async postMessage(
    tenantId: string,
    threadId: string,
    body: { direction: string; body: string; senderId?: string },
  ) {
    const message = await this.prisma.unifiedInboxMessage.create({
      data: {
        threadId,
        direction: body.direction,
        body: body.body,
        senderId: body.senderId,
      },
    });

    await this.prisma.unifiedInboxThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async syncPortalMessage(
    tenantId: string,
    clientId: string,
    matterId: string | null,
    subject: string,
    body: string,
    senderId?: string,
  ) {
    let thread = await this.prisma.unifiedInboxThread.findFirst({
      where: { tenantId, clientId, matterId: matterId ?? undefined, channel: 'portal' },
    });

    if (!thread) {
      thread = await this.prisma.unifiedInboxThread.create({
        data: {
          tenantId,
          clientId,
          matterId,
          channel: 'portal',
          subject,
        },
      });
    }

    await this.postMessage(tenantId, thread.id, {
      direction: 'INBOUND',
      body,
      senderId,
    });

    return thread;
  }
}
