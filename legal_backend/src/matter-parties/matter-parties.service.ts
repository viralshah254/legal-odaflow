import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMatterPartyDto, UpdateMatterPartyDto } from './dto/matter-party.dto';

@Injectable()
export class MatterPartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
  ) {}

  create(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateMatterPartyDto,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterParty.create({
        data: {
          tenantId,
          matterId,
          role: dto.role,
          name: dto.name,
          organization: dto.organization,
          email: dto.email,
          phone: dto.phone,
          notes: dto.notes,
        },
      }),
    );
  }

  findAll(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterParty.findMany({
        where: { tenantId, matterId },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async update(
    tenantId: string,
    matterId: string,
    partyId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateMatterPartyDto,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const party = await this.prisma.matterParty.findFirst({
        where: { id: partyId, tenantId, matterId },
      });

      if (!party) {
        throw new NotFoundException('Party not found');
      }

      return this.prisma.matterParty.update({
        where: { id: partyId },
        data: {
          role: dto.role,
          name: dto.name,
          organization: dto.organization,
          email: dto.email,
          phone: dto.phone,
          notes: dto.notes,
        },
      });
    });
  }

  async remove(
    tenantId: string,
    matterId: string,
    partyId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const party = await this.prisma.matterParty.findFirst({
        where: { id: partyId, tenantId, matterId },
      });

      if (!party) {
        throw new NotFoundException('Party not found');
      }

      return this.prisma.matterParty.delete({ where: { id: partyId } });
    });
  }

  private async withMatterAccess<T>(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (!this.matterAccess.hasFullAccess(role)) {
      try {
        await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
      } catch {
        throw new ForbiddenException('Matter access denied');
      }
    }

    return fn();
  }
}
