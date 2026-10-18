import { sanitizeLeadTitleCandidate } from './lead-display.util';

describe('lead-display.util', () => {
  it('strips inline slaEscalated tokens from titles', () => {
    expect(sanitizeLeadTitleCandidate('na slaEscalated:true')).toBeNull();
    expect(sanitizeLeadTitleCandidate('Contract review slaEscalated:true')).toBe(
      'Contract review',
    );
  });
});
