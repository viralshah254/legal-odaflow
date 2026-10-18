import { Injectable } from '@nestjs/common';
import type { ExtractedMatterFacts } from './matter-fact-extractor';
import {
  isCriminalDischargeContext,
  resolveSelfDefenseBundle,
  type DraftIntentBundleItem,
} from './draft-intent-bundles';
import { buildIndiaCommercialRecoveryRoute } from './india-commercial-recovery-route';

export interface PlaybookResult {
  playbookId: string;
  primaryDocumentKind: string;
  bundle: DraftIntentBundleItem[];
  statutes: string[];
  proceduralNotes: string[];
  provisional: boolean;
}

function firstAnswerValue(
  answers: Record<string, string | string[]> | undefined,
  questionId: string,
): string | undefined {
  const raw = answers?.[questionId];
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Deterministic playbook resolver — facts + answers decide the filing set
 * before MI's generic family/maintenance classification.
 */
@Injectable()
export class PlaybookResolverService {
  resolve(params: {
    extracted: ExtractedMatterFacts;
    query: string;
    answers?: Record<string, string | string[]>;
  }): PlaybookResult | undefined {
    const { extracted, query, answers } = params;
    const commercialRoute = buildIndiaCommercialRecoveryRoute(query, answers);
    if (commercialRoute) {
      const summaryBasisBlocked = commercialRoute.blockingIssues.some(
        (issue) => issue.id === 'commercial_written_basis',
      );
      return {
        playbookId: 'india_commercial_recovery',
        primaryDocumentKind: commercialRoute.documentKind,
        bundle: summaryBasisBlocked ? [] : [
          {
            kind: commercialRoute.draftKind,
            label: commercialRoute.primaryDocumentLabel,
            documentKind: commercialRoute.documentKind,
            order: 1,
            selectedByDefault: commercialRoute.blockingIssues.length === 0,
            bundleRole: 'primary',
            confidence: commercialRoute.confidence === 'high' ? 0.98 : 0.82,
            provisional: commercialRoute.blockingIssues.length > 0,
            defaultReason:
              'Primary claimant-side pleading selected from the written commercial debt and requested procedural vehicle.',
          },
        ],
        statutes: [
          'Code of Civil Procedure, 1908 — Order XXXVII',
          'Commercial Courts Act, 2015 — Sections 2(1)(c), 2(1)(i), 12A and 16',
        ],
        proceduralNotes: [
          'Statement of Truth, supporting affidavit, list of dates and annexure index form part of this filing set.',
          ...commercialRoute.mandatoryPreFilingSteps,
        ],
        provisional: commercialRoute.blockingIssues.length > 0,
      };
    }
    if (!extracted.isSelfDefenseHomicideContext && !isCriminalDischargeContext(query)) {
      return undefined;
    }

    const bundle = resolveSelfDefenseBundle(extracted, answers, query);
    const goal = firstAnswerValue(answers, 'self_defense_goal');
    const fir = firstAnswerValue(answers, 'self_defense_fir_status');
    const custody = firstAnswerValue(answers, 'self_defense_custody_stage');

    const goalUndecided = !goal || goal === 'not_sure';
    const firUnknown = !fir || fir === 'unknown';
    const provisional = goalUndecided || firUnknown;

    const primary = bundle[0];
    const statutes = [
      'BNSS §250 (discharge — Sessions trial)',
      'BNSS §262 (discharge — warrant case on police report)',
      'BNS §§34–44 (right of private defence)',
      'BSA electronic evidence / chain of custody',
    ];

    const proceduralNotes: string[] = [
      'Primary theory: causation not clearly established from the prosecution material (CCTV blind spot / multiple forensic explanations).',
      'Alternative: contact during an immediate knife attack — private defence under BNS; force must not be shown to be excessive.',
      'Discharge threshold: whether the chargesheet discloses a case for trial — disputed facts ordinarily go to trial, but gaps may still support discharge.',
    ];
    if (extracted.hasChargesheetFiled) {
      proceduralNotes.unshift('Facts indicate chargesheet filed — discharge / reply are the usual post-chargesheet vehicles.');
    }
    if (extracted.seeksDischarge || isCriminalDischargeContext(query)) {
      proceduralNotes.unshift('User seeks an application for discharge — prefer BNSS §250 / §262 over matrimonial forms.');
    }
    if (custody === 'pre_complaint' && extracted.hasChargesheetFiled) {
      proceduralNotes.push(
        'Selected stage is pre-complaint but facts mention chargesheet — confirm stage to refine ranking.',
      );
    }

    return {
      playbookId: 'self_defense_homicide',
      primaryDocumentKind: primary?.documentKind ?? 'discharge_application',
      bundle,
      statutes,
      proceduralNotes,
      provisional,
    };
  }
}
