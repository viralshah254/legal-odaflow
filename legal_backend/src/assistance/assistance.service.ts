import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateAssistanceRequestDto,
  UpdateAssistanceRequestDto,
} from './dto/assistance.dto';

@Injectable()
export class AssistanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
  ) {}

  async create(
    tenantId: string,
    matterId: string,
    requesterId: string,
    role: string | undefined,
    dto: CreateAssistanceRequestDto,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, requesterId, role);

    return this.prisma.assistanceRequest.create({
      data: {
        tenantId,
        matterId,
        requesterId,
        subject: dto.subject,
        description: dto.description,
        status: dto.status ?? 'OPEN',
      },
    });
  }

  async findAll(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
    status?: string,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    return this.prisma.assistanceRequest.findMany({
      where: {
        tenantId,
        matterId,
        status: status || undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    matterId: string,
    requestId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const request = await this.prisma.assistanceRequest.findFirst({
      where: { id: requestId, tenantId, matterId },
    });

    if (!request) {
      throw new NotFoundException('Assistance request not found');
    }

    return request;
  }

  async update(
    tenantId: string,
    matterId: string,
    requestId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateAssistanceRequestDto,
  ) {
    await this.findOne(tenantId, matterId, requestId, userId, role);

    return this.prisma.assistanceRequest.update({
      where: { id: requestId },
      data: dto,
    });
  }

  private async ensureMatterReadable(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    const access = await this.prisma.matterAccess.findUnique({
      where: { matterId_userId: { matterId, userId } },
    });

    if (!access) {
      throw new ForbiddenException('Matter access denied');
    }
  }
}
