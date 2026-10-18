import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { KycService } from '@/kyc/kyc.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import {
  generateUniqueClientCode,
} from './client-code.util';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly realtime: RealtimePublisherService,
    private readonly kycService: KycService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateClientDto,
    userId?: string,
    role?: string,
  ) {
    // Guard: prevent duplicate email within the same tenant.
    if (dto.email) {
      const existing = await this.prisma.client.findFirst({
        where: { tenantId, email: { equals: dto.email, mode: 'insensitive' } },
        select: { id: true, name: true, clientCode: true },
      });
      if (existing) {
        throw new ConflictException(
          `A client with this email already exists: ${existing.name} (${existing.clientCode})`,
        );
      }
    }

    const clientCode = await generateUniqueClientCode(this.prisma, tenantId, dto.name);

    const client = await this.prisma.client.create({
      data: {
        tenantId,
        clientCode,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        type: dto.type ?? 'INDIVIDUAL',
        countryCode: dto.countryCode?.toUpperCase(),
        contactPeople: dto.contactPeople ? (dto.contactPeople as any) : undefined,
      },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.CLIENT_CREATED, {
      entityId: client.id,
      action: 'created',
      data: { name: client.name },
    });
    this.realtime.publishDashboardRefresh(tenantId, client.id);

    if (userId) {
      try {
        await this.kycService.initializeClientChecklist(
          tenantId,
          client.id,
          userId,
          role,
          {
            clientType: client.type,
            countryCode: client.countryCode ?? undefined,
          },
        );
      } catch (error) {
        this.logger.warn(
          `KYC init failed for client ${client.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return client;
  }

  /**
   * Post-commit side-effects for a client that was created atomically inside
   * a transaction (e.g. StartWork).  The transaction guarantees the row exists;
   * this method fires realtime events and KYC initialization.
   */
  async onClientCreated(
    tenantId: string,
    clientId: string,
    userId?: string,
    role?: string,
  ): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, type: true, countryCode: true },
    });
    if (!client) return;

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.CLIENT_CREATED, {
      entityId: client.id,
      action: 'created',
      data: { name: client.name },
    });
    this.realtime.publishDashboardRefresh(tenantId, client.id);

    if (userId) {
      try {
        await this.kycService.initializeClientChecklist(
          tenantId,
          client.id,
          userId,
          role,
          {
            clientType: client.type,
            countryCode: client.countryCode ?? undefined,
          },
        );
      } catch (error) {
        this.logger.warn(
          `KYC init failed for client ${client.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
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
              { clientCode: { contains: search, mode: 'insensitive' } },
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

  async getActivitySummary(
    tenantId: string,
    clientId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureClientReadable(tenantId, clientId, userId, role);
    const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
      tenantId,
      userId,
      role,
    );
    const matterScope = accessibleMatterIds ? { id: { in: accessibleMatterIds } } : {};
    const relatedMatterScope = accessibleMatterIds
      ? { OR: [{ matterId: null }, { matterId: { in: accessibleMatterIds } }] }
      : {};

    const [client, matters, documents, kycDocuments, meetings, savedResearch] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: clientId, tenantId },
        select: { id: true, name: true, updatedAt: true },
      }),
      this.prisma.matter.findMany({
        where: { tenantId, clientId, ...matterScope },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.document.findMany({
        where: { tenantId, clientId, status: 'ACTIVE', ...relatedMatterScope },
        select: { id: true, fileName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.kycDocument.findMany({
        where: { tenantId, clientId, fileUrl: { not: null } },
        select: { id: true, fileName: true, documentType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.meeting.findMany({
        where: { tenantId, clientId, ...relatedMatterScope },
        select: { id: true, title: true, scheduledAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.savedResearch.findMany({
        where: { tenantId, clientId, ...relatedMatterScope },
        select: { id: true, title: true, matterId: true, aiOutputId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!client) throw new NotFoundException('Client not found');

    const items = [
      {
        id: `client-${client.id}`,
        type: 'CLIENT_UPDATED',
        title: 'Client profile updated',
        description: client.name,
        occurredAt: client.updatedAt,
      },
      ...matters.map((matter) => ({
        id: `matter-${matter.id}`,
        type: 'MATTER_UPDATED',
        title: 'Matter updated',
        description: matter.title,
        occurredAt: matter.updatedAt,
      })),
      ...documents.map((document) => ({
        id: `document-${document.id}`,
        type: 'DOCUMENT_ADDED',
        title: 'Document added',
        description: document.fileName,
        occurredAt: document.createdAt,
      })),
      ...kycDocuments.map((document) => ({
        id: `kyc-${document.id}`,
        type: 'KYC_DOCUMENT_RECEIVED',
        title: 'KYC document received',
        description: document.fileName ?? document.documentType,
        occurredAt: document.createdAt,
      })),
      ...meetings.map((meeting) => ({
        id: `meeting-${meeting.id}`,
        type: 'MEETING_RECORDED',
        title: 'Meeting recorded',
        description: meeting.title,
        occurredAt: meeting.scheduledAt ?? meeting.createdAt,
      })),
      ...savedResearch.map((research) => ({
        id: `research-${research.id}`,
        type: 'RESEARCH_FILED',
        title: 'Legal research filed',
        description: research.title,
        occurredAt: research.createdAt,
        metadata: {
          savedResearchId: research.id,
          matterId: research.matterId,
          aiOutputId: research.aiOutputId,
        },
      })),
    ]
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 12);

    return {
      clientId,
      items,
    };
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
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        type: dto.type,
        countryCode: dto.countryCode?.toUpperCase(),
        contactPeople: dto.contactPeople !== undefined ? (dto.contactPeople as any) : undefined,
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
