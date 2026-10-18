import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { retryDb } from '@/common/utils/retry-db';

/** Compile-time guard: run `npm run prisma:generate` after schema edits. */
type _PrismaDelegateGuard = [
  PrismaClient['marketplaceRevenueEntry'],
  PrismaClient['leadDocument'],
  PrismaClient['matterNote'],
  PrismaClient['draftingSession'],
  PrismaClient['statuteSectionProfile'],
  PrismaClient['legalAuthorityTranslation'],
  PrismaClient['sectionFinderPopularQuery'],
  PrismaClient['statuteActCache'],
  PrismaClient['sectionFinderUnmatchedQuery'],
  PrismaClient['workflowRun'],
  PrismaClient['workflowStageRun'],
  PrismaClient['workflowCostLedger'],
  PrismaClient['outboxEvent'],
  PrismaClient['idempotencyRecord'],
  PrismaClient['smartWorkspace'],
  PrismaClient['workspaceDocument'],
  PrismaClient['documentAnnotation'],
  PrismaClient['workspaceLink'],
  PrismaClient['canvasNode'],
  PrismaClient['issueCheckerSearchLog'],
  PrismaClient['savedResearch'],
  Prisma.LawyerLeadUpdateInput,
  Prisma.UserGetPayload<{ select: { mustChangePassword: true } }>,
  Prisma.InvoiceUncheckedCreateInput['metadata'],
  Prisma.InvoiceUncheckedCreateInput['billingModel'],
  Prisma.MatterSelect['matterProfile'],
  Prisma.MatterUpdateInput['matterProfile'],
  Prisma.ConsumerCaseSelect['matterProfile'],
  Prisma.DraftingSessionSelect['matterProfile'],
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
  override get statuteSectionProfile(): PrismaClient['statuteSectionProfile'] {
    return super.statuteSectionProfile;
  }

  override get legalAuthorityTranslation(): PrismaClient['legalAuthorityTranslation'] {
    return super.legalAuthorityTranslation;
  }

  override get sectionFinderPopularQuery(): PrismaClient['sectionFinderPopularQuery'] {
    return super.sectionFinderPopularQuery;
  }

  override get statuteActCache(): PrismaClient['statuteActCache'] {
    return super.statuteActCache;
  }

  override get sectionFinderUnmatchedQuery(): PrismaClient['sectionFinderUnmatchedQuery'] {
    return super.sectionFinderUnmatchedQuery;
  }

  override get draftingSession(): PrismaClient['draftingSession'] {
    return super.draftingSession;
  }

  override get draftJob(): PrismaClient['draftJob'] {
    return super.draftJob;
  }

  override get draftJobSection(): PrismaClient['draftJobSection'] {
    return super.draftJobSection;
  }

  override get draftJobStageResult(): PrismaClient['draftJobStageResult'] {
    return super.draftJobStageResult;
  }

  override get draftJobIssue(): PrismaClient['draftJobIssue'] {
    return super.draftJobIssue;
  }

  override get draftJobRepair(): PrismaClient['draftJobRepair'] {
    return super.draftJobRepair;
  }

  override get draftJobAuditEvent(): PrismaClient['draftJobAuditEvent'] {
    return super.draftJobAuditEvent;
  }

  override get draftJobModelUsage(): PrismaClient['draftJobModelUsage'] {
    return super.draftJobModelUsage;
  }

  override get smartWorkspace(): PrismaClient['smartWorkspace'] {
    return super.smartWorkspace;
  }

  override get workspaceDocument(): PrismaClient['workspaceDocument'] {
    return super.workspaceDocument;
  }

  override get documentAnnotation(): PrismaClient['documentAnnotation'] {
    return super.documentAnnotation;
  }

  override get workspaceLink(): PrismaClient['workspaceLink'] {
    return super.workspaceLink;
  }

  override get canvasNode(): PrismaClient['canvasNode'] {
    return super.canvasNode;
  }

  override get issueCheckerSearchLog(): PrismaClient['issueCheckerSearchLog'] {
    return super.issueCheckerSearchLog;
  }

  override get savedResearch(): PrismaClient['savedResearch'] {
    return super.savedResearch;
  }

  async onModuleInit() {
    await retryDb(() => this.$connect());
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
