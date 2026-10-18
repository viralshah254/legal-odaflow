import { CourtHierarchyResolverService } from './court-hierarchy-resolver.service';

describe('CourtHierarchyResolverService Kenya', () => {
  const service = new CourtHierarchyResolverService();

  it('ranks the Kenya Court of Appeal above a specialised superior court', () => {
    const result = service.resolve(
      { court: 'Court of Appeal of Kenya' },
      { court: 'Employment and Labour Relations Court of Kenya' },
    );

    expect(result.controlling).toBe('A');
    expect(result.reason).toContain('KE_COURT_OF_APPEAL');
  });

  it('ranks the Supreme Court of Kenya above the Court of Appeal', () => {
    const result = service.resolve(
      { court: 'Supreme Court of Kenya' },
      { court: 'Court of Appeal of Kenya' },
    );

    expect(result.controlling).toBe('A');
    expect(result.isPersuasiveOnly).toBe(false);
  });
});
