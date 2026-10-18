import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  LegalCorpusAuthorityLevel,
  LegalCorpusDocumentType,
  LegalCorpusExtractionMethod,
  LegalCorpusStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { KenyaExpressionInput, KenyaProvisionInput } from './kenya-corpus.types';

export interface CanonicalExpressionResult {
  documentId: string;
  expressionId: string;
  contentSha256: string;
  created: boolean;
}

@Injectable()
export class LegalCorpusRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestKenyaExpression(
    input: KenyaExpressionInput,
  ): Promise<CanonicalExpressionResult> {
    const contentSha256 = sha256(input.normalizedText);
    const existing = await this.prisma.legalCorpusExpression.findUnique({
      where: { expressionUri: input.expressionUri },
      select: {
        id: true,
        documentId: true,
        contentSha256: true,
        document: { select: { workUri: true } },
      },
    });

    if (existing) {
      if (existing.document.workUri !== input.workUri) {
        throw new ConflictException(
          `Expression URI ${input.expressionUri} belongs to ${existing.document.workUri}, not ${input.workUri}`,
        );
      }
      if (existing.contentSha256 !== contentSha256) {
        await this.prisma.legalCorpusExpression.update({
          where: { id: existing.id },
          data: {
            verificationStatus: 'QUARANTINED',
            metadata: {
              reason: 'SOURCE_CHANGED_WITHOUT_NEW_EXPRESSION_URI',
              observedSha256: contentSha256,
            },
          },
        });
        throw new ConflictException(
          `Expression URI ${input.expressionUri} changed content; quarantined for review`,
        );
      }
      await this.upsertProvisionTree(existing.id, input.provisions);
      return {
        documentId: existing.documentId,
        expressionId: existing.id,
        contentSha256,
        created: false,
      };
    }

    try {
      // Keep the expression shell short; write provisions in batched txs so large
      // acts (100–1000+ sections) do not hit Neon interactive-transaction caps.
      const shell = await this.prisma.$transaction(
        async (tx) => {
          const currentWork = await tx.legalCorpusDocument.findUnique({
            where: { workUri: input.workUri },
            select: {
              expressions: {
                where: { expressionDate: { not: null } },
                orderBy: { expressionDate: 'desc' },
                take: 1,
                select: { expressionDate: true },
              },
            },
          });
          const latestDate = currentWork?.expressions[0]?.expressionDate;
          const canUpdateCurrentWork =
            !currentWork ||
            (!latestDate && Boolean(input.expressionDate)) ||
            (Boolean(input.expressionDate) &&
              Boolean(latestDate) &&
              input.expressionDate!.valueOf() >= latestDate!.valueOf());
          const document = await tx.legalCorpusDocument.upsert({
            where: { workUri: input.workUri },
            create: {
              jurisdiction: 'KE',
              workUri: input.workUri,
              title: input.title,
              shortTitle: input.shortTitle,
              capNumber: input.capNumber,
              actNumber: input.actNumber,
              year: input.year,
              documentType: input.documentType as LegalCorpusDocumentType,
              authorityLevel: input.authorityLevel as LegalCorpusAuthorityLevel,
              status: input.status as LegalCorpusStatus,
              officialSource: input.officialSource,
              metadata: asJson(input.metadata),
            },
            update: canUpdateCurrentWork
              ? {
                  title: input.title,
                  shortTitle: input.shortTitle,
                  capNumber: input.capNumber,
                  actNumber: input.actNumber,
                  year: input.year,
                  documentType: input.documentType as LegalCorpusDocumentType,
                  authorityLevel: input.authorityLevel as LegalCorpusAuthorityLevel,
                  status: input.status as LegalCorpusStatus,
                  officialSource: input.officialSource,
                  metadata: asJson(input.metadata),
                }
              : {},
          });
          const policy = await tx.legalCorpusSourcePolicy.findUnique({
            where: { sourceKey: input.sourcePolicyKey },
            select: { id: true },
          });
          if (!policy) {
            throw new ConflictException(
              `Source policy ${input.sourcePolicyKey} must be configured before ingestion`,
            );
          }

          const expression = await tx.legalCorpusExpression.create({
            data: {
              documentId: document.id,
              expressionUri: input.expressionUri,
              expressionDate: input.expressionDate,
              sourceUrl: input.sourceUrl,
              sourceName: input.sourceName,
              sourceLicense: input.sourceLicense,
              sourcePolicyId: policy.id,
              contentSha256,
              parserVersion: input.parserVersion,
              extractionMethod: input.extractionMethod as LegalCorpusExtractionMethod,
              verificationStatus: input.verificationStatus ?? 'PENDING',
              normalizedText: input.normalizedText,
              searchText: input.searchText,
              citationSafeText: input.citationSafeText,
              metadata: asJson(input.metadata),
            },
          });

          if (input.originalContent) {
            await tx.legalCorpusArtifact.create({
              data: {
                expressionId: expression.id,
                representation: 'ORIGINAL',
                mediaType: input.originalMediaType ?? 'application/octet-stream',
                contentSha256: sha256(input.originalContent),
                byteLength: input.originalContent.byteLength,
                inlineContent: Uint8Array.from(input.originalContent),
              },
            });
          }

          const canonicalId = sha256(
            `ke:${input.documentType}:${input.expressionUri}`,
          ).slice(0, 32);
          await tx.legalSearchDocument.upsert({
            where: { canonicalId },
            create: {
              canonicalId,
              corpusExpressionId: expression.id,
              title: input.title,
              documentType: searchDocumentType(input.documentType),
              jurisdiction: 'KE',
              citation: input.capNumber,
              publicationDate: input.expressionDate,
              effectiveDate: input.expressionDate,
              sourceUrl: input.sourceUrl,
              sourceType: input.sourcePolicyKey,
              authorityWeight: authorityWeight(input.authorityLevel),
              checksum: contentSha256,
              status: searchStatus(input.status),
              rawText: input.searchText,
              metadata: asJson({
                workUri: input.workUri,
                expressionUri: input.expressionUri,
                authorityLevel: input.authorityLevel,
              }),
            },
            update: {
              corpusExpressionId: expression.id,
              checksum: contentSha256,
              sourceUrl: input.sourceUrl,
              rawText: input.searchText,
              metadata: asJson({
                workUri: input.workUri,
                expressionUri: input.expressionUri,
                authorityLevel: input.authorityLevel,
              }),
            },
          });

          return {
            documentId: document.id,
            expressionId: expression.id,
          };
        },
        { timeout: 60_000, maxWait: 10_000 },
      );

      await this.upsertProvisionTree(shell.expressionId, input.provisions);
      return {
        documentId: shell.documentId,
        expressionId: shell.expressionId,
        contentSha256,
        created: true,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.legalCorpusExpression.findUnique({
          where: { expressionUri: input.expressionUri },
          select: {
            id: true,
            documentId: true,
            contentSha256: true,
            document: { select: { workUri: true } },
          },
        });
        if (
          winner &&
          winner.document.workUri === input.workUri &&
          winner.contentSha256 === contentSha256
        ) {
          await this.upsertProvisionTree(winner.id, input.provisions);
          return {
            documentId: winner.documentId,
            expressionId: winner.id,
            contentSha256,
            created: false,
          };
        }
      }
      throw error;
    }
  }

  private async upsertProvisionTree(
    expressionId: string,
    provisions: KenyaProvisionInput[],
  ): Promise<void> {
    if (provisions.length === 0) return;

    const existing = await this.prisma.legalCorpusProvision.findMany({
      where: { expressionId },
      select: { id: true, provisionKey: true },
    });
    const idsByKey = new Map(existing.map((row) => [row.provisionKey, row.id]));
    const pending = [...provisions].sort((a, b) => a.ordinal - b.ordinal);
    let previousPending = pending.length + 1;

    while (pending.length > 0 && pending.length < previousPending) {
      previousPending = pending.length;
      const ready: KenyaProvisionInput[] = [];
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const provision = pending[index];
        if (
          provision.parentProvisionKey &&
          !idsByKey.has(provision.parentProvisionKey)
        ) {
          continue;
        }
        ready.push(provision);
        pending.splice(index, 1);
      }

      for (let offset = 0; offset < ready.length; offset += PROVISION_BATCH_SIZE) {
        const batch = ready.slice(offset, offset + PROVISION_BATCH_SIZE);
        await this.prisma.$transaction(
          async (tx) => {
            for (const provision of batch) {
              const parentId = provision.parentProvisionKey
                ? idsByKey.get(provision.parentProvisionKey)
                : undefined;
              const saved = await tx.legalCorpusProvision.upsert({
                where: {
                  expressionId_provisionKey: {
                    expressionId,
                    provisionKey: provision.provisionKey,
                  },
                },
                create: {
                  expressionId,
                  parentId,
                  provisionKey: provision.provisionKey,
                  provisionType: provision.provisionType,
                  label: provision.label,
                  heading: provision.heading,
                  ordinal: provision.ordinal,
                  text: provision.text,
                  citationSafeText: provision.citationSafeText,
                  sourceAnchor: provision.sourceAnchor,
                  contentSha256: sha256(provision.text),
                  metadata: asJson(provision.metadata),
                },
                update: {
                  parentId,
                  provisionType: provision.provisionType,
                  label: provision.label,
                  heading: provision.heading,
                  ordinal: provision.ordinal,
                  text: provision.text,
                  citationSafeText: provision.citationSafeText,
                  sourceAnchor: provision.sourceAnchor,
                  contentSha256: sha256(provision.text),
                  metadata: asJson(provision.metadata),
                },
                select: { id: true },
              });
              idsByKey.set(provision.provisionKey, saved.id);
            }
          },
          { timeout: 60_000, maxWait: 10_000 },
        );
      }
    }

    if (pending.length > 0) {
      throw new ConflictException(
        `Unresolved provision parents: ${pending
          .map((item) => item.parentProvisionKey)
          .filter(Boolean)
          .join(', ')}`,
      );
    }
  }

  /** Mark older Kenya Law expressions superseded when a newer point-in-time is ingested. */
  async markSupersededKenyaExpressions(
    workUri: string,
    keepExpressionUri: string,
  ): Promise<number> {
    const document = await this.prisma.legalCorpusDocument.findUnique({
      where: { workUri },
      select: { id: true },
    });
    if (!document) return 0;

    const olderExpressions = await this.prisma.legalCorpusExpression.findMany({
      where: {
        documentId: document.id,
        expressionUri: { not: keepExpressionUri },
      },
      select: { id: true, expressionUri: true },
    });

    if (olderExpressions.length === 0) return 0;

    for (const expression of olderExpressions) {
      await this.prisma.legalSearchDocument.updateMany({
        where: { corpusExpressionId: expression.id },
        data: { status: 'superseded' },
      });
    }

    return olderExpressions.length;
  }
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

const PROVISION_BATCH_SIZE = 25;

function asJson(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

function authorityWeight(level: KenyaExpressionInput['authorityLevel']): number {
  switch (level) {
    case 'OFFICIAL_PRIMARY':
      return 100;
    case 'OFFICIAL_PROSPECTIVE':
      return 70;
    case 'OFFICIAL_ADMINISTRATIVE':
      return 60;
    case 'SECONDARY':
      return 30;
  }
}

function searchDocumentType(type: KenyaExpressionInput['documentType']): string {
  if (type === 'JUDGMENT') return 'case_law';
  if (type === 'CONSTITUTION') return 'constitutional';
  if (type === 'REGULATION' || type === 'RULE' || type === 'ORDER') return 'regulation';
  if (type === 'TREATY' || type === 'EAC_INSTRUMENT') return 'treaty';
  if (type === 'PRACTICE_DIRECTION') return 'practice_direction';
  if (type === 'BILL') return 'bill';
  return 'statute';
}

function searchStatus(status: KenyaExpressionInput['status']): string {
  if (status === 'PROSPECTIVE') return 'draft';
  if (status === 'REPEALED') return 'repealed';
  if (status === 'SUPERSEDED') return 'superseded';
  return 'active';
}
