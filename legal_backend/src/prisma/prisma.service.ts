import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Compile-time guard: run `npm run prisma:generate` after schema edits. */
type _SeriesAPrismaModels = [
  PrismaClient['marketplaceRevenueEntry'],
  Prisma.LawyerLeadUpdateInput,
];

/**
 * NestJS wrapper around the generated Prisma client.
 * After schema changes: `npm run prisma:generate` then restart TS server / dev.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
