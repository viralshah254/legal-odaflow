import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { ArtifactAccessResolver, AccessActor } from '@/access/artifact-access.resolver';
import { MatterAccessService } from '@/access/matter-access.service';
import { DocumentsService } from '@/documents/documents.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/security/encryption.service';
import type { FirmKnowledgeItem } from '@prisma/client';

const REVIEW_ROLES = new Set(['FIRM_ADMIN', 'PARTNER', 'PARTNER_ADMIN']);
const SUBMIT_ROLES = new Set([...REVIEW_ROLES, 'JUNIOR_PARTNER', 'ASSOCIATE', 'PARALEGAL', 'ADVOCATE', 'SENIOR_ADVOCATE', 'LAWYER']);
const RIGHTS = new Set(['FIRM_WORK_PRODUCT', 'LICENSED_INTERNAL_USE', 'PUBLIC_DOMAIN']);
const SOURCE_TYPES = new Set(['approved_redline', 'strategy_memo', 'meeting_notes', 'custom']);
const metadataSelect = { id: true, tenantId: true, matterId: true, documentId: true, createdById: true, lastEditedById: true, sourceType: true, sourceId: true,
  title: true, contentHash: true, revision: true, rightsBasis: true, rightsExpiresAt: true, status: true, createdAt: true, updatedAt: true } as const;
export interface KnowledgeSubmission {
  sourceType: string; sourceId: string; title?: string; content: string; matterId?: string; documentId?: string;
  rightsBasis?: string; rightsConfirmed?: boolean; rightsExpiresAt?: string;
}
export interface KnowledgeReview {
  expectedRevision: number; expectedContentHash: string; note?: string;
  selfReviewConfirmed?: boolean; firmWideConfirmed?: boolean;
}

/** Reviewed retrieval within a firm. Approval is not legal-source verification
 * and does not enable provider training or sharing between firms. */
@Injectable()
export class FirmKnowledgeService {
  constructor(private readonly prisma: PrismaService, private readonly access: ArtifactAccessResolver,
    private readonly matterAccess: MatterAccessService, private readonly documents: DocumentsService,
    private readonly embeddings: EmbeddingService, private readonly encryption: EncryptionService) {}

  async checkScope(actor: AccessActor, item: { matterId: string | null; documentId?: string | null }): Promise<void> {
    if (item.matterId) await this.access.assertMatterReadable(actor, item.matterId);
    if (item.documentId) {
      const source = await this.documents.getTenantDocument(actor.tenantId, item.documentId, actor.userId, actor.tenantRole);
      if ((source.matterId ?? null) !== item.matterId) throw new ForbiddenException('Knowledge source matter mismatch');
    }
  }

  async submit(inputActor: AccessActor, input: KnowledgeSubmission) {
    const actor = await this.access.assertActiveMember(inputActor);
    if (!SUBMIT_ROLES.has(actor.tenantRole ?? '')) throw new ForbiddenException('Knowledge submission is not available for this role');
    if (!SOURCE_TYPES.has(input.sourceType) || typeof input.sourceId !== 'string' || !input.sourceId.trim() || input.sourceId.length > 200 ||
        typeof input.content !== 'string' || !input.content.trim() || input.content.length > 100_000 || (input.title?.length ?? 0) > 300) {
      throw new BadRequestException('Provide a supported source, title and content of at most 100,000 characters');
    }
    if (input.rightsConfirmed !== true || !RIGHTS.has(input.rightsBasis ?? '')) throw new BadRequestException('Confirm the rights basis before submitting firm knowledge');
    let matterId = input.matterId ?? null;
    if (input.documentId) {
      const source = await this.documents.getTenantDocument(actor.tenantId, input.documentId, actor.userId, actor.tenantRole);
      if (matterId && source.matterId !== matterId) throw new BadRequestException('Document belongs to a different matter');
      matterId = source.matterId;
    }
    await this.checkScope(actor, { matterId, documentId: input.documentId });
    if (matterId) await this.matterAccess.ensureMatterWriteAccess(actor.tenantId, actor.userId, matterId, actor.tenantRole);
    const existing = await this.prisma.firmKnowledgeItem.findUnique({ where: { tenantId_sourceType_sourceId: {
      tenantId: actor.tenantId, sourceType: input.sourceType, sourceId: input.sourceId,
    } } });
    if (existing) {
      await this.checkScope(actor, existing);
      if (existing.createdById !== actor.userId && !REVIEW_ROLES.has(actor.tenantRole ?? '')) throw new ForbiddenException('Knowledge edit denied');
      if (existing.matterId) await this.matterAccess.ensureMatterWriteAccess(actor.tenantId, actor.userId, existing.matterId, actor.tenantRole);
    }
    const id = existing?.id ?? randomUUID();
    const content = input.content.trim();
    const rightsExpiresAt = input.rightsExpiresAt ? new Date(input.rightsExpiresAt) : null;
    if (rightsExpiresAt && (!Number.isFinite(rightsExpiresAt.getTime()) || rightsExpiresAt <= new Date())) throw new BadRequestException('Rights expiry must be a future timestamp');
    const data = { lastEditedById: actor.userId, matterId, documentId: input.documentId ?? null, title: input.title?.trim() || input.sourceType,
      content: this.encryption.encryptStringForStorage(content, `firm-knowledge:${id}`), contentHash: this.hash(content),
      rightsBasis: input.rightsBasis!, rightsExpiresAt, status: 'PENDING' };
    if (existing) {
      const updated = await this.prisma.firmKnowledgeItem.updateMany({ where: { id, tenantId: actor.tenantId, revision: existing.revision }, data: { ...data, revision: { increment: 1 } } });
      if (!updated.count) throw new ConflictException('Knowledge changed; refresh before submitting');
    } else {
      await this.prisma.firmKnowledgeItem.create({ data: { ...data, id, tenantId: actor.tenantId, createdById: actor.userId, sourceType: input.sourceType, sourceId: input.sourceId } });
    }
    return this.prisma.firmKnowledgeItem.findUniqueOrThrow({ where: { id }, select: metadataSelect });
  }

