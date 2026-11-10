import { LegalSourceController } from './legal-source.controller';

function setup() {
  const finder = { find: jest.fn().mockResolvedValue({ matches: [{ id: 'reference', sourceRef: 'https://example.gov/act', isBailable: false, isCognizable: false, isCompoundable: false, bailPosture: 'Unassessed' }], total: 1 }) };
  const prisma = { $queryRaw: jest.fn() };
  const controller = new LegalSourceController({} as never, finder as never, finder as never, finder as never, {} as never, {} as never, prisma as never, {} as never, {} as never);
  return { controller, finder, prisma };
}

describe('public statutory reference boundaries', () => {
  it('never dereferences confidential matter context from a public lookup parameter', async () => {
    const { controller, finder, prisma } = setup();
    await controller.sectionFinder('BNSS section 480', 'IN', undefined, undefined, undefined, undefined, undefined, 'restricted-matter');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(finder.find.mock.calls[0][0]).not.toHaveProperty('matterGraph');
    expect(finder.find.mock.calls[0][0]).not.toHaveProperty('matterId');
  });

  it.each(['KE','US'])('does not label a %s reference non-bailable merely because its generic profile defaults to false', async country => {
    const { controller } = setup();
    const result = await controller.sectionFinder('reference', country);
    expect(result.matches[0]).not.toHaveProperty('isBailable');
    expect(result.matches[0]).not.toHaveProperty('isCognizable');
    expect(result.matches[0]).not.toHaveProperty('bailPosture');
  });
});
