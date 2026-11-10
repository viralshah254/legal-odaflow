import { findKeManifestAct } from './ke-manifest.loader';

describe('Kenya curated-to-catalog enactment identity', () => {
  it('resolves the workflow Employment Act slug to the 2007 enactment, preserving its storage identity', () => {
    const act = findKeManifestAct('employment-act-2007');
    expect(act).toMatchObject({ actId: 'employment-act-2007', workFrbrUri: 'akn/ke/act/2007/11', year: '2007' });
    expect(act?.workFrbrUri).not.toContain('1976');
  });
  it('resolves the published virtual-asset instruments rather than consultation drafts', () => {
    expect(findKeManifestAct('ke-act-2025-20')?.workFrbrUri).toBe('akn/ke/act/2025/20');
    expect(findKeManifestAct('ke-ln-2026-134')).toMatchObject({ nature: 'legal_notice', expressionDate: '2026-07-22' });
  });
  it('retains exact bulk catalog IDs and rejects unknown or foreign enactments', () => {
    expect(findKeManifestAct('ke-act-2007-11')?.actId).toBe('ke-act-2007-11');
    expect(findKeManifestAct('not-a-real-act')).toBeUndefined();
    expect(findKeManifestAct('bnss')).toBeUndefined();
  });
});
