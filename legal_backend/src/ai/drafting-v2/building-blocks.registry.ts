/**
 * Verified, reusable building blocks for legal documents.
 *
 * These are injected directly into sections without LLM generation,
 * reducing cost and ensuring consistent, accurate boilerplate.
 *
 * Phase 9 will replace these static entries with database-backed
 * ClauseLibrary lookups (backed by template-clause-rules.ts seeds).
 */

import type { BuildingBlock } from './drafting-v2.types';

export const VERIFIED_BUILDING_BLOCKS: BuildingBlock[] = [
  // ─── India Verification clauses ──────────────────────────────────────────
  {
    id: 'india-verification-standard',
    type: 'verification',
    title: 'Standard India Verification',
    content: `VERIFICATION

I, [BLANK: deponent name], [BLANK: age] years, [BLANK: occupation], resident of [BLANK: address], do hereby solemnly affirm and state on oath as follows:

That I am the [Petitioner/Applicant/Complainant] in the above matter and am fully conversant with the facts and circumstances of the case.

That the contents of the foregoing [Petition/Application/Complaint] are true and correct to the best of my knowledge and belief and nothing material has been concealed therefrom.

Verified at [BLANK: city] on this [BLANK: date] day of [BLANK: month], [BLANK: year].

                                                    ______________________
                                                    [BLANK: deponent name]
                                                    (Deponent)`,
    jurisdiction: 'IN',
    verified: true,
    lastVerifiedAt: '2025-01-01',
    usageCount: 0,
  },
  {
    id: 'india-verification-affidavit',
    type: 'verification',
    documentKind: 'india_affidavit',
    title: 'Affidavit Verification',
    content: `VERIFICATION

I, [BLANK: deponent name], [BLANK: age] years, [BLANK: occupation], resident of [BLANK: address], do hereby solemnly affirm and state on oath as follows:

That the contents of this Affidavit are true and correct to the best of my knowledge and belief. No part of it is false and nothing material has been concealed.

DEPONENT

Solemnly affirmed before me at [BLANK: city] on [BLANK: date].

                                                    ______________________
                                                    Notary/Oath Commissioner`,
    jurisdiction: 'IN',
    verified: true,
    lastVerifiedAt: '2025-01-01',
    usageCount: 0,
  },
  // ─── Notice closing clauses ──────────────────────────────────────────────
  {
    id: 'india-notice-closing-standard',
    type: 'verification',
    documentKind: 'india_legal_notice',
    title: 'Legal Notice Closing',
    content: `Take notice that if you fail to comply with the above demand within [BLANK: number] days from the receipt of this notice, my client shall be constrained to initiate appropriate legal proceedings against you without further notice, and in that event, you shall be liable for all costs, damages, and consequences thereof.

Kindly acknowledge receipt of this notice.

Yours faithfully,

[BLANK: Advocate Name]
Advocate for the Noticee/Petitioner
[BLANK: Bar Registration No.]
[BLANK: Address]
[BLANK: Date]`,
    jurisdiction: 'IN',
    verified: true,
    lastVerifiedAt: '2025-01-01',
    usageCount: 0,
  },
];
