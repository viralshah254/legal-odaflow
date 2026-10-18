import { createHash } from 'crypto';
import type { ReleaseSnapshot } from './draft-filing-release.service';

export function computeReleaseDigest(snapshot: ReleaseSnapshot): string {
  const payload = JSON.stringify({
    draftHash: snapshot.draftHash,
    contentRevision: snapshot.contentRevision,
    caseRecordId: snapshot.caseRecordId,
    caseRecordVersion: snapshot.caseRecordVersion,
    playbookVersion: snapshot.playbookVersion,
    evidenceRevision: snapshot.evidenceRevision,
    courtProfileId: snapshot.courtProfileId,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function isCompleteReleaseSnapshot(snapshot: ReleaseSnapshot): boolean {
  return (
    Boolean(snapshot.draftHash) &&
    snapshot.contentRevision >= 0 &&
    snapshot.caseRecordId.length > 0 &&
    snapshot.caseRecordId !== 'pending' &&
    snapshot.playbookVersion.length > 0 &&
    snapshot.playbookVersion !== 'pending' &&
    snapshot.evidenceRevision.length > 0 &&
    snapshot.evidenceRevision !== 'pending' &&
    snapshot.courtProfileId.length > 0 &&
    snapshot.courtProfileId !== 'pending'
  );
}
