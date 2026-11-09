import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';
import { PrismaService } from '@/prisma/prisma.service';

export interface NotificationReference {
  tenantId: string;
  userId: string;
  metadata?: unknown;
}

/** Recheck source access at delivery and read time; recipient ownership alone
 * does not preserve access after a matter grant is revoked or a wall is added. */
@Injectable()
export class NotificationVisibilityService {
  constructor(private readonly prisma: PrismaService, private readonly access: ArtifactAccessResolver) {}

  async canRead(notification: NotificationReference): Promise<boolean> {
    const { tenantId, userId } = notification;
    const member = await this.prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { role: true, status: true } });
    if (!member || member.status !== 'ACTIVE') return false;
    const actor = { tenantId, userId, tenantRole: member.role };
    const metadata = notification.metadata && typeof notification.metadata === 'object'
      ? notification.metadata as Record<string, unknown> : {};
    const id = (key: string) => typeof metadata[key] === 'string' && metadata[key] ? metadata[key] as string : undefined;
    const matters = new Set<string>();
    if (id('matterId')) matters.add(id('matterId')!);
    if (id('taskId')) {
      const task = await this.prisma.task.findFirst({ where: { id: id('taskId'), tenantId }, select: { matterId: true, assigneeId: true } });
      if (!task) return false;
      if (task.matterId) matters.add(task.matterId);
      else if (task.assigneeId !== userId) return false;
    }
    const eventId = id('calendarEventId') ?? id('eventId');
    if (eventId) {
      const event = await this.prisma.calendarEvent.findFirst({ where: { id: eventId, tenantId }, select: { matterId: true, userId: true, startAt: true } });
      if (!event) return false;
      if (id('expectedStartAt') && event.startAt.toISOString() !== id('expectedStartAt')) return false;
      if (event.matterId) matters.add(event.matterId);
      else if (event.userId !== userId) return false;
    }
    if (id('draftId')) {
      const draft = await this.prisma.courtDraftRecord.findFirst({ where: { id: id('draftId'), tenantId, userId }, select: { matterId: true } });
      if (!draft) return false;
      if (draft.matterId) matters.add(draft.matterId);
    }
    if (id('contractId')) {
      const contract = await this.prisma.contractEntity.findFirst({ where: { id: id('contractId'), tenantId }, select: { matterId: true } });
      if (!contract?.matterId) return false;
      matters.add(contract.matterId);
    }
    try {
      for (const matterId of matters) await this.access.assertMatterReadable(actor, matterId);
      if (id('clientId')) await this.access.assertClientReadable(actor, id('clientId')!);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error; // A transient database outage must be retried, not recorded as delivery.
    }
  }
}