  async list(inputActor: AccessActor) {
    const actor = await this.access.assertActiveMember(inputActor);
    const rows = await this.prisma.firmKnowledgeItem.findMany({ where: { tenantId: actor.tenantId,
      ...(!REVIEW_ROLES.has(actor.tenantRole ?? '') ? { OR: [{ status: 'APPROVED' }, { createdById: actor.userId }] } : {}),
    }, orderBy: { updatedAt: 'desc' }, take: 100, select: metadataSelect });
    const visible: typeof rows = [];
    for (const row of rows) {
      try { await this.checkScope(actor, row); visible.push(row); }
      catch (error) { if (!(error instanceof ForbiddenException || error instanceof NotFoundException)) throw error; }
    }
    return { items: visible.map(row => ({ ...row, rightsExpired: Boolean(row.rightsExpiresAt && row.rightsExpiresAt <= new Date()) })), count: visible.length, limit: 100, canReview: REVIEW_ROLES.has(actor.tenantRole ?? ''), canSubmit: SUBMIT_ROLES.has(actor.tenantRole ?? ''), independentReviewRequired: (await this.prisma.tenantUser.count({ where: { tenantId: actor.tenantId, status: 'ACTIVE' } })) > 1 };
  }

  async get(inputActor: AccessActor, id: string) {
    const actor = await this.access.assertActiveMember(inputActor);
    const item = await this.requireItem(actor, id);
    if (item.status !== 'APPROVED' && item.createdById !== actor.userId && !REVIEW_ROLES.has(actor.tenantRole ?? '')) throw new NotFoundException('Knowledge item not found');
    const reviews = await this.prisma.firmKnowledgeReview.findMany({ where: { itemId: id, tenantId: actor.tenantId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return { ...item, content: item.rightsExpiresAt && item.rightsExpiresAt <= new Date() ? '' : this.decrypt(item), rightsExpired: Boolean(item.rightsExpiresAt && item.rightsExpiresAt <= new Date()), reviews };
  }

  async review(inputActor: AccessActor, id: string, decision: 'APPROVE' | 'REJECT' | 'REVOKE', input: KnowledgeReview) {
    const actor = await this.access.assertActiveMember(inputActor);
    const item = await this.requireItem(actor, id);
    if (!REVIEW_ROLES.has(actor.tenantRole ?? '') && !(decision === 'REVOKE' && item.createdById === actor.userId)) throw new ForbiddenException('A partner or firm administrator must review knowledge');
    if (input.expectedRevision !== item.revision || input.expectedContentHash !== item.contentHash) throw new ConflictException('Knowledge changed; review the current revision');
    if ((input.note?.length ?? 0) > 2000) throw new BadRequestException('Review note is too long');
    if (decision !== 'REVOKE' && !['PENDING', 'INDEX_FAILED'].includes(item.status)) throw new ConflictException('This revision has already been reviewed');
    let selfReview = false;
    if (decision === 'APPROVE') {
      if (!item.matterId && input.firmWideConfirmed !== true) throw new BadRequestException('Confirm that this material may be shared firm-wide');
      if (item.rightsExpiresAt && item.rightsExpiresAt <= new Date()) throw new ForbiddenException('Source rights have expired');
      if (item.lastEditedById === actor.userId) {
        const members = await this.prisma.tenantUser.count({ where: { tenantId: actor.tenantId, status: 'ACTIVE' } });
        if (members > 1 || input.selfReviewConfirmed !== true) throw new ForbiddenException('Independent review is required; a sole practitioner must explicitly confirm self-review');
        selfReview = true;
      }
    }
    const status = decision === 'APPROVE' ? 'INDEXING' : decision === 'REJECT' ? 'REJECTED' : 'REVOKED';
    await this.prisma.$transaction(async tx => {
      const changed = await tx.firmKnowledgeItem.updateMany({ where: { id, tenantId: actor.tenantId, revision: item.revision, contentHash: item.contentHash, status: item.status }, data: { status } });
      if (!changed.count) throw new ConflictException('Knowledge changed during review');
      await tx.firmKnowledgeReview.create({ data: { tenantId: actor.tenantId, itemId: id, reviewerId: actor.userId, makerId: item.lastEditedById, scope: { matterId: item.matterId, documentId: item.documentId, rightsBasis: item.rightsBasis, rightsExpiresAt: item.rightsExpiresAt?.toISOString() ?? null }, decision, revision: item.revision, contentHash: item.contentHash, selfReview, note: input.note } });
    });
    if (decision === 'APPROVE') {
      try {
        const content = this.decrypt(item);
        if (this.hash(content) !== item.contentHash) throw new Error('Knowledge content integrity mismatch');
        const chunks = this.chunks(content).map((text, index) => ({ sourceType: 'firm_knowledge', sourceId: `${id}@${item.revision}`, tenantId: actor.tenantId,
          chunkIndex: index, content: text, modelName: this.embeddings.getEmbeddingModel(),
          metadata: { tenantId: actor.tenantId, matterId: item.matterId, knowledgeRevision: item.revision, approvedForRetrieval: true } }));
        const indexed = await this.embeddings.storeChunks(chunks);
        if (indexed.stored + indexed.skipped !== chunks.length) throw new Error('Knowledge indexing incomplete');
        const currentActor = await this.access.assertActiveMember(actor);
        if (!REVIEW_ROLES.has(currentActor.tenantRole ?? '')) throw new ForbiddenException('Review authority was revoked while indexing');
        if (item.rightsExpiresAt && item.rightsExpiresAt <= new Date()) throw new ForbiddenException('Source rights expired while indexing');
        if (selfReview && await this.prisma.tenantUser.count({ where: { tenantId: actor.tenantId, status: 'ACTIVE' } }) > 1) throw new ForbiddenException('Independent review is now required');
        await this.checkScope(currentActor, item);
        const activated = await this.prisma.firmKnowledgeItem.updateMany({ where: { id, revision: item.revision, status: 'INDEXING' }, data: { status: 'APPROVED' } });
        if (!activated.count) throw new ConflictException('Knowledge changed while indexing');
      } catch (error) {
        await this.prisma.firmKnowledgeItem.updateMany({ where: { id, revision: item.revision, status: 'INDEXING' }, data: { status: 'INDEX_FAILED' } });
        throw error;
      }
    }
    return this.prisma.firmKnowledgeItem.findUniqueOrThrow({ where: { id }, select: metadataSelect });
  }

  private async requireItem(actor: AccessActor, id: string) {
    const item = await this.prisma.firmKnowledgeItem.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!item) throw new NotFoundException('Knowledge item not found');
    await this.checkScope(actor, item);
    return item;
  }
  private decrypt(item: FirmKnowledgeItem): string { return this.encryption.decryptStringFromStorage(item.content, `firm-knowledge:${item.id}`) ?? ''; }
  private hash(text: string): string { return createHash('sha256').update(text).digest('hex'); }
  private chunks(text: string): string[] {
    const chunks: string[] = [];
    for (let offset = 0; offset < text.length; offset += 1600) chunks.push(text.slice(offset, offset + 1800));
    return chunks;
  }
}
