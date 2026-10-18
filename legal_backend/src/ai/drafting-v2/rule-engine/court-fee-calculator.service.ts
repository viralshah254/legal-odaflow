/**
 * Rule Engine — Court Fee Calculator
 *
 * Deterministic computation of court fees for Indian courts.
 * Uses schedule-based lookup. No LLM calls.
 *
 * Phase 6 will expand this with per-state Court Fees Act schedules.
 */

import { Injectable } from '@nestjs/common';
import type { CourtFeeResult } from '../drafting-v2.types';

interface FeeEntry {
  basis: 'fixed' | 'ad_valorem' | 'relief_based' | 'none';
  fixedAmount?: number;
  schedule?: string;
  notes: string;
  /** True only where this service is configured to return a numeric estimate. */
  calculationSupported?: boolean;
}

/** India — common document kinds and their fee basis */
const INDIA_COURT_FEE_MAP: Record<string, FeeEntry> = {
  india_maintenance_order_revision: {
    basis: 'fixed',
    fixedAmount: 200,
    schedule: 'Court Fees Act 1870 Article 11 (Revision) — typically Rs.200 in most High Courts',
    notes: 'Verify current schedule with HC filing office',
  },
  india_bail_application: {
    basis: 'fixed',
    fixedAmount: 50,
    schedule: 'Court Fees Act 1870 (bail application — nominal fee)',
    notes: 'Amount varies by state; typically Rs.50-200',
  },
  india_writ_petition_hc: {
    basis: 'fixed',
    fixedAmount: 500,
    schedule: 'Court Fees Act 1870 / State HC Rules — writ petition typically Rs.500',
    notes: 'Verify with High Court office; some states have higher fees',
  },
  india_civil_suit: {
    basis: 'ad_valorem',
    schedule: 'Court Fees Act 1870 Schedule I Article 1 (ad valorem on claim value)',
    notes: 'Calculate on relief value claimed; ceiling applies in some states',
    calculationSupported: true,
  },
  india_suit_recovery_cpc_37: {
    basis: 'ad_valorem',
    schedule: 'Applicable State Court Fees Act / amendment, Schedule I (money claim)',
    notes:
      'Court fee is computed on the reconciled suit valuation under the filing state’s current slab schedule and cap. No uniform national percentage applies; obtain the state and current schedule before stating an amount.',
    calculationSupported: false,
  },
  india_cheque_dishonour_complaint: {
    basis: 'fixed',
    fixedAmount: 200,
    schedule: 'Court Fees Act 1870 (criminal complaint — nominal)',
    notes: 'Typically Rs.200 or as applicable',
  },
  india_legal_notice: {
    basis: 'none',
    notes: 'No court fee — pre-litigation notice',
  },
  india_affidavit: {
    basis: 'fixed',
    fixedAmount: 20,
    notes: 'Stamp paper / notary fee only; court fee not applicable',
  },
};

@Injectable()
export class CourtFeeCalculatorService {
  calculate(documentKind: string, countryCode: string, claimAmount?: number): CourtFeeResult {
    if (countryCode.toUpperCase() !== 'IN') {
      return {
        applicable: false,
        notes: ['Court fee computation currently only supported for India (IN)'],
      };
    }

    const entry = INDIA_COURT_FEE_MAP[documentKind];
    if (!entry) {
      return {
        applicable: true,
        feeScheduleRef: 'Court Fees Act 1870 — verify applicable schedule',
        notes: ['Court fee schedule not pre-computed for this document kind — verify with filing office'],
      };
    }

    if (entry.basis === 'none') {
      return { applicable: false, notes: [entry.notes] };
    }

    if (entry.basis === 'fixed') {
      return {
        applicable: true,
        feeAmount: entry.fixedAmount,
        feeCurrency: 'INR',
        feeScheduleRef: entry.schedule,
        calculationBasis: 'Fixed fee',
        notes: [entry.notes],
      };
    }

    if (entry.basis === 'ad_valorem' && claimAmount && entry.calculationSupported) {
      const fee = Math.round(claimAmount * 0.01);
      return {
        applicable: true,
        feeAmount: fee,
        feeCurrency: 'INR',
        feeScheduleRef: entry.schedule,
        calculationBasis: `Ad valorem: 1% of claim value Rs.${claimAmount}`,
        notes: [entry.notes, 'This is an approximation — verify exact schedule'],
      };
    }

    return {
      applicable: true,
      feeScheduleRef: entry.schedule,
      calculationBasis:
        entry.basis === 'ad_valorem' && claimAmount
          ? `Ad valorem on supplied suit valuation Rs.${claimAmount}; exact state slab calculation required`
          : entry.basis,
      notes: [
        entry.notes,
        ...(entry.basis === 'ad_valorem' && !claimAmount
          ? ['Claim value is missing — court fee cannot be computed']
          : []),
      ],
    };
  }
}
