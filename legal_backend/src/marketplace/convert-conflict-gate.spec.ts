import {
  conflictStatusFromCheck,
  shouldBlockConvertOnConflict,
} from './convert-conflict-gate';

describe('convert conflict gate', () => {
  it('blocks convert when conflict is not CLEAR and there is no override', () => {
    expect(
      shouldBlockConvertOnConflict({ clear: false, matchCount: 1 }, false),
    ).toBe(true);
    expect(conflictStatusFromCheck({ clear: false })).toBe('REVIEW_REQUIRED');
  });

  it('does not silently convert a REVIEW_REQUIRED file', () => {
    expect(shouldBlockConvertOnConflict({ clear: false }, false)).toBe(true);
    expect(shouldBlockConvertOnConflict({ clear: true }, false)).toBe(false);
  });

  it('allows convert after an explicit override', () => {
    expect(shouldBlockConvertOnConflict({ clear: false }, true)).toBe(false);
  });
});
