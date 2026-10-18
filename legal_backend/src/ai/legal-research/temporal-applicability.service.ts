export type TemporalApplicability =
  | 'APPLICABLE'
  | 'NOT_YET_EFFECTIVE'
  | 'EXPIRED'
  | 'INAPPLICABLE'
  | 'UNKNOWN';

export interface TemporalApplicabilityInput {
  enactmentDate?: string | Date | null;
  notificationDate?: string | Date | null;
  commencementDate?: string | Date | null;
  amendmentEffectiveDate?: string | Date | null;
  /** Date on which the legal rule became operative. */
  effectiveFrom?: string | Date | null;
  /** Last date on which the legal rule remained operative. */
  effectiveTo?: string | Date | null;
  repealDate?: string | Date | null;
  /** Decision date for precedent; a judgment cannot govern earlier events prospectively by default. */
  decisionDate?: string | Date | null;
  /** Date of the legally relevant event, if historical applicability matters. */
  eventDate?: string | Date | null;
  /** Research cutoff. Defaults to today. */
  asOfDate?: string | Date;
  repealed?: boolean;
  superseded?: boolean;
  /** Explicitly records retrospective operation where the source says so. */
  retrospective?: boolean;
  /** True only when the authority expressly limits the rule to future events. */
  prospectiveOnly?: boolean;
  savingApplies?: boolean;
  transitionRule?: string;
  proceduralChange?: boolean;
}

export interface TemporalApplicabilityResult {
  status: TemporalApplicability;
  applicable: boolean;
  reasons: string[];
  evaluatedAt: string;
  currentLawStatus: TemporalApplicability;
  eventDateStatus?: TemporalApplicability;
  transitionRule?: string;
}

/** Pure date-range evaluator; it makes no unstated retrospective-law inference. */
export class TemporalApplicabilityService {
  evaluate(input: TemporalApplicabilityInput): TemporalApplicabilityResult {
    const asOf = this.parseDate(input.asOfDate ?? new Date());
    const event = this.parseDate(input.eventDate);
    const from = this.parseDate(
      input.amendmentEffectiveDate ?? input.commencementDate ?? input.effectiveFrom,
    );
    const to = this.parseDate(input.repealDate ?? input.effectiveTo);
    const decision = this.parseDate(input.decisionDate);
    const evaluatedAt = (asOf ?? new Date()).toISOString().slice(0, 10);

    if (!asOf || (input.eventDate && !event) || (input.effectiveFrom && !from) || (input.effectiveTo && !to)) {
      return this.result('UNKNOWN', false, ['One or more temporal metadata values are invalid.'], evaluatedAt, input);
    }
    const target = event ?? asOf;
    if (from && to && from > to) {
      return this.result('UNKNOWN', false, ['Effective date range is internally inconsistent.'], evaluatedAt, input);
    }
    if (from && target < from) {
      return this.result('NOT_YET_EFFECTIVE', false, ['Authority was not effective on the relevant date.'], evaluatedAt, input);
    }
    if (decision && decision > asOf) {
      return this.result(
        'NOT_YET_EFFECTIVE',
        false,
        ['The precedent was decided after the research cutoff date.'],
        evaluatedAt,
        input,
      );
    }
    if (to && target > to) {
      if (event && input.savingApplies && event <= to) {
        return this.result(
          'APPLICABLE',
          true,
          ['A saving or transitional provision preserves the law for the relevant event date.'],
          evaluatedAt,
          input,
        );
      }
      return this.result('EXPIRED', false, ['Authority ceased to be effective before the relevant date.'], evaluatedAt, input);
    }
    if ((input.repealed || input.superseded) && !to) {
      return this.result(
        'UNKNOWN',
        false,
        ['Authority is marked repealed or superseded but no end date establishes historical applicability.'],
        evaluatedAt,
        input,
      );
    }
    if (event && decision && event < decision && input.prospectiveOnly && !input.retrospective) {
      return this.result(
        'INAPPLICABLE',
        false,
        ['Precedent post-dates the relevant event and retrospective operation is not established.'],
        evaluatedAt,
        input,
      );
    }
    if (!from && !to && !decision && !input.repealed && !input.superseded) {
      return this.result('UNKNOWN', false, ['No temporal applicability metadata is available.'], evaluatedAt, input);
    }
    return this.result(
      'APPLICABLE',
      true,
      input.proceduralChange
        ? ['Procedural change identified; transition and pending-proceeding rules must be applied.']
        : [],
      evaluatedAt,
      input,
    );
  }

  private result(
    status: TemporalApplicability,
    applicable: boolean,
    reasons: string[],
    evaluatedAt: string,
    input: TemporalApplicabilityInput,
  ): TemporalApplicabilityResult {
    const asOf = this.parseDate(input.asOfDate ?? new Date());
    const from = this.parseDate(
      input.amendmentEffectiveDate ?? input.commencementDate ?? input.effectiveFrom,
    );
    const to = this.parseDate(input.repealDate ?? input.effectiveTo);
    const currentLawStatus: TemporalApplicability =
      !asOf
        ? 'UNKNOWN'
        : from && asOf < from
          ? 'NOT_YET_EFFECTIVE'
          : to && asOf > to
            ? 'EXPIRED'
            : input.repealed || input.superseded
              ? 'UNKNOWN'
              : from || to || input.decisionDate
                ? 'APPLICABLE'
                : 'UNKNOWN';
    return {
      status,
      applicable,
      reasons,
      evaluatedAt,
      currentLawStatus,
      eventDateStatus: input.eventDate ? status : undefined,
      transitionRule: input.transitionRule,
    };
  }

  private parseDate(value?: string | Date | null): Date | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
