import { Injectable } from '@nestjs/common';
import type { ReleaseGateStatus } from '../contracts/release-gate';
import type { DraftGenerationLineage } from '../contracts/structured-draft';

export interface ReleaseGateMetricEvent {
  documentKind: string;
  status: ReleaseGateStatus;
  blockerCount: number;
  warningCount: number;
  blockerTypes: string[];
}

/**
 * Draft accuracy observability — metrics + per-generation lineage store.
 */
@Injectable()
export class DraftAccuracyMetricsService {
  private releaseEvents: ReleaseGateMetricEvent[] = [];
  private lineages: Array<DraftGenerationLineage & { draftId: string; documentKind: string }> =
    [];
  private caseRecordEdits = 0;
  private unsupportedClaims = 0;

  recordReleaseGate(event: ReleaseGateMetricEvent): void {
    this.releaseEvents.push(event);
    if (this.releaseEvents.length > 5000) {
      this.releaseEvents = this.releaseEvents.slice(-2500);
    }
  }

  recordLineage(
    draftId: string,
    documentKind: string,
    lineage: DraftGenerationLineage,
  ): void {
    this.lineages.push({ ...lineage, draftId, documentKind });
    if (this.lineages.length > 2000) {
      this.lineages = this.lineages.slice(-1000);
    }
  }

  recordCaseRecordEdit(): void {
    this.caseRecordEdits += 1;
  }

  recordUnsupportedClaim(): void {
    this.unsupportedClaims += 1;
  }

  snapshot(): {
    draft_block_rate: number;
    blocker_type_frequency: Record<string, number>;
    case_record_edit_rate: number;
    unsupported_claim_rate: number;
    playbook_version_mismatch_rate: number;
    total_releases: number;
    recent_lineages: number;
  } {
    const total = this.releaseEvents.length || 1;
    const blocked = this.releaseEvents.filter((e) => e.status === 'draft_blocked').length;
    const freq: Record<string, number> = {};
    let versionMismatches = 0;
    for (const e of this.releaseEvents) {
      for (const t of e.blockerTypes) {
        freq[t] = (freq[t] ?? 0) + 1;
        if (t === 'playbook_version' || t === 'case_record_version') versionMismatches += 1;
      }
    }
    return {
      draft_block_rate: blocked / total,
      blocker_type_frequency: freq,
      case_record_edit_rate: this.caseRecordEdits / total,
      unsupported_claim_rate: this.unsupportedClaims / total,
      playbook_version_mismatch_rate: versionMismatches / total,
      total_releases: this.releaseEvents.length,
      recent_lineages: this.lineages.length,
    };
  }
}
