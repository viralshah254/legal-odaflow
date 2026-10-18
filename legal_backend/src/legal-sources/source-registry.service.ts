import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { LegalSearchDocument } from '@prisma/client';

export interface CanonicalLegalDocument {
  canonicalId: string;       // stable SHA-based ID: jurisdiction:type:citation
  jurisdiction: string;
  documentType: 'statute' | 'case_law' | 'regulation' | 'treaty' | 'directive' | 'constitutional' | 'other';
  title: string;
  citation?: string;         // e.g. "AIR 1976 SC 428" or "42 U.S.C. § 1983"
  court?: string;
  publicationDate?: string;  // ISO date string
  authorityWeight: number;   // 0-100
  treatmentStatus: string;   // good_law | overruled | distinguished | cautionary
  sourceUrl?: string;
  snippet?: string;
  rawText?: string;
  metadata?: Record<string, unknown>;
}

interface UpsertDocumentInput {
  jurisdiction: string;
  documentType: CanonicalLegalDocument['documentType'];
  title: string;
  citation?: string;
  court?: string;
  publicationDate?: Date;
  authorityWeight?: number;
  treatmentStatus?: string;
  sourceUrl?: string;
  rawText?: string;
  metadata?: Record<string, unknown>;
  sourceType?: string; // e.g. 'official_gazette' | 'court_website' | 'manual'
}

@Injectable()
export class SourceRegistryService {
  private readonly logger = new Logger(SourceRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derive a stable canonical ID from jurisdiction + type + citation or title.
   * Format: sha256(jurisdiction:type:citation|title)[:16]
   */
  deriveCanonicalId(input: {
    jurisdiction: string;
    documentType: string;
    citation?: string;
    title?: string;
  }): string {
    const key = [
      input.jurisdiction.toLowerCase().trim(),
      input.documentType.toLowerCase().trim(),
      (input.citation ?? input.title ?? '').toLowerCase().trim(),
    ].join(':');
    return createHash('sha256').update(key).digest('hex').slice(0, 32);
  }

  /**
   * Upserts a legal document into the canonical registry.
   * If a document with the same canonicalId already exists, it is updated.
   * Returns the canonicalId.
   */
  async upsertDocument(input: UpsertDocumentInput): Promise<string> {
    const canonicalId = this.deriveCanonicalId({
      jurisdiction: input.jurisdiction,
      documentType: input.documentType,
      citation: input.citation,
      title: input.title,
    });

    const existing = await this.prisma.legalSearchDocument.findFirst({
      where: { canonicalId },
    });

    if (existing) {
      // Update only the fields that may have changed
      await this.prisma.legalSearchDocument.update({
        where: { id: existing.id },
        data: {
          authorityWeight: input.authorityWeight ?? existing.authorityWeight,
          treatmentStatus: input.treatmentStatus ?? existing.treatmentStatus,
          sourceUrl: input.sourceUrl ?? existing.sourceUrl,
          rawText: input.rawText ?? existing.rawText,
          updatedAt: new Date(),
        },
      });
      return canonicalId;
    }

    await this.prisma.legalSearchDocument.create({
      data: {
        canonicalId,
        jurisdiction: input.jurisdiction,
        documentType: input.documentType,
        title: input.title,
        citation: input.citation ?? null,
        court: input.court ?? null,
        publicationDate: input.publicationDate ?? null,
        authorityWeight: input.authorityWeight ?? 50,
        treatmentStatus: input.treatmentStatus ?? 'good_law',
        sourceUrl: input.sourceUrl ?? null,
        rawText: input.rawText ?? null,
        sourceType: input.sourceType ?? 'manual',
        status: 'active',
      },
    });

    return canonicalId;
  }

  /**
   * Bulk upsert for ingestion pipelines.
   * Deduplicates against existing canonical IDs before inserting.
   */
  async bulkUpsert(inputs: UpsertDocumentInput[]): Promise<{
    created: number;
    updated: number;
    skipped: number;
  }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Derive all canonical IDs up front
    const withIds = inputs.map((input) => ({
      input,
      canonicalId: this.deriveCanonicalId({
        jurisdiction: input.jurisdiction,
        documentType: input.documentType,
        citation: input.citation,
        title: input.title,
      }),
    }));

    // Fetch all existing canonical IDs in one query
    const existingIds = new Set(
      (await this.prisma.legalSearchDocument.findMany({
        where: { canonicalId: { in: withIds.map((w) => w.canonicalId) } },
        select: { canonicalId: true },
      })).map((d) => d.canonicalId),
    );

    const toCreate: typeof withIds = [];
    const toUpdate: typeof withIds = [];

    for (const item of withIds) {
      if (existingIds.has(item.canonicalId)) {
        toUpdate.push(item);
      } else {
        toCreate.push(item);
      }
    }

    // Create new records
    for (const item of toCreate) {
      try {
        await this.prisma.legalSearchDocument.create({
          data: {
            canonicalId: item.canonicalId,
            jurisdiction: item.input.jurisdiction,
            documentType: item.input.documentType,
            title: item.input.title,
            citation: item.input.citation ?? null,
            court: item.input.court ?? null,
            publicationDate: item.input.publicationDate ?? null,
            authorityWeight: item.input.authorityWeight ?? 50,
            treatmentStatus: item.input.treatmentStatus ?? 'good_law',
            sourceUrl: item.input.sourceUrl ?? null,
            rawText: item.input.rawText ?? null,
            sourceType: item.input.sourceType ?? 'manual',
            status: 'active',
          },
        });
        created++;
      } catch (err) {
        this.logger.warn(`Failed to create document ${item.canonicalId}: ${String(err)}`);
        skipped++;
      }
    }

    // Update existing records (only changed fields)
    for (const item of toUpdate) {
      if (!item.input.rawText && !item.input.authorityWeight && !item.input.treatmentStatus) {
        skipped++;
        continue;
      }
      try {
        await this.prisma.legalSearchDocument.updateMany({
          where: { canonicalId: item.canonicalId },
          data: {
            ...(item.input.authorityWeight !== undefined ? { authorityWeight: item.input.authorityWeight } : {}),
            ...(item.input.treatmentStatus ? { treatmentStatus: item.input.treatmentStatus } : {}),
            ...(item.input.rawText ? { rawText: item.input.rawText } : {}),
            updatedAt: new Date(),
          },
        });
        updated++;
      } catch (err) {
        this.logger.warn(`Failed to update document ${item.canonicalId}: ${String(err)}`);
        skipped++;
      }
    }

    this.logger.log(`Bulk upsert: ${created} created, ${updated} updated, ${skipped} skipped`);
    return { created, updated, skipped };
  }

