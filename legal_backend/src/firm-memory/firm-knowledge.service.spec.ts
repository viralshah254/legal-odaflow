import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FirmKnowledgeService } from './firm-knowledge.service';

const content = 'Fictional firm playbook. This is not a verified proposition of law.';
const hash = createHash('sha256').update(content).digest('hex');
const item = { id: 'k', tenantId: 'firm', matterId: 'm', documentId: null, createdById: 'alice', lastEditedById: 'alice',
  sourceType: 'custom', sourceId: 'source', title: 'QA', content: 'encrypted', contentHash: hash, revision: 1,
  rightsBasis: 'FIRM_WORK_PRODUCT', rightsExpiresAt: null, status: 'PENDING' };
const review = { expectedRevision: 1, expectedContentHash: hash };
function setup() {
  const prisma: any = { firmKnowledgeItem: { findFirst: jest.fn().mockResolvedValue({ ...item }), findUnique: jest.fn().mockResolvedValue(null),
    findUniqueOrThrow: jest.fn().mockResolvedValue(item), updateMany: jest.fn().mockResolvedValue({ count: 1 }), create: jest.fn() },
    firmKnowledgeReview: { create: jest.fn() }, tenantUser: { count: jest.fn().mockResolvedValue(2) } };
  prisma.$transaction = jest.fn(async callback => callback(prisma));
  const access = { assertActiveMember: jest.fn(async actor => ({ ...actor, tenantRole: 'PARTNER' })), assertMatterReadable: jest.fn().mockResolvedValue(undefined) };
  const embeddings = { getEmbeddingModel: () => 'qa-model', storeChunks: jest.fn().mockResolvedValue({ stored: 1, skipped: 0 }) };
  const encryption = { encryptStringForStorage: jest.fn().mockReturnValue('encrypted'), decryptStringFromStorage: jest.fn().mockReturnValue(content) };
  const service = new FirmKnowledgeService(prisma, access as never, { ensureMatterWriteAccess: jest.fn() } as never,
    { getTenantDocument: jest.fn() } as never, embeddings as never, encryption as never);
  return { prisma, access, embeddings, service };
}

describe('firm knowledge governed promotion', () => {
  it('requires a rights declaration before storing or embedding material', async () => {
    const { service, prisma, embeddings } = setup();
    await expect(service.submit({ tenantId: 'firm', userId: 'alice' }, { sourceType: 'custom', sourceId: 's', content })).rejects.toThrow('rights basis');
    expect(prisma.firmKnowledgeItem.create).not.toHaveBeenCalled();
    expect(embeddings.storeChunks).not.toHaveBeenCalled();
  });
  it('does not allow the maker to approve their own revision in a firm', async () => {
    const { service, embeddings } = setup();
    await expect(service.review({ tenantId: 'firm', userId: 'alice' }, 'k', 'APPROVE', { ...review, selfReviewConfirmed: true })).rejects.toThrow('Independent review');
    expect(embeddings.storeChunks).not.toHaveBeenCalled();
  });
  it('rejects stale content before creating an approval or calling embeddings', async () => {
    const { service, prisma, embeddings } = setup();
    await expect(service.review({ tenantId: 'firm', userId: 'bob' }, 'k', 'APPROVE', { ...review, expectedRevision: 2 })).rejects.toThrow('current revision');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(embeddings.storeChunks).not.toHaveBeenCalled();
  });
  it('records the maker, revision, content hash and source scope before activation', async () => {
    const { service, prisma, embeddings } = setup();
    await service.review({ tenantId: 'firm', userId: 'bob' }, 'k', 'APPROVE', review);
    expect(prisma.firmKnowledgeReview.create).toHaveBeenCalledWith({ data: expect.objectContaining({ makerId: 'alice', reviewerId: 'bob', revision: 1,
      contentHash: hash, decision: 'APPROVE', scope: expect.objectContaining({ matterId: 'm', rightsBasis: 'FIRM_WORK_PRODUCT' }) }) });
    expect(embeddings.storeChunks.mock.calls[0][0][0]).toMatchObject({ tenantId: 'firm', sourceType: 'firm_knowledge', sourceId: 'k@1' });
    expect(prisma.firmKnowledgeItem.updateMany).toHaveBeenLastCalledWith({ where: { id: 'k', revision: 1, status: 'INDEXING' }, data: { status: 'APPROVED' } });
  });
  it('rechecks reviewer authority after indexing and fails closed if it was revoked', async () => {
    const { service, access, prisma } = setup();
    access.assertActiveMember.mockResolvedValueOnce({ tenantId: 'firm', userId: 'bob', tenantRole: 'PARTNER' })
      .mockResolvedValueOnce({ tenantId: 'firm', userId: 'bob', tenantRole: 'ASSOCIATE' });
    await expect(service.review({ tenantId: 'firm', userId: 'bob' }, 'k', 'APPROVE', review)).rejects.toThrow('authority was revoked');
    expect(prisma.firmKnowledgeItem.updateMany).toHaveBeenLastCalledWith({ where: { id: 'k', revision: 1, status: 'INDEXING' }, data: { status: 'INDEX_FAILED' } });
  });
  it('does not let a broad-role reviewer bypass a matter wall', async () => {
    const { service, access, embeddings } = setup();
    access.assertMatterReadable.mockRejectedValue(new ForbiddenException('Wall'));
    await expect(service.review({ tenantId: 'firm', userId: 'bob' }, 'k', 'APPROVE', review)).rejects.toThrow('Wall');
    expect(embeddings.storeChunks).not.toHaveBeenCalled();
  });
  it('requires explicit firm-wide permission and sole-practitioner self-review', async () => {
    const { service, prisma } = setup();
    prisma.firmKnowledgeItem.findFirst.mockResolvedValue({ ...item, matterId: null });
    prisma.tenantUser.count.mockResolvedValue(1);
    await expect(service.review({ tenantId: 'firm', userId: 'alice' }, 'k', 'APPROVE', { ...review, selfReviewConfirmed: true })).rejects.toThrow('firm-wide');
    await service.review({ tenantId: 'firm', userId: 'alice' }, 'k', 'APPROVE', { ...review, selfReviewConfirmed: true, firmWideConfirmed: true });
    expect(prisma.firmKnowledgeReview.create).toHaveBeenCalledWith({ data: expect.objectContaining({ selfReview: true }) });
  });
  it('requires a fresh review after an editor changes another author’s work', async () => {
    const { service, prisma } = setup();
    prisma.firmKnowledgeItem.findFirst.mockResolvedValue({ ...item, lastEditedById: 'bob' });
    await expect(service.review({ tenantId: 'firm', userId: 'bob' }, 'k', 'APPROVE', review)).rejects.toThrow('Independent review');
  });
});
