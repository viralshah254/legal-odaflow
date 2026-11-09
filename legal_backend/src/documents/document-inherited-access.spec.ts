import { ForbiddenException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

describe('Document inherited restrictions', () => {
  function setup(rules: unknown[]) {
    const service = Object.create(DocumentsService.prototype) as any;
    service.prisma = {
      documentFolder: { findFirst: jest.fn(({ where }) => Promise.resolve({ parentId: where.id === 'child' ? 'parent' : null })) },
      documentAccessRule: { findMany: jest.fn().mockResolvedValue(rules) },
    };
    service.matterAccess = { ensureMatterAccess: jest.fn().mockResolvedValue(undefined), ensureMatterWriteAccess: jest.fn().mockResolvedValue(undefined) };
    service.hasDefaultDocumentAccess = jest.fn().mockResolvedValue(true);
    return service;
  }
  const doc = { id: 'doc', folderId: 'child', matterId: 'matter', uploadedById: 'alice' };
  it('does not allow an uploader or child grant to bypass a restricted parent folder', async () => {
    const service = setup([
      { folderId: 'parent', userId: 'bob', accessLevel: 'READ' },
      { documentId: 'doc', userId: 'alice', accessLevel: 'ADMIN' },
    ]);
    await expect(service.assertDocumentAccess('firm', doc, 'alice', 'PARTNER', 'READ')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('requires a sufficient grant in each restricted scope', async () => {
    const service = setup([
      { folderId: 'parent', userId: 'alice', accessLevel: 'READ' },
      { documentId: 'doc', userId: 'alice', accessLevel: 'WRITE' },
    ]);
    await expect(service.assertDocumentAccess('firm', doc, 'alice', 'ASSOCIATE', 'READ')).resolves.toBeUndefined();
    await expect(service.assertDocumentAccess('firm', doc, 'alice', 'ASSOCIATE', 'WRITE')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not query unrelated folder rules for an unfiled document', async () => {
    const service = setup([]);
    await service.assertDocumentAccess('firm', { ...doc, folderId: null }, 'alice', 'ASSOCIATE', 'READ');
    expect(service.prisma.documentAccessRule.findMany.mock.calls[0][0].where.OR).toEqual([{ documentId: 'doc' }]);
  });
});
