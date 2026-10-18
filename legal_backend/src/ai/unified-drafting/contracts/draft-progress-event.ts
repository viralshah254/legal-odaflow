import type { DraftJobStatus } from './draft-execution-plan';

export interface DraftProgressEvent {
  jobId: string;
  eventId: string;
  sequence: number;
  status: DraftJobStatus;
  stage: string;
  percent: number;
  message: string;
  completedSections?: number;
  totalSections?: number;
  error?: string;
  timestamp: string;
}

/** Percent assigned to each pipeline stage for progress display. */
export const STAGE_PERCENT: Record<string, number> = {
  queued:           2,
  normalizing:      8,
  procedural_check: 14,
  retrieving:       24,
  planning:         30,
  generating:       55,
  verifying:        68,
  repairing:        75,
  assembling:       82,
  reviewing:        88,
  applying_fixes:   92,
  final_verify:     96,
  ready:            100,
  blocked:          14,
  failed:           0,
  cancelled:        0,
};

/** Human-readable stage labels shown in the UI. */
export const STAGE_LABEL: Record<string, string> = {
  queued:           'Reviewing case details',
  normalizing:      'Reviewing case details',
  procedural_check: 'Checking procedure and jurisdiction',
  retrieving:       'Finding verified legal authorities',
  planning:         'Planning the document',
  generating:       'Drafting sections',
  verifying:        'Checking citations and legal accuracy',
  repairing:        'Repairing flagged sections',
  assembling:       'Finalizing your draft',
  reviewing:        'Reviewing draft against case facts',
  applying_fixes:   'Applying safe corrections',
  final_verify:     'Confirming lawyer-ready certification',
  ready:            'Your draft is ready',
  blocked:          'Additional information required',
  failed:           'Draft generation failed',
  cancelled:        'Draft cancelled',
};
