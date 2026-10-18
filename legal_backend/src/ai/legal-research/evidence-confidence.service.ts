import { Injectable } from '@nestjs/common';
import type {
  ConfidenceDimension,
  ConfidenceDimensionAssessment,
  ConfidenceLevel,
  ConfidenceProfile,
  EvidenceConfidenceInput,
} from './high-confidence-research.types';

const LEVEL_RANK: Record<ConfidenceLevel, number> = {
  CONFLICTED: 0,
  UNKNOWN: 1,
  TENTATIVE: 2,
  CORROBORATED: 3,
  VERIFIED: 4,
};

const INPUT_KEYS: Record<
  ConfidenceDimension,
  keyof Omit<EvidenceConfidenceInput, 'evidenceIds' | 'conflicts'>
> = {
  AUTHORITY_IDENTITY: 'authorityIdentity',
  PINPOINT_SUPPORT: 'pinpointSupport',
  PASSAGE_ENTAILMENT: 'passageEntailment',
  TREATMENT: 'treatment',
  CURRENT_LAW: 'currentLaw',
  FACTUAL_SUPPORT: 'factualSupport',
  SOURCE_INTEGRITY: 'sourceIntegrity',
  ISSUE_COMPLETENESS: 'issueCompleteness',
  CONCLUSION: 'conclusion',
};

export const LEGAL_CONFIDENCE_DIMENSIONS: ConfidenceDimension[] = [
  'AUTHORITY_IDENTITY',
  'PINPOINT_SUPPORT',
  'PASSAGE_ENTAILMENT',
  'TREATMENT',
  'CURRENT_LAW',
];

@Injectable()
export class EvidenceConfidenceService {
  assessLegal(input: EvidenceConfidenceInput): ConfidenceProfile {
    return this.assess(input, LEGAL_CONFIDENCE_DIMENSIONS);
  }

  assessFact(input: EvidenceConfidenceInput): ConfidenceProfile {
    return this.assess(input, ['FACTUAL_SUPPORT']);
  }

  assess(
    input: EvidenceConfidenceInput,
    requiredDimensions: ConfidenceDimension[],
  ): ConfidenceProfile {
    if (requiredDimensions.length === 0) {
      throw new Error('At least one confidence dimension is required');
    }

    const dimensions = requiredDimensions.map((dimension) =>
      this.dimensionAssessment(input, dimension),
    );
    let level = this.meet(dimensions.map((item) => item.level));
    const reasons = dimensions
      .filter((item) => item.level !== 'VERIFIED')
      .map(
        (item) =>
          item.reason ??
          `${item.dimension} is ${item.level.toLocaleLowerCase()}`,
      );

    let ceiling: ConfidenceLevel | undefined;
    if ((input.conflicts?.length ?? 0) > 0) {
      ceiling = 'TENTATIVE';
      level = this.lower(level, ceiling);
      reasons.push(...(input.conflicts ?? []).map((item) => `Conflict: ${item}`));
    }

    return { dimensions, level, ceiling, reasons };
  }

  meet(levels: ConfidenceLevel[]): ConfidenceLevel {
    if (levels.length === 0) {
      return 'UNKNOWN';
    }
    return levels.reduce((weakest, level) => this.lower(weakest, level));
  }

  atLeast(actual: ConfidenceLevel, required: ConfidenceLevel): boolean {
    return LEVEL_RANK[actual] >= LEVEL_RANK[required];
  }

  private dimensionAssessment(
    input: EvidenceConfidenceInput,
    dimension: ConfidenceDimension,
  ): ConfidenceDimensionAssessment {
    const level = input[INPUT_KEYS[dimension]] ?? 'UNKNOWN';
    return {
      dimension,
      level,
      evidenceIds: [...(input.evidenceIds?.[dimension] ?? [])],
      reason:
        level === 'UNKNOWN'
          ? `${dimension} has not been established by evidence`
          : undefined,
    };
  }

  private lower(
    left: ConfidenceLevel,
    right: ConfidenceLevel,
  ): ConfidenceLevel {
    return LEVEL_RANK[left] <= LEVEL_RANK[right] ? left : right;
  }
}
