import { Injectable } from '@nestjs/common';
import type { PassageClassification, RetrievedSourcePassage } from '@/legal-search/legal-retrieval.types';

/** Preserve cross-page quoted-authority boundaries instead of promoting its "we" to this court. */
export function markAttributedAuthorityPassages(passages: RetrievedSourcePassage[]): RetrievedSourcePassage[] {
  const result: RetrievedSourcePassage[] = [];
  let quote: '“' | '"' | undefined;
  let depth = 0, priorContext = '', otherCaseSection = false;
  for (const passage of passages) {
    if (passage.paragraph && !quote) otherCaseSection = false;
    if (/^(?:\[\s*\d+\s*\]\s*)?In\s+that\s+case\b/i.test(passage.text)) otherCaseSection = true;
    const append = (text: string, quoted: boolean) => {
      if (!text.trim()) return;
      result.push({ ...passage, text: text.trim(),
        ...((quoted || otherCaseSection) && passage.classification !== 'DISSENT'
          ? { classification: 'COMMENTARY' as const, classificationConfidence: 0.99, attribution: 'OTHER_AUTHORITY' as const } : {}),
      });
    };
    let start = 0;
    for (let index = 0; index < passage.text.length; index++) {
      const char = passage.text[index];
      if (quote) {
        if (quote === '“' && char === '“') depth++;
        else if (char === (quote === '“' ? '”' : '"')) depth--;
        if (depth === 0) { append(passage.text.slice(start, index + 1), true); start = index + 1; quote = undefined; }
      } else if (char === '“' || char === '"') {
        const context = (priorContext + ' ' + passage.text.slice(start, index)).slice(-600);
        if (/\b(?:court|judges|dictionary|case)\b[\s\S]{0,500}\b(?:stated|observed|held|defines?|as\s+follows|as\s+under)\b[\s\S]{0,80}$/i.test(context)) {
          append(passage.text.slice(start, index), false);
          start = index; quote = char; depth = 1;
        }
      }
    }
    append(passage.text.slice(start), Boolean(quote));
    priorContext = (priorContext + ' ' + passage.text).slice(-600);
  }
  return result;
}

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
    if (/\b(?:trial\s+court|lower\s+court|high\s+court|court\s+of\s+appeal)\s+(?:held|found|observed|concluded)\b/i.test(normalized)) {
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
    if (/\b(?:we\s+(?:therefore\s+)?(?:hold|conclude)|we\s+find\s+that|we\s+are,?\s+(?:therefore,?\s+)?of\s+the\s+(?:considered\s+)?opinion|it\s+is\s+hereby\s+held|accordingly,\s+the\s+(?:appeal|petition)|the\s+(?:appeal|petition)\s+is\s+(?:allowed|dismissed)|(?:the\s+)?a\s*ppeal\s+(?:therefore\s+)?(?:fails\s+and\s+)?is\s+(?:hereby\s+)?dismissed)\b/i.test(normalized)) {
      return this.result('HOLDING', 0.95, 'Court-disposition or express holding language is present.');
    }
    if (/\b(?:facts?\s+of\s+the\s+case|factual\s+background|the\s+prosecution\s+case|according\s+to\s+the\s+complaint)\b/i.test(normalized)) {
      return this.result('FACT', 0.9, 'Passage is structurally factual narration.');
    }
    if (/\bfrom\s+the\s+(?:aforesaid|foregoing|above)\b.{0,100}\bit\s+(?:becomes|is)\s+clear\s+that\b/i.test(normalized)) {
      return this.result('RATIO', 0.9, 'The court expressly derives its reasoning from the preceding analysis.');
    }
    if (/\bwe\s+(?:must\s+(?:consider|look|examine)|believe\s+that)\b/i.test(normalized)) {
      return this.result('RATIO', 0.9, 'The deciding court expressly frames its own reasoning.');
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
