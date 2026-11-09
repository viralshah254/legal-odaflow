import { DeadlineEngineController } from './deadline-engine.controller';

describe('deadline recompute tenant boundary', () => {
  it('refuses another tenant’s matter before reading its facts', async () => {
    const prisma = {
      matter: { findFirst: jest.fn().mockResolvedValue(null) },
      matterFactV2: { findMany: jest.fn() },
    };
    const svc = { prisma, detectDeadlinesFromFacts: jest.fn() };
    const controller = new DeadlineEngineController(svc as any);
    await expect(controller.recomputeFromFacts('foreign-matter', 'current-tenant')).rejects.toThrow('Matter not found');
    expect(prisma.matter.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-matter', tenantId: 'current-tenant' }, select: { id: true },
    });
    expect(prisma.matterFactV2.findMany).not.toHaveBeenCalled();
    expect(svc.detectDeadlinesFromFacts).not.toHaveBeenCalled();
  });
});
