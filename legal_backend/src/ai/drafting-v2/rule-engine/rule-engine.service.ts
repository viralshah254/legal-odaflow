/**
 * Rule Engine Orchestrator (Stage 5)
 *
 * Runs all deterministic rules in parallel and returns a `RuleEngineResult`
 * with a formatted `promptBlock` for injection into section generation.
 *
 * No LLM calls — pure computation.
 */

import { Injectable } from '@nestjs/common';
import { LimitationEngineService } from './limitation-engine.service';
import { CourtFeeCalculatorService } from './court-fee-calculator.service';
import { StampDutyCalculatorService } from './stamp-duty-calculator.service';
import { ForumJurisdictionResolverService } from './forum-jurisdiction-resolver.service';
import { MandatoryAnnexureResolverService } from './mandatory-annexure-resolver.service';
import type { RuleEngineResult } from '../drafting-v2.types';

export interface RuleEngineInput {
  documentKind: string;
  countryCode: string;
  jurisdiction?: string;
  practiceArea?: string;
  stateCode?: string;
  claimAmount?: number;
  accrualDate?: string;
  caseDetails?: string;
}

@Injectable()
export class RuleEngineService {
  constructor(
    private readonly limitation: LimitationEngineService,
    private readonly courtFee: CourtFeeCalculatorService,
    private readonly stampDuty: StampDutyCalculatorService,
    private readonly forum: ForumJurisdictionResolverService,
    private readonly annexures: MandatoryAnnexureResolverService,
  ) {}

  evaluate(input: RuleEngineInput): RuleEngineResult {
    const limitationResult = this.limitation.compute(
      input.documentKind,
      input.countryCode,
      input.practiceArea ?? 'litigation_disputes',
      input.accrualDate,
    );

    const courtFeeResult = this.courtFee.calculate(
      input.documentKind,
      input.countryCode,
      input.claimAmount,
    );

    const stampDutyResult = this.stampDuty.calculate(
      input.documentKind,
      input.countryCode,
      input.stateCode,
      input.claimAmount,
    );

    const forumResult = this.forum.resolve(
      input.documentKind,
      input.countryCode,
      input.claimAmount,
      input.jurisdiction,
      input.caseDetails,
    );

    const annexureResult = this.annexures.resolve(input.documentKind, input.countryCode);

    const promptBlock = this.buildPromptBlock({
      limitation: limitationResult,
      courtFee: courtFeeResult,
      stampDuty: stampDutyResult,
      forum: forumResult,
      annexures: annexureResult,
    });

    return {
      limitation: limitationResult,
      courtFee: courtFeeResult,
      stampDuty: stampDutyResult,
      forum: forumResult,
      annexures: annexureResult,
      promptBlock,
    };
  }

  private buildPromptBlock(result: Omit<RuleEngineResult, 'promptBlock'>): string {
    const lines: string[] = ['VERIFIED RULE ENGINE OUTPUTS (deterministic — do NOT override with LLM reasoning):'];

    if (result.limitation.applicable) {
      lines.push(`LIMITATION: ${result.limitation.rule}`);
      if (result.limitation.deadlineDate) {
        lines.push(`Filing deadline: ${result.limitation.deadlineDate}`);
      }
      if (result.limitation.withinLimitation === false) {
        lines.push('WARNING: Filing may be time-barred — disclose in maintainability section');
      }
    } else if (result.limitation.notes.length > 0) {
      lines.push(`LIMITATION: ${result.limitation.notes[0]}`);
    }

    if (result.forum.correctForum) {
      lines.push(`CORRECT FORUM: ${result.forum.correctForum}`);
    }
    if (result.forum.warnings.length > 0) {
      lines.push(`JURISDICTION WARNINGS: ${result.forum.warnings.join('; ')}`);
    }

    if (result.courtFee.applicable) {
      lines.push(
        `COURT FEE: ${result.courtFee.feeAmount ? `Rs.${result.courtFee.feeAmount}` : 'applicable'} — ${result.courtFee.feeScheduleRef ?? 'verify with filing office'}`,
      );
    }

    if (result.stampDuty.applicable) {
      lines.push(
        `STAMP DUTY: ${result.stampDuty.dutyAmount ? `Rs.${result.stampDuty.dutyAmount}` : 'applicable'} — ${result.stampDuty.stateRef ?? 'verify with stamp authority'}`,
      );
    }

    if (result.annexures.required.length > 0) {
      lines.push(`MANDATORY ANNEXURES: ${result.annexures.required.join(' | ')}`);
    }

    return lines.join('\n');
  }
}
