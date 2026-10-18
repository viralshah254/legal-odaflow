import { PrismaService } from '@/prisma/prisma.service';
import { SmartWorkspaceService } from './smart-workspace.service';

describe('SmartWorkspaceService pinSavedResearchToCanvas', () => {
  it('creates a research_result node when none exists for the saved record', async () => {
    const prisma = {
      smartWorkspace: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ws-1',
          tenantId: 'tenant-1',
          matterId: 'matter-1',
          workspaceDocs: [],
        }),
        create: jest.fn(),
      },
      matter: {
        findFirst: jest.fn(),
      },
      canvasNode: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn().mockResolvedValue({ id: 'node-1' }),
      },
    };

    const service = new SmartWorkspaceService(prisma as unknown as PrismaService);
    await service.pinSavedResearchToCanvas('tenant-1', 'matter-1', 'user-1', {
      savedResearchId: 'saved-1',
      title: 'Memo',
      query: 'Question',
      summary: 'Answer preview',
      aiOutputId: 'output-1',
    });

    expect(prisma.canvasNode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          type: 'research_result',
          content: expect.objectContaining({
            savedResearchId: 'saved-1',
            title: 'Memo',
          }),
        }),
      }),
    );
  });

  it('skips creating a duplicate node for the same saved research id', async () => {
    const prisma = {
      smartWorkspace: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ws-1',
          tenantId: 'tenant-1',
          matterId: 'matter-1',
          workspaceDocs: [],
        }),
      },
      canvasNode: {
        findMany: jest.fn().mockResolvedValue([
          { content: { savedResearchId: 'saved-1' } },
        ]),
        count: jest.fn(),
        create: jest.fn(),
      },
    };

    const service = new SmartWorkspaceService(prisma as unknown as PrismaService);
    await service.pinSavedResearchToCanvas('tenant-1', 'matter-1', 'user-1', {
      savedResearchId: 'saved-1',
      title: 'Memo',
      query: 'Question',
    });

    expect(prisma.canvasNode.create).not.toHaveBeenCalled();
  });
});
