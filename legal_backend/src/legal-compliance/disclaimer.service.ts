import { Injectable } from '@nestjs/common';
import {
  DEFAULT_RESTRICTED_PHRASES,
  HIGH_RISK_TRIGGERS,
  STANDARD_DISCLAIMER,
} from './disclaimer.constants';

export { STANDARD_DISCLAIMER } from './disclaimer.constants';

export interface RestrictedPhraseMatch {
  phrase: string;
  index: number;
}

export interface HighRiskTriggerMatch {
  trigger: string;
  index: number;
}

@Injectable()
export class DisclaimerService {
  getDisclaimer(): string {
    return STANDARD_DISCLAIMER;
  }

  checkRestrictedPhrases(text: string, extraPhrases: string[] = []): RestrictedPhraseMatch[] {
    const normalized = text.toLowerCase();
    const phrases = [...DEFAULT_RESTRICTED_PHRASES, ...extraPhrases];
    const matches: RestrictedPhraseMatch[] = [];

    for (const phrase of phrases) {
      const needle = phrase.toLowerCase();
      let index = normalized.indexOf(needle);
      while (index !== -1) {
        matches.push({ phrase, index });
        index = normalized.indexOf(needle, index + needle.length);
      }
    }

    return matches;
  }

  getHighRiskTriggers(text?: string): HighRiskTriggerMatch[] | typeof HIGH_RISK_TRIGGERS {
    if (!text) {
      return HIGH_RISK_TRIGGERS;
    }

    const normalized = text.toLowerCase();
    const matches: HighRiskTriggerMatch[] = [];

    for (const trigger of HIGH_RISK_TRIGGERS) {
      const needle = trigger.toLowerCase();
      let index = normalized.indexOf(needle);
      while (index !== -1) {
        matches.push({ trigger, index });
        index = normalized.indexOf(needle, index + needle.length);
      }
    }

    return matches;
  }
}