  /**
   * Lookup a document by its canonical ID.
   */
  async findByCanonicalId(canonicalId: string): Promise<LegalSearchDocument | null> {
    return this.prisma.legalSearchDocument.findFirst({ where: { canonicalId } });
  }

  /**
   * Mark a document as overruled or superseded.
   */
  async updateTreatmentStatus(
    canonicalId: string,
    treatmentStatus: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.legalSearchDocument.updateMany({
      where: { canonicalId },
      data: {
        treatmentStatus,
        updatedAt: new Date(),
        ...(reason ? { metadata: { treatmentNote: reason, updatedAt: new Date().toISOString() } } : {}),
      },
    });
  }

  /**
   * Search by jurisdiction + text query with authority-weight ranking.
   */
  async search(query: {
    jurisdiction?: string;
    text?: string;
    documentType?: string;
    treatmentStatus?: string;
    limit?: number;
  }): Promise<LegalSearchDocument[]> {
    return this.prisma.legalSearchDocument.findMany({
      where: {
        ...(query.jurisdiction ? { jurisdiction: query.jurisdiction } : {}),
        ...(query.documentType ? { documentType: query.documentType } : {}),
        ...(query.treatmentStatus ? { treatmentStatus: query.treatmentStatus } : {}),
        status: 'active',
        ...(query.text
          ? {
              OR: [
                { title: { contains: query.text, mode: 'insensitive' } },
                { citation: { contains: query.text, mode: 'insensitive' } },
                { rawText: { contains: query.text, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { authorityWeight: 'desc' },
      take: query.limit ?? 20,
    });
  }
}
