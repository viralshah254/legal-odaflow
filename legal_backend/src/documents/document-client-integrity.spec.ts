import { BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

jest.mock('@/marketplace/intake-analysis.service', () => ({
  IntakeAnalysisService: class IntakeAnalysisService {},
}));

describe('DocumentsService client/matter integrity', () => {
  const existingDocument = {
    id: 'document-1',
    tenantId: 'tenant-1',
    matterId: null,
    clientId: null,
    folderId: null,
    uploadedById: 'user-1',
    extractedText: null,
    status: 'ACTIVE',
  };

  function buildService(matterClientId: string | null) {
    const prisma = {
      document: {
        findFirst: jest.fn().mockResolvedValue(existingDocument),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...existingDocument, ...data }),
        ),
      },
      matter: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'matter-1',
          clientId: matterClientId,
        }),
      },
      client: { findFirst: jest.fn() },
    };
    const service = Object.create(DocumentsService.prototype) as DocumentsService;
    Object.assign(service, {
      prisma,
      encryption: { decryptStringFromStorage: (value: string | null) => value },
    });
    return { service, prisma };
  }

  it('derives clientId from the selected matter', async () => {
    const { service, prisma } = buildService('client-1');

    await service.updateTenantDocument(
      'tenant-1',
      'document-1',
      'user-1',
      'ADMIN',
      { matterId: 'matter-1' },
    );

    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matterId: 'matter-1',
          clientId: 'client-1',
        }),
      }),
    );
  });

  it('rejects a client that conflicts with the selected matter', async () => {
    const { service } = buildService('client-1');

    await expect(
      service.updateTenantDocument(
        'tenant-1',
        'document-1',
        'user-1',
        'ADMIN',
        { matterId: 'matter-1', clientId: 'client-2' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists the archive status instead of ignoring it', async () => {
    const { service, prisma } = buildService(null);

    await service.updateTenantDocument(
      'tenant-1',
      'document-1',
      'user-1',
      'ADMIN',
      { status: 'ARCHIVED' },
    );

    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ARCHIVED' }),
      }),
    );
  });

  it('excludes archived documents by default and allows explicit archive queries', async () => {
    const { service, prisma } = buildService(null);

    await service.listTenantDocuments('tenant-1');
    await service.listTenantDocuments(
      'tenant-1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'ARCHIVED',
    );

    expect(prisma.document.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', status: 'ACTIVE' }),
      }),
    );
    expect(prisma.document.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', status: 'ARCHIVED' }),
      }),
    );
  });
});
