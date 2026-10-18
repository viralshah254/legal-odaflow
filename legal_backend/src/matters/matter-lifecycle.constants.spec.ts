import {
  matterStageFilterValues,
  matterStatusFilterValues,
  normalizeMatterStage,
  normalizeMatterStatus,
} from './matter-lifecycle.constants';

describe('matter lifecycle compatibility', () => {
  it.each([
    ['Active', 'OPEN'],
    ['open', 'OPEN'],
    ['On Hold', 'ON_HOLD'],
    ['closed', 'CLOSED'],
  ])('normalizes legacy status %s', (input, expected) => {
    expect(normalizeMatterStatus(input)).toBe(expected);
  });

  it.each([
    ['intake', 'Intake'],
    ['DISCOVERY', 'Discovery'],
    ['on_hold', 'on_hold'],
  ])('normalizes known stage %s without inventing unknown values', (input, expected) => {
    expect(normalizeMatterStage(input)).toBe(expected);
  });

  it('queries canonical and legacy lifecycle values', () => {
    expect(matterStatusFilterValues('OPEN')).toEqual(
      expect.arrayContaining(['OPEN', 'Active']),
    );
    expect(matterStageFilterValues('discovery')).toEqual(
      expect.arrayContaining(['Discovery', 'DISCOVERY']),
    );
  });
});
