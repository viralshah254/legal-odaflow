import { Injectable } from '@nestjs/common';
import type { PassageClassification } from '@/legal-search/legal-retrieval.types';

export interface PassageClassificationResult {
  classification: PassageClassification;
  confidence: number;
  deterministic: boolean;
  reason: string;
}

/**
 * Conservative structural classifier. Unknown text stays UNKNOWN; semantic
 * plausibility alone never upgrades a passage to a holding.
 */
@Injectable()
export class PassageClassificationService {
  classify(text: string, authorityType?: string): PassageClassificationResult {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const type = authorityType?.toLowerCase() ?? '';
    if (/(?:statute|act|code)/.test(type)) {
      return this.result('STATUTORY_TEXT', 1, 'Authority is identified as statutory text.');
    }
    if (/(?:regulation|rule|notification|circular)/.test(type)) {
      return this.result('REGULATORY_TEXT', 1, 'Authority is identified as regulatory text.');
    }
    if (/\b(?:learned\s+)?(?:counsel|appellant|respondent|petitioner)\s+(?:submitted|contended|argued|urged)\b/i.test(normalized)) {
      return this.result('PARTY_SUBMISSION', 0.98, 'Passage is structurally framed as a party submission.');
    }
    if (/\b(?:trial\s+court|lower\s+court|high\s+court)\s+(?:held|found|observed|concluded)\b/i.test(normalized)) {
      return this.result('LOWER_COURT_FINDING', 0.95, 'Passage attributes the proposition to a lower court.');
    }
    if (/\b(?:dissent(?:ing)?|with\s+respect,\s+i\s+dissent|minority\s+opinion)\b/i.test(normalized)) {
      return this.result('DISSENT', 0.98, 'Passage is marked as a dissent or minority opinion.');
    }
    if (/\b(?:concurring|concurrence|i\s+agree\s+with\s+the\s+conclusion)\b/i.test(normalized)) {
      return this.result('CONCURRENCE', 0.95, 'Passage is marked as a concurrence.');
    }
    if (/^\s*(?:headnote|editor'?s?\s+note|case\s+summary)\b/i.test(normalized)) {
      return this.result('HEADNOTE', 0.99, 'Passage is labelled as editorial or headnote material.');
    }
    if (/\b(?:we\s+(?:therefore\s+)?hold|we\s+are\s+of\s+the\s+(?:considered\s+)?opinion|it\s+is\s+hereby\s+held|accordingly,\s+the\s+(?:appeal|petition)|the\s+(?:appeal|petition)\s+is\s+(?:allowed|dismissed))\b/i.test(normalized)) {
      return this.result('HOLDING', 0.95, 'Court-disposition or express holding language is present.');
    }
    if (/\b(?:facts?\s+of\s+the\s+case|factual\s+background|the\s+prosecution\s+case|according\s+to\s+the\s+complaint)\b/i.test(normalized)) {
      return this.result('FACT', 0.9, 'Passage is structurally factual narration.');
    }
    return {
      classification: 'UNKNOWN',
      confidence: 0,
      deterministic: true,
      reason: 'No reliable structural marker establishes the passage role.',
    };
  }

  private result(
    classification: PassageClassification,
    confidence: number,
    reason: string,
  ): PassageClassificationResult {
    return { classification, confidence, deterministic: true, reason };
  }
}
