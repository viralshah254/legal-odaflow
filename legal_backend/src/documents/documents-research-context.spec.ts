import { ForbiddenException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

jest.mock('@/marketplace/intake-analysis.service', () => ({
  IntakeAnalysisService: class IntakeAnalysisService {},
}));

describe('DocumentsService research context', () => {
  const baseDocument = {
    id: 'doc-1',
    fileName: 'evidence.pdf',
    updatedAt: new Date('2026-07-27T00:00:00.000Z'),
    extractedText: 'encrypted',
    folderId: null,
    matterId: 'matter-1',
    uploadedById: 'user-1',
  };

  function setup(documents = [baseDocument]) {
    const service = Object.create(DocumentsService.prototype) as DocumentsService;
    const prisma = {
      document: { findMany: jest.fn().mockResolvedValue(documents) },
      documentAccessRule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const matterAccess = {
      ensureMatterAccess: jest.fn().mockResolvedValue(undefined),
      hasFullAccess: jest.fn().mockReturnValue(false),
    };
    Object.assign(service as object, {
      prisma,
      matterAccess,
      rolePermissions: { hasPermission: jest.fn().mockResolvedValue(false) },
      encryption: {
        decryptStringFromStorage: jest.fn().mockReturnValue('decrypted legal text'),
      },
    });
    return { service, prisma, matterAccess };
  }

  it('decrypts and returns only explicitly selected accessible documents', async () => {
    const { service } = setup();

    const result = await service.loadSelectedMatterDocumentsForResearch(
      'tenant-1',
      'matter-1',
      'user-1',
      'ASSOCIATE',
      ['doc-1'],
      { perItemChars: 100, totalChars: 100 },
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        extractedText: 'decrypted legal text',
        truncated: false,
      }),
    ]);
  });

  it('rejects missing, cross-tenant, or cross-matter selected IDs', async () => {
    const { service } = setup([]);

    await expect(
      service.loadSelectedMatterDocumentsForResearch(
        'tenant-1',
        'matter-1',
        'user-1',
        'ASSOCIATE',
        ['cross-matter-doc'],
        { perItemChars: 100, totalChars: 100 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces per-document and aggregate character caps', async () => {
    const second = { ...baseDocument, id: 'doc-2', uploadedById: 'user-1' };
    const { service } = setup([baseDocument, second]);
    Object.assign(service as object, {
      encryption: {
        decryptStringFromStorage: jest.fn().mockReturnValue('x'.repeat(100)),
      },
    });

    const result = await service.loadSelectedMatterDocumentsForResearch(
      'tenant-1',
      'matter-1',
      'user-1',
      'ASSOCIATE',
      ['doc-1', 'doc-2'],
      { perItemChars: 60, totalChars: 80 },
    );

    expect(result.map((item) => item.extractedText.length)).toEqual([60, 20]);
    expect(result.every((item) => item.truncated)).toBe(true);
  });
});
