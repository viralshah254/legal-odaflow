import {
  buildConstructionDelayAuthorityPins,
  queryLooksLikeConstructionDelay,
} from './construction-delay-authorities';

describe('construction-delay-authorities', () => {
  const ugQuery =
    'Review the Ministry of Works Uganda argument that ASCE delay analysis methodology is more applicable than the Society of Construction Law Delay and Disruption Protocol on our FIDIC project.';

  it('detects construction-delay methodology queries', () => {
    expect(queryLooksLikeConstructionDelay(ugQuery)).toBe(true);
    expect(queryLooksLikeConstructionDelay('cheque bounce section 138')).toBe(false);
  });

  it('returns SCL, ASCE, and FIDIC secondary pins', () => {
    const pins = buildConstructionDelayAuthorityPins(ugQuery);
    expect(pins.length).toBeGreaterThanOrEqual(3);
    expect(pins.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        'curated-scl-delay-protocol-2nd',
        'curated-asce-delay-analysis',
        'curated-fidic-delay-framework',
      ]),
    );
    expect(pins.every((p) => p.authorityType === 'SECONDARY')).toBe(true);
  });
});
