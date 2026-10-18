import { DraftAccuracyRepairService } from './draft-accuracy-repair.service';

describe('DraftAccuracyRepairService.spliceSection', () => {
  const repair = new DraftAccuracyRepairService();

  it('replaces a hollow FACTS section body', () => {
    const draft = `## CAUSE TITLE
Court

## STATEMENT OF FACTS
Riya Desai

## PRAYER
Pay compensation.
`;
    const next = repair.spliceSection(
      draft,
      'STATEMENT OF FACTS',
      `## STATEMENT OF FACTS
1. Surgery on 10 March 2025 at Sunrise Hospital.
2. Consent recorded on 9 March 2025.
3. Bile leak diagnosed on 13 March 2025.
`,
    );
    expect(next).toMatch(/Surgery on 10 March 2025/);
    expect(next).not.toMatch(/^Riya Desai$/m);
    expect(next).toMatch(/## PRAYER/);
  });
});
