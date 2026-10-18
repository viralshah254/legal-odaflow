/**
 * Rule Engine — Forum Jurisdiction Resolver
 *
 * Determines pecuniary and territorial jurisdiction for filing.
 * Entirely deterministic — no LLM calls.
 *
 * India focus: civil courts (District Court, HC, SC), criminal courts
 * (Magistrate, Sessions, HC), and specialized tribunals.
 */

import { Injectable } from '@nestjs/common';
import type { ForumJurisdictionResult } from '../drafting-v2.types';

interface JurisdictionRule {
  forum: string;
  pecuniaryLimit?: number;
  basis: string;
  notes: string;
}

const INDIA_CIVIL_COURTS: JurisdictionRule[] = [
  { forum: 'Munsiff Court', pecuniaryLimit: 500000, basis: 'CPC s.15 — suits up to Rs.5 lakh', notes: 'Lowest civil court' },
  { forum: 'Civil Judge Senior Division', pecuniaryLimit: 2500000, basis: 'CPC s.15 — suits up to Rs.25 lakh', notes: 'Mid-tier civil court' },
  { forum: 'District Court', pecuniaryLimit: undefined, basis: 'CPC s.15 — unlimited civil jurisdiction at district level', notes: 'Principal civil court of original jurisdiction' },
  { forum: 'High Court', pecuniaryLimit: undefined, basis: 'Constitution Art.226/227 — writ/supervisory; original civil above state threshold', notes: 'Original side only in HC Bombay, Calcutta, Delhi, Madras' },
  { forum: 'Supreme Court', pecuniaryLimit: undefined, basis: 'Constitution Art.136/32', notes: 'Special leave; fundamental rights' },
];

const KIND_FORUM_MAP: Record<string, JurisdictionRule> = {
  india_maintenance_order_revision: {
    forum: 'High Court of the State',
    basis: 'BNSS 2023 §438 read with §144 — revision against maintenance orders to High Court',
    notes: 'File in HC of state where trial court is situated',
  },
  india_bail_application: {
    forum: 'Sessions Court or High Court',
    basis: 'BNSS 2023 §480/§483 — bail from court where trial pending or HC',
    notes: 'Sessions Court for offences triable by Sessions; HC for special cases',
  },
  india_writ_petition_hc: {
    forum: 'High Court of the State',
    basis: 'Constitution Article 226 — HC writ jurisdiction',
    notes: 'Territorial jurisdiction: HC where cause of action arose or respondent resides',
  },
  india_cheque_dishonour_complaint: {
    forum: 'Magistrate Court',
    basis: 'NI Act s.142 — Metropolitan/Judicial Magistrate First Class',
    notes: 'Jurisdiction: where cheque presented, drawer resides, or payee resides (SC ruling)',
  },
  india_legal_notice: {
    forum: 'N/A (pre-litigation)',
    basis: 'No court filing — send to respondent',
    notes: 'Jurisdiction determined by subsequent suit/proceeding',
  },
  india_civil_suit: {
    forum: 'Civil Court of appropriate pecuniary jurisdiction',
    basis: 'CPC s.15-20 — territorial + pecuniary jurisdiction',
    notes: 'File at defendant\'s residence or where cause of action arose',
  },
};

const COMMERCIAL_SPECIFIED_VALUE_FLOOR = 300000;

@Injectable()
export class ForumJurisdictionResolverService {
  resolve(
    documentKind: string,
    countryCode: string,
    claimAmount?: number,
    jurisdiction?: string,
    caseDetails?: string,
  ): ForumJurisdictionResult {
    if (countryCode.toUpperCase() !== 'IN') {
      return {
        hasJurisdiction: true,
        warnings: [],
        notes: ['Forum/jurisdiction rules not pre-computed for this country — verify locally'],
      };
    }

    if (documentKind === 'india_suit_recovery_cpc_37') {
      const warnings: string[] = [];
      const hasClaimAmount = typeof claimAmount === 'number' && Number.isFinite(claimAmount) && claimAmount > 0;
      const meetsStatutoryFloor =
        hasClaimAmount && claimAmount >= COMMERCIAL_SPECIFIED_VALUE_FLOOR;

      if (!hasClaimAmount) {
        warnings.push(
          'Claim value is missing — specified value and pecuniary competence cannot be confirmed',
        );
      } else if (!meetsStatutoryFloor) {
        warnings.push(
          'Claim value is below the Commercial Courts Act specified-value floor of Rs.3,00,000; use the competent ordinary civil court unless a different valid basis applies',
        );
      }

      const forumText = `${jurisdiction ?? ''} ${caseDetails ?? ''}`;
      if (
        /\b(?:district court|district judge|civil court|civil judge)\b/i.test(forumText) &&
        !/\bcommercial\b/i.test(forumText)
      ) {
        warnings.push(
          'A commercial suit of specified value must name the designated Commercial Court or Commercial Division, not an undesignated ordinary civil court',
        );
      }

      return {
        hasJurisdiction: meetsStatutoryFloor,
        correctForum: meetsStatutoryFloor
          ? 'Designated Commercial Court or Commercial Division of competent pecuniary jurisdiction'
          : 'Competent civil court after specified-value and state pecuniary threshold verification',
        pecuniaryJurisdiction: meetsStatutoryFloor,
        territorialJurisdiction: this.inferTerritorialJurisdiction(caseDetails, jurisdiction),
        warnings,
        notes: [
          'Commercial Courts Act 2015 §§2(1)(c), 2(1)(i), 3 and applicable state notification',
          'CPC §§15–20: plead the defendant/cause-of-action territorial nexus and file in the lowest competent court',
          'High Court original-side and state pecuniary thresholds vary; never infer an exact court designation from claim value alone',
        ],
      };
    }

    const kindRule = KIND_FORUM_MAP[documentKind];
    if (kindRule) {
      return {
        hasJurisdiction: true,
        correctForum: kindRule.forum,
        pecuniaryJurisdiction: true,
        territorialJurisdiction: this.inferTerritorialJurisdiction(caseDetails, jurisdiction),
        warnings: [],
        notes: [kindRule.basis, kindRule.notes],
      };
    }

    // Civil suit with pecuniary lookup
    if (/suit|plaint/i.test(documentKind) && claimAmount !== undefined) {
      const court = INDIA_CIVIL_COURTS.find(
        (c) => !c.pecuniaryLimit || c.pecuniaryLimit >= claimAmount,
      );
      return {
        hasJurisdiction: true,
        correctForum: court?.forum ?? 'District Court',
        pecuniaryJurisdiction: true,
        territorialJurisdiction: this.inferTerritorialJurisdiction(caseDetails, jurisdiction),
        warnings: claimAmount === 0 ? ['Claim value not provided — verify pecuniary jurisdiction'] : [],
        notes: court ? [court.basis, court.notes] : ['Verify correct civil court level'],
      };
    }

    return {
      hasJurisdiction: true,
      warnings: ['Forum not pre-determined for this document kind'],
      notes: ['Verify correct court/forum before filing'],
    };
  }

  private inferTerritorialJurisdiction(caseDetails?: string, jurisdiction?: string): boolean {
    if (!caseDetails && !jurisdiction) return true;
    const combined = `${caseDetails ?? ''} ${jurisdiction ?? ''}`.toLowerCase();
    // Detect if the filing location seems consistent with the facts
    return !combined.includes('no jurisdiction') && !combined.includes('wrong court');
  }
}
