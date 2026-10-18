import { Injectable, Logger } from '@nestjs/common';
import type { CourtReadyStatus, ReleaseGateStatus } from '../contracts/release-gate';
import type { DraftingAccuracyMode } from './draft-accuracy-orchestrator.service';

export interface DraftProvenanceManifest {
  id: string;
  recordedAt: string;
  caseRecordId: string;
  caseRecordVersion: number;
  playbookId: string;
  playbookVersion: string;
  documentKind: string;
  courtProfileId?: string;
  courtProfileVersion?: string;
  releaseStatus: ReleaseGateStatus;
  courtReadyStatus: CourtReadyStatus;
  blockerCodes: string[];
  accuracyMode: DraftingAccuracyMode;
  statuteSnapshotId?: string;
  authoritySnapshotId?: string;
  userConfirmedFields?: string[];
  /** Model / config fingerprint for reproducibility. */
  modelConfigId?: string;
  validatorRunId?: string;
  sourceDocumentIds?: string[];
  postGenerationEditHash?: string;
  advocateApprovalId?: string;
  /** Number of automated review-and-repair cycles performed before release. */
  repairAttemptCount?: number;
  /** Findings detected before automated repair began. */
  initialFindingCodes?: string[];
  /** Findings that were successfully repaired and no longer appear in the final audit. */
  resolvedFindingCodes?: string[];
  /** Findings still present after all automated repair attempts. */
  unresolvedFindingCodes?: string[];
  /** Hashes of intermediate repaired drafts, in chronological order. */
  repairDraftHashes?: string[];
}

/**
 * In-memory provenance log for filing-grade drafts (persisted store can replace later).
 */
@Injectable()
export class DraftProvenanceService {
  private readonly logger = new Logger(DraftProvenanceService.name);
  private readonly manifests: DraftProvenanceManifest[] = [];

  record(
    input: Omit<DraftProvenanceManifest, 'id' | 'recordedAt'> & {
      id?: string;
    },
  ): DraftProvenanceManifest {
    const manifest: DraftProvenanceManifest = {
      id: input.id ?? `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: new Date().toISOString(),
      caseRecordId: input.caseRecordId,
      caseRecordVersion: input.caseRecordVersion,
      playbookId: input.playbookId,
      playbookVersion: input.playbookVersion,
      documentKind: input.documentKind,
      courtProfileId: input.courtProfileId,
      courtProfileVersion: input.courtProfileVersion,
      releaseStatus: input.releaseStatus,
      courtReadyStatus: input.courtReadyStatus,
      blockerCodes: input.blockerCodes,
      accuracyMode: input.accuracyMode,
      statuteSnapshotId: input.statuteSnapshotId,
      authoritySnapshotId: input.authoritySnapshotId,
      userConfirmedFields: input.userConfirmedFields,
      modelConfigId: input.modelConfigId,
      validatorRunId: input.validatorRunId,
      sourceDocumentIds: input.sourceDocumentIds,
      postGenerationEditHash: input.postGenerationEditHash,
      advocateApprovalId: input.advocateApprovalId,
      repairAttemptCount: input.repairAttemptCount,
      initialFindingCodes: input.initialFindingCodes,
      resolvedFindingCodes: input.resolvedFindingCodes,
      unresolvedFindingCodes: input.unresolvedFindingCodes,
      repairDraftHashes: input.repairDraftHashes,
    };
    this.manifests.push(manifest);
    if (this.manifests.length > 500) this.manifests.shift();
    this.logger.debug(
      `Provenance ${manifest.id} kind=${manifest.documentKind} status=${manifest.releaseStatus}`,
    );
    return manifest;
  }

  latestForCase(caseRecordId: string): DraftProvenanceManifest | undefined {
    for (let i = this.manifests.length - 1; i >= 0; i--) {
      if (this.manifests[i].caseRecordId === caseRecordId) return this.manifests[i];
    }
    return undefined;
  }

  list(): DraftProvenanceManifest[] {
    return [...this.manifests];
  }
}
