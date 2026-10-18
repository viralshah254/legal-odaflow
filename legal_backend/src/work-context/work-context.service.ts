import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ClientsService } from '@/clients/clients.service';
import { MattersService } from '@/matters/matters.service';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';
import { generateUniqueClientCode } from '@/clients/client-code.util';
import type { StartWorkRequestDto } from './start-work.dto';

export type StartWorkMode = 'existing_client' | 'new_client' | 'unassigned';
export type StartWorkDto = StartWorkRequestDto;

function payloadFingerprint(dto: StartWorkRequestDto): string {
  return createHash('sha256').update(JSON.stringify(dto)).digest('hex');
}

@Injectable()
export class WorkContextService {
  private readonly logger = new Logger(WorkContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly matters: MattersService,
    private readonly access: ArtifactAccessResolver,
  ) {}

  private mapExisting(existing: {
    scopeKey: string;
    clientId: string | null;
    matterId: string | null;
    payloadJson: unknown;
  }) {
    const fp = payloadFingerprint(existing.payloadJson as unknown as StartWorkRequestDto);
    return {
      scopeKey: existing.scopeKey,
      standalone: !existing.clientId && !existing.matterId,
      clientId: existing.clientId,
      matterId: existing.matterId,
      payloadFingerprint: fp,
    };
  }

  async startWork(
    actor: { tenantId: string; userId: string; tenantRole?: string },
    dto: StartWorkRequestDto,
  ) {
    // Idempotency key: prefer caller-supplied key, fall back to content hash.
    // operationRequestKey scopes to the specific per-intent retry (C04/B05 fix).
    const idempotencyKey =
      dto.idempotencyKey ??
      createHash('sha256')
        .update(
          JSON.stringify({
            mode: dto.mode,
            clientId: dto.clientId,
            matterId: dto.matterId,
            operationRequestKey: dto.operationRequestKey,
          }),
        )
        .digest('hex')
        .slice(0, 24);

    const fingerprint = payloadFingerprint(dto);

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
      const storedFp = payloadFingerprint(
        existing.payloadJson as unknown as StartWorkRequestDto,
      );
      if (storedFp !== fingerprint) {
        throw new ConflictException('Idempotency key reused with a different payload');
      }
      return this.mapExisting(existing);
    }

    const scopeKey = createHash('sha256')
      .update(`${actor.tenantId}:${actor.userId}:${idempotencyKey}`)
      .digest('hex')
      .slice(0, 16);

    const resolvedCountry =
      dto.countryCode ??
      dto.createMatter?.countryCode ??
      dto.createClient?.countryCode ??
      undefined;

