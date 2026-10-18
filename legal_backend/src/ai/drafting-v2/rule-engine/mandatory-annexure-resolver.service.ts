/**
 * Rule Engine — Mandatory Annexure Resolver
 *
 * Returns the list of mandatory and optional annexures for a document kind.
 * Fully deterministic — no LLM calls.
 */

import { Injectable } from '@nestjs/common';
import type { MandatoryAnnexureResult } from '../drafting-v2.types';

const ANNEXURE_MAP: Record<string, { required: string[]; optional: string[] }> = {
  india_maintenance_order_revision: {
    required: [
      'Impugned order dated [BLANK] passed by the [BLANK] court (Annexure A)',
      'Copy of the original maintenance application/petition (Annexure B)',
      'Vakalatnama (Annexure C)',
    ],
    optional: [
      'Income affidavit of parties',
      'Salary slips / bank statements',
      'Prior court orders in the matter',
      'Marriage certificate (if disputed)',
    ],
  },
  india_bail_application: {
    required: [
      'Copy of FIR (Annexure A)',
      'Arrest memo (Annexure B)',
      'Vakalatnama (Annexure C)',
    ],
    optional: [
      'Chargesheet (if filed)',
      'Previous bail order (if any)',
      'Surety documents',
      'Medical certificate (if medical bail)',
    ],
  },
  india_writ_petition_hc: {
    required: [
      'Impugned order / action complained against (Annexure A)',
      'Prior representation / correspondence (Annexure B)',
      'Vakalatnama (Annexure C)',
    ],
    optional: [
      'Supporting documents establishing facts',
      'Statutory notice issued',
      'Acknowledgment of notice',
    ],
  },
  india_cheque_dishonour_complaint: {
    required: [
      'Original dishonoured cheque (Annexure A)',
      'Cheque return memo from bank (Annexure B)',
      'Legal notice with postal receipt (Annexure C)',
      'Acknowledgment card / tracking receipt (Annexure D)',
    ],
    optional: [
      'Reply to legal notice (if received)',
      'Underlying transaction documents',
    ],
  },
  india_legal_notice: {
    required: [],
    optional: [
      'Copy of agreement / contract (if applicable)',
      'Prior correspondence',
      'Supporting evidence documents',
    ],
  },
  india_civil_suit: {
    required: [
      'Documents relied upon in the plaint',
      'Vakalatnama',
      'Court fee receipt',
    ],
    optional: [
      'Agreements / contracts',
      'Correspondence',
      'Expert reports',
    ],
  },
  india_suit_recovery_cpc_37: {
    required: [
      'Written instrument founding the liquidated debt: contract / purchase order / written acknowledgment / negotiable instrument, as actually relied upon',
      'Invoices and invoice-wise statement of account relied upon',
      'Proof of delivery, performance or acceptance relied upon',
      'Proof of payments / credits / part-payments included in the reconciliation',
      'Demand notice and available proof of service, if relied upon',
      'Section 12A pre-institution mediation application and outcome / non-starter report, unless a fact-supported urgent-interim-relief exception is pleaded',
      'Prescribed Commercial Court Statement of Truth and supporting affidavit',
      'Index and list of documents with legible, paginated annexures',
      'Vakalatnama and proof of state-schedule court-fee payment',
    ],
    optional: [
      'Ledger / account statement with applicable electronic-record certification',
      'Emails or correspondence acknowledging debt or confirming balance',
      'Corporate board resolution / power of attorney / authority to institute suit, where a party is an entity',
      'Urgency evidence supporting the Section 12A exception, only where urgent interim relief is genuinely sought',
      'GST / e-way bill or other transaction records actually relied upon',
    ],
  },
};

@Injectable()
export class MandatoryAnnexureResolverService {
  resolve(documentKind: string, countryCode: string): MandatoryAnnexureResult {
    if (countryCode.toUpperCase() !== 'IN') {
      return {
        required: ['Relevant supporting documents'],
        optional: [],
        notes: ['Mandatory annexures not pre-computed for this jurisdiction'],
      };
    }

    const entry = ANNEXURE_MAP[documentKind] ?? { required: [], optional: [] };
    return {
      required: entry.required,
      optional: entry.optional,
      notes:
        entry.required.length > 0
          ? ['File all mandatory annexures — failure to attach may lead to rejection']
          : ['Verify required annexures with court filing office'],
    };
  }
}
