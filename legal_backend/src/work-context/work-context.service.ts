import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { ClientsService } from '@/clients/clients.service';
import { MattersService } from '@/matters/matters.service';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';

export type StartWorkMode = 'existing_client' | 'new_client' | 'unassigned';

export interface StartWorkDto {
  mode: StartWorkMode;
  clientId?: string;
  matterId?: string;
  createClient?: { name: string; email?: string; phone?: string; countryCode?: string };
  createMatter?: { title: string; jurisdiction?: string; matterType?: string; countryCode?: string };
  idempotencyKey?: string;
}

@Injectable()
export class WorkContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly matters: MattersService,
    private readonly access: ArtifactAccessResolver,
  ) {}

  async startWork(
    actor: { tenantId: string; userId: string; tenantRole?: string },
    dto: StartWorkDto,
  ) {
    const idempotencyKey =
      dto.idempotencyKey ??
      createHash('sha256').update(JSON.stringify({ mode: dto.mode, clientId: dto.clientId, matterId: dto.matterId })).digest('hex').slice(0, 24);

    const existing = await this.prisma.workContextOperation.findUnique({
      where: {
        tenantId_userId_idempotencyKey: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      return {
        scopeKey: existing.scopeKey,
        standalone: !existing.clientId && !existing.matterId,
        clientId: existing.clientId,
        matterId: existing.matterId,
      };
    }

    const scopeKey = createHash('sha256')
      .update(`${actor.tenantId}:${actor.userId}:${idempotencyKey}`)
      .digest('hex')
      .slice(0, 16);

    if (dto.mode === 'unassigned') {
      await this.prisma.workContextOperation.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          idempotencyKey,
          scopeKey,
          payloadJson: dto as object,
        },
      });
      return {
        scopeKey,
        standalone: true,
        clientId: null as string | null,
        matterId: null as string | null,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      let clientId = dto.clientId;
      if (dto.mode === 'new_client' && dto.createClient) {
        const created = await this.clients.create(actor.tenantId, {
          name: dto.createClient.name,
          email: dto.createClient.email,
          phone: dto.createClient.phone,
          countryCode: dto.createClient.countryCode ?? 'IN',
          type: 'individual',
        });
        clientId = created.id;
      }

      if (!clientId) {
        throw new BadRequestException('clientId is required for this start mode');
      }

      await this.access.assertClientReadable(actor, clientId);

      let matterId = dto.matterId;
      if (!matterId && dto.createMatter) {
        const matter = await this.matters.create(
          actor.tenantId,
          {
            clientId,
            title: dto.createMatter.title,
            jurisdiction: dto.createMatter.jurisdiction ?? 'General',
            matterType: dto.createMatter.matterType ?? 'general',
            practiceArea: 'general',
            countryCode: dto.createMatter.countryCode ?? dto.createClient?.countryCode ?? 'IN',
          },
          actor.userId,
        );
        matterId = matter.id;
      }

      if (matterId) {
        await this.access.assertClientMatterLink(actor, clientId, matterId);
      }

      await tx.workContextOperation.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          idempotencyKey,
          scopeKey,
          clientId,
          matterId: matterId ?? null,
          payloadJson: dto as object,
        },
      });

      return {
        scopeKey,
        standalone: false,
        clientId,
        matterId: matterId ?? null,
      };
    });
  }
}