    if (dto.mode === 'unassigned') {
      try {
        await this.prisma.workContextOperation.create({
          data: {
            tenantId: actor.tenantId,
            userId: actor.userId,
            idempotencyKey,
            scopeKey,
            payloadJson: { ...dto, countryCode: resolvedCountry } as object,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const raced = await this.prisma.workContextOperation.findUniqueOrThrow({
            where: {
              tenantId_userId_idempotencyKey: {
                tenantId: actor.tenantId,
                userId: actor.userId,
                idempotencyKey,
              },
            },
          });
          return this.mapExisting(raced);
        }
        throw err;
      }
      return {
        scopeKey,
        standalone: true,
        clientId: null as string | null,
        matterId: null as string | null,
      };
    }

    // -----------------------------------------------------------------------
    // Atomic creation: Client and Matter are created directly on the Prisma
    // transaction handle (`tx`) so that all three rows (client, matter,
    // workContextOperation) are committed together or rolled back together.
    //
    // B03 fix: the previous code called this.clients.create() / this.matters.create()
    // which use the *global* this.prisma and are NOT rolled back if the
    // workContextOperation insert fails or if the transaction is aborted.
    //
    // Side-effects (KYC checklist, playbook tasks, realtime events) that require
    // network calls or additional DB writes happen AFTER the transaction commits.
    // -----------------------------------------------------------------------
    let postCommitSideEffects: Array<() => Promise<void>> = [];

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let clientId = dto.clientId;

        if (dto.mode === 'new_client' && dto.createClient) {
          // Inline client creation on tx — no side-effect services inside the tx
          const countryCode = (
            dto.createClient.countryCode ??
            resolvedCountry ??
            'IN'
          ).toUpperCase();

          // Duplicate-email guard (within the same tenant)
          if (dto.createClient.email) {
            const dup = await tx.client.findFirst({
              where: {
                tenantId: actor.tenantId,
                email: { equals: dto.createClient.email, mode: 'insensitive' },
              },
              select: { id: true, name: true, clientCode: true },
            });
            if (dup) {
              throw new ConflictException(
                `A client with this email already exists: ${dup.name} (${dup.clientCode})`,
              );
            }
          }

          const clientCode = await generateUniqueClientCode(
            tx as unknown as Parameters<typeof generateUniqueClientCode>[0],
            actor.tenantId,
            dto.createClient.name,
          );

          const createdClient = await tx.client.create({
            data: {
              tenantId: actor.tenantId,
              clientCode,
              name: dto.createClient.name,
              email: dto.createClient.email,
              phone: dto.createClient.phone,
              type: 'INDIVIDUAL',
              countryCode,
            },
          });
          clientId = createdClient.id;

          // Schedule realtime + KYC after commit (best-effort)
          const capturedClientId = clientId;
          postCommitSideEffects.push(async () => {
            try {
              await this.clients.onClientCreated(
                actor.tenantId,
                capturedClientId,
                actor.userId,
                actor.tenantRole,
              );
            } catch (e) {
              this.logger.warn(
                `StartWork side-effect (onClientCreated) failed for ${capturedClientId}: ${String(e)}`,
              );
            }
          });
        }

        if (!clientId) {
          throw new BadRequestException('clientId is required for this start mode');
        }

        await this.access.assertClientReadable(actor, clientId);

        let matterId = dto.matterId;

        if (!matterId && dto.createMatter) {
          // Inline matter creation on tx
          const matterCountryCode = (
            dto.createMatter.countryCode ??
            dto.createClient?.countryCode ??
            resolvedCountry ??
            'IN'
          ).toUpperCase();

          const createdMatter = await tx.matter.create({
            data: {
              tenantId: actor.tenantId,
              clientId,
              title: dto.createMatter.title,
              countryCode: matterCountryCode,
              jurisdiction: dto.createMatter.jurisdiction ?? 'General',
              matterType: dto.createMatter.matterType ?? 'general',
              practiceArea: 'general',
              status: 'OPEN',
            },
          });
          matterId = createdMatter.id;

          // Schedule playbook + timeline after commit (best-effort)
          const capturedMatterId = matterId;
          const capturedCountry = matterCountryCode;
          const capturedMatterType = dto.createMatter.matterType ?? 'general';
          postCommitSideEffects.push(async () => {
            try {
              await this.matters.onMatterCreated(
                actor.tenantId,
                capturedMatterId,
                capturedCountry,
                capturedMatterType,
                actor.userId,
              );
            } catch (e) {
              this.logger.warn(
                `StartWork side-effect (onMatterCreated) failed for ${capturedMatterId}: ${String(e)}`,
              );
            }
          });
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
            payloadJson: { ...dto, countryCode: resolvedCountry } as object,
          },
        });

        return {
          scopeKey,
          standalone: false,
          clientId,
          matterId: matterId ?? null,
        };
      });

      // Fire post-commit side-effects after the tx succeeds
      for (const fn of postCommitSideEffects) {
        void fn();
      }

      return result;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const raced = await this.prisma.workContextOperation.findUniqueOrThrow({
          where: {
            tenantId_userId_idempotencyKey: {
              tenantId: actor.tenantId,
              userId: actor.userId,
              idempotencyKey,
            },
          },
        });
        const storedFp = payloadFingerprint(
          raced.payloadJson as unknown as StartWorkRequestDto,
        );
        if (storedFp !== fingerprint) {
          throw new ConflictException('Idempotency key reused with a different payload');
        }
        return this.mapExisting(raced);
      }
      throw err;
    }
  }
}
