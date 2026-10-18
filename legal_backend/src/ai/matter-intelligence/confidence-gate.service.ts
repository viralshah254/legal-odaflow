import { Injectable } from '@nestjs/common';
import type {
  ClarifyingQuestion,
  MatterProfile,
} from './matter-intelligence.types';

const THRESHOLDS = {
  practiceArea: 0.8,
  subPracticeArea: 0.7,
  nature: 0.75,
  aggregate: 0.65,
};

export interface ConfidenceGateResult {
  shouldProceed: boolean;
  recommendationMode: 'matched' | 'low_confidence' | 'clarification_required';
  questions: ClarifyingQuestion[];
}

@Injectable()
export class ConfidenceGateService {
  evaluate(profile: MatterProfile): ConfidenceGateResult {
    const fc = profile.fieldConfidence;
    const questions: ClarifyingQuestion[] = [];

    const practiceConf = fc?.practiceArea ?? profile.confidence;
    const subConf = fc?.subPracticeArea ?? (profile.subPracticeArea ? 0.8 : 0.4);
    const natureConf = fc?.nature ?? 0.5;
    const aggregate = profile.confidence;

    if (practiceConf < THRESHOLDS.practiceArea) {
      questions.push({
        id: 'practice_area',
        field: 'practiceArea',
        text: 'What type of legal matter is this?',
        options: [
          'Employment & Labour',
          'Family & Matrimonial',
          'Criminal / Litigation',
          'Consumer',
          'Property',
          'Corporate / Contract',
          'Other',
        ],
      });
    }

    if (subConf < THRESHOLDS.subPracticeArea && profile.practiceArea) {
      questions.push({
        id: 'sub_practice',
        field: 'subPracticeArea',
        text: 'What is the specific issue within this practice area?',
      });
    }

    if (natureConf < THRESHOLDS.nature || profile.nature === 'unknown') {
      const skipNature =
        profile.nature === 'dispute' &&
        (profile.posture === 'revision' ||
          profile.posture === 'appeal' ||
          profile.confidence >= THRESHOLDS.aggregate);
      if (!skipNature) {
        questions.push({
          id: 'nature',
          field: 'nature',
          text: 'Are you disputing/challenging something, or drafting a new document?',
          options: [
            'Disputing / challenging (litigation)',
            'Drafting a new contract or document',
            'Compliance / filing',
            'Legal advice / opinion only',
          ],
        });
      }
    }

    if (aggregate < THRESHOLDS.aggregate || questions.length > 0) {
      return {
        shouldProceed: false,
        recommendationMode: 'clarification_required',
        questions,
      };
    }

    if (aggregate < 0.85) {
      return {
        shouldProceed: true,
        recommendationMode: 'low_confidence',
        questions: [],
      };
    }

    return {
      shouldProceed: true,
      recommendationMode: 'matched',
      questions: [],
    };
  }
}
