import { CourtHierarchyService } from './court-hierarchy.service';
import { CourtHierarchyResolverService } from '@/ai/legal-research/court-hierarchy-resolver.service';

describe('CourtHierarchyService', () => {
  const service = new CourtHierarchyService(new CourtHierarchyResolverService());

  it('maps India Supreme Court above High Court', () => {
    expect(service.levelFor('Supreme Court of India', 'IN')).toBeGreaterThan(
      service.levelFor('Delhi High Court', 'IN'),
    );
  });

  it('returns PASS finding when court metadata maps', () => {
    const finding = service.findingForClaim({
      claimId: 'c1',
      evidenceIds: ['e1'],
      jurisdiction: 'IN',
      authorities: [{ authorityId: 'a1', court: 'Supreme Court of India' }],
    });
    expect(finding.state).toBe('PASS');
    expect(finding.dimension).toBe('hierarchy');
  });

  it('returns INDETERMINATE when court unknown', () => {
    const finding = service.findingForClaim({
      claimId: 'c1',
      evidenceIds: ['e1'],
      jurisdiction: 'IN',
      authorities: [{ authorityId: 'a1', court: 'Mystery Bench' }],
    });
    expect(finding.state).toBe('INDETERMINATE');
  });
});
