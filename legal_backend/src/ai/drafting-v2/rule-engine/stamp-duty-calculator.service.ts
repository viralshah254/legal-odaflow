/**
 * Rule Engine — Stamp Duty Calculator
 *
 * Deterministic stamp duty computation for Indian states.
 * Uses state-specific Stamp Act schedules (seed data).
 * No LLM calls.
 */

import { Injectable } from '@nestjs/common';
import type { StampDutyResult } from '../drafting-v2.types';

interface StateStampRate {
  ratePercent?: number;
  fixedAmount?: number;
  basis: string;
  act: string;
  notes: string;
}

/** India — stamp duty rates for common transactional documents by state */
const INDIA_STAMP_DUTY: Record<
  string,
  Record<string, StateStampRate>
> = {
  agreement_to_sell: {
    MH: { ratePercent: 0.1, basis: 'On agreement consideration', act: 'Maharashtra Stamp Act 1958 Art.25', notes: 'e-registration via IGR Maharashtra; separate registration charges apply' },
    DL: { ratePercent: 0.5, basis: 'On agreement value', act: 'Indian Stamp Act 1899 Art.5', notes: 'Delhi stamp duty 0.5% + 1% registration fee' },
    KA: { ratePercent: 0.5, basis: 'On agreement value', act: 'Karnataka Stamp Act 1957', notes: 'Verify current schedule' },
    IN_DEFAULT: { ratePercent: 0.1, basis: 'On agreement consideration', act: 'Indian Stamp Act 1899 Art.5', notes: 'Rate varies by state — verify local schedule' },
  },
  sale_deed: {
    MH: { ratePercent: 5, basis: 'On market value or consideration (higher)', act: 'Maharashtra Stamp Act 1958', notes: 'Women buyers: 4%; Rural: 3%; + 1% registration fee' },
    DL: { ratePercent: 4, basis: 'On consideration', act: 'Indian Stamp Act 1899', notes: 'Delhi: women 4%, others 6% + 1% registration' },
    KA: { ratePercent: 5, basis: 'On market value', act: 'Karnataka Stamp Act 1957', notes: 'Additional surcharge may apply' },
    IN_DEFAULT: { ratePercent: 5, basis: 'On market value or consideration', act: 'Indian Stamp Act 1899', notes: 'Rate varies 4-7% by state — verify local schedule' },
  },
  rent_agreement: {
    MH: { fixedAmount: 500, basis: 'Fixed stamp duty for leave and licence', act: 'Maharashtra Stamp Act 1958 Art.36A', notes: 'e-registration mandatory above 11 months' },
    DL: { fixedAmount: 50, basis: 'Fixed for tenancy up to 1yr', act: 'Indian Stamp Act 1899', notes: '2% for longer tenancies' },
    IN_DEFAULT: { fixedAmount: 100, basis: 'Fixed or 0.5%', act: 'Indian Stamp Act 1899', notes: 'Verify state schedule' },
  },
  power_of_attorney: {
    MH: { fixedAmount: 500, basis: 'Fixed', act: 'Maharashtra Stamp Act 1958 Art.48', notes: 'Notarised PoA: Rs.100-500 depending on type' },
    IN_DEFAULT: { fixedAmount: 100, basis: 'Fixed', act: 'Indian Stamp Act 1899 Art.48', notes: 'Verify state schedule' },
  },
  affidavit: {
    IN_DEFAULT: { fixedAmount: 20, basis: 'Fixed non-judicial stamp paper', act: 'Indian Stamp Act 1899', notes: 'Rs.10-20 stamp paper for affidavits' },
  },
};

function documentKindToCategory(kind: string): string {
  if (/agreement.*sell|sell.*agreement/i.test(kind)) return 'agreement_to_sell';
  if (/sale.*deed|deed.*sale/i.test(kind)) return 'sale_deed';
  if (/rent|lease|leave.*licence/i.test(kind)) return 'rent_agreement';
  if (/power.*attorney|poa/i.test(kind)) return 'power_of_attorney';
  if (/affidavit/i.test(kind)) return 'affidavit';
  return '';
}

@Injectable()
export class StampDutyCalculatorService {
  calculate(
    documentKind: string,
    countryCode: string,
    stateCode?: string,
    considerationValue?: number,
  ): StampDutyResult {
    if (countryCode.toUpperCase() !== 'IN') {
      return {
        applicable: false,
        notes: ['Stamp duty computation currently only supported for India (IN)'],
      };
    }

    const category = documentKindToCategory(documentKind);
    if (!category) {
      // Court filings don't attract stamp duty
      if (/petition|application|complaint|bail|writ|revision/i.test(documentKind)) {
        return {
          applicable: false,
          notes: ['Court documents attract court fee (not stamp duty) — see Court Fee Calculator'],
        };
      }
      return {
        applicable: false,
        notes: ['Stamp duty not pre-computed for this document kind — verify with local stamp authority'],
      };
    }

    const stateMap = INDIA_STAMP_DUTY[category];
    if (!stateMap) {
      return { applicable: false, notes: ['No stamp duty schedule found'] };
    }

    const state = stateCode?.toUpperCase();
    const entry = (state && stateMap[state]) ?? stateMap['IN_DEFAULT'];
    if (!entry) {
      return { applicable: false, notes: ['State schedule not available'] };
    }

    let dutyAmount: number | undefined;
    if (entry.ratePercent && considerationValue) {
      dutyAmount = Math.round((considerationValue * entry.ratePercent) / 100);
    } else if (entry.fixedAmount) {
      dutyAmount = entry.fixedAmount;
    }

    return {
      applicable: true,
      dutyRate: entry.ratePercent,
      dutyAmount,
      stateRef: `${entry.act}${state ? ` (${state})` : ''}`,
      notes: [entry.basis, entry.notes],
    };
  }
}
