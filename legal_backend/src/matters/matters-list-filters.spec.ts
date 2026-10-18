import { Test } from '@nestjs/testing';
import { MattersService } from './matters.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAccessService } from '@/access/matter-access.service';
import { PlaybooksService } from '@/playbooks/playbooks.service';
import { ConflictsService } from '@/conflicts/conflicts.service';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { SearchIndexService } from '@/search/search-index.service';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';

const mockPrisma = {
  matter: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  client: { findFirst: jest.fn() },
};

const mockMatterAccess = {
  getAccessibleMatterIds: jest.fn().mockResolvedValue(null),
  hasFullAccess: jest.fn().mockReturnValue(true),
};

describe('MattersService.findAll clientId filter', () => {
  let service: MattersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MattersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MatterAccessService, useValue: mockMatterAccess },
        { provide: PlaybooksService, useValue: {} },
        { provide: ConflictsService, useValue: {} },
        { provide: AutomationEngineService, useValue: {} },
        { provide: RealtimePublisherService, useValue: { publishToTenant: jest.fn() } },
        { provide: SearchIndexService, useValue: {} },
        { provide: MatterIntelligencePipelineService, useValue: {} },
        { provide: MatterMemoryService, useValue: {} },
      ],
    }).compile();

    service = module.get(MattersService);
    jest.clearAllMocks();
    mockPrisma.matter.findMany.mockResolvedValue([]);
  });

  it('passes clientId into prisma where clause', async () => {
    await service.findAll('tenant-1', 'user-1', 'ADMIN', { clientId: 'client-abc' });

    expect(mockPrisma.matter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { tenantId: 'tenant-1' },
            { clientId: 'client-abc' },
          ]),
        },
      }),
    );
  });

  it('omits clientId filter when not provided', async () => {
    await service.findAll('tenant-1', 'user-1', 'ADMIN', {});

    expect(mockPrisma.matter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
  });
});
