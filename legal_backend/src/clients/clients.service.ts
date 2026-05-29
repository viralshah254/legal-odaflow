import { Injectable, NotFoundException } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async create(tenantId: string, dto: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        type: dto.type ?? 'INDIVIDUAL',
        countryCode: dto.countryCode?.toUpperCase(),
      },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.CLIENT_CREATED, {
      entityId: client.id,
      action: 'created',
      data: { name: client.name },
    });
    this.realtime.publishDashboardRefresh(tenantId, client.id);

    return client;
  }

  async findAll(
    tenantId: string,
    userId: string,
    role?: string,
    search?: string,
  ) {
    const accessibleClientIds = await this.matterAccess.getAccessibleClientIds(
      tenantId,
      userId,
      role,
    );

    return this.prisma.client.findMany({
      where: {
        tenantId,
        id: accessibleClientIds ? { in: accessibleClientIds } : undefined,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      include: {
        matters: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (!this.matterAccess.hasFullAccess(role)) {
      const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
        tenantId,
        userId,
        role,
      );
      return {
        ...client,
        matters: client.matters.filter((matter) =>
          accessibleMatterIds?.includes(matter.id),
        ),
      };
    }

    return client;
  }

  async update(
    tenantId: string,
    clientId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateClientDto,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);

    const client = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...dto,
        countryCode: dto.countryCode?.toUpperCase(),
      },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.CLIENT_UPDATED, {
      entityId: clientId,
      action: 'updated',
    });
    this.realtime.publishDashboardRefresh(tenantId, clientId);

    return client;
  }

  async remove(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);
    await this.prisma.client.delete({ where: { id: clientId } });
    return { success: true };
  }

  private async ensureClientReadable(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    const accessibleClientIds = await this.matterAccess.getAccessibleClientIds(
      tenantId,
      userId,
      role,
    );

    if (!accessibleClientIds?.includes(clientId)) {
      throw new NotFoundException('Client not found');
    }
  }
}
