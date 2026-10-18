/**
 * TODO-071 — Obligation Extraction Service
 *
 * Uses regex + keyword matching to locate contractual obligations in document text.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { ObligationExtract } from './document-review.types';

interface ObligationPattern {
  type: string;
  regexes: RegExp[];
  defaultTitle: string;
}

const DATE_IN_TEXT =
  /(?:by|on|before|no\s+later\s+than|within)\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;
const WITHIN_DAYS = /within\s+(\d+)\s+(?:business\s+)?days?\s+(?:of|after|from)/i;
const RECURRING = /(?:monthly|quarterly|annually|annually|weekly|bi-annually|on\s+demand|on\s+event)/i;
const CONSEQUENCE = /(?:failing\s+which|in\s+the\s+event\s+of\s+(?:a\s+)?breach|otherwise|or\s+else)[,\s]+([^.]{10,200}\.)/i;

const OBLIGATION_PATTERNS: ObligationPattern[] = [
  {
    type: 'payment',
    defaultTitle: 'Payment Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+pay\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+must\s+pay\b[^.]{0,300}\./gi,
      /payment\s+of\s+(?:an?\s+amount|[A-Z]{2,3}\s*[\d,]+)[^.]{0,200}\./gi,
      /\bfee[s]?\s+(?:of|amounting\s+to)\s+[^.]{0,200}\./gi,
    ],
  },
  {
    type: 'notice',
    defaultTitle: 'Notice Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+provide\s+(?:written\s+)?notice\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+must\s+notify\b[^.]{0,300}\./gi,
      /notice\s+(?:shall|must)\s+be\s+given\b[^.]{0,300}\./gi,
      /\bwithin\s+\d+\s+(?:business\s+)?days?\s+of[^.]{0,200}\bnotice\b[^.]{0,100}\./gi,
    ],
  },
  {
    type: 'non_disclosure',
    defaultTitle: 'Confidentiality Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+(?:keep|maintain|hold)\s+confidential\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+must\s+not\s+disclose\b[^.]{0,300}\./gi,
      /shall\s+not\s+(?:disclose|reveal|divulge)\b[^.]{0,300}\./gi,
      /confidential\s+information\s+shall\s+(?:not\s+be|remain)\b[^.]{0,300}\./gi,
    ],
  },
  {
    type: 'non_compete',
    defaultTitle: 'Non-Compete Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+not\s+(?:directly\s+or\s+indirectly\s+)?compete\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+must\s+not\s+engage\s+in\b[^.]{0,300}(?:competing|similar|rival)[^.]{0,100}\./gi,
      /non-?compete\s+(?:covenant|obligation|restriction)\b[^.]{0,300}\./gi,
    ],
  },
  {
    type: 'delivery',
    defaultTitle: 'Delivery Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+deliver\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+must\s+provide\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+supply\b[^.]{0,300}\./gi,
      /delivery\s+of[^.]{0,200}by\s+\d/gi,
    ],
  },
  {
    type: 'reporting',
    defaultTitle: 'Reporting Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+(?:submit|file|report|furnish)\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+must\s+(?:submit|report|file)\b[^.]{0,300}\./gi,
      /(?:monthly|quarterly|annual)\s+report[s]?\s+shall\b[^.]{0,300}\./gi,
    ],
  },
  {
    type: 'insurance',
    defaultTitle: 'Insurance Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+(?:obtain|maintain|procure)\s+insurance\b[^.]{0,300}\./gi,
      /insurance\s+coverage\s+(?:of|not\s+less\s+than)\b[^.]{0,300}\./gi,
    ],
  },
  {
    type: 'performance',
    defaultTitle: 'Performance Obligation',
    regexes: [
      /[A-Z][a-zA-Z\s]{0,40}\s+shall\s+(?:perform|execute|fulfill|complete)\b[^.]{0,300}\./gi,
      /[A-Z][a-zA-Z\s]{0,40}\s+agrees?\s+to\s+(?:perform|provide|ensure)\b[^.]{0,300}\./gi,
    ],
  },
];

@Injectable()
export class ObligationExtractorService {
  private readonly logger = new Logger(ObligationExtractorService.name);

  constructor(@Optional() private readonly llm: LlmCompletionService | null) {}

  /**
   * Extract obligations using regex patterns, then augment with LLM for
   * complex obligations that regex misses.
   */
  async extractObligationsWithLlm(
    rawText: string,
    parties: string[],
    documentType?: string,
  ): Promise<ObligationExtract[]> {
    // Start with regex extraction
    const regexObligations = this.extractObligations(rawText, parties);

    if (!this.llm) return regexObligations;

    // Use LLM on first 6000 chars to find obligations regex missed
    try {
      const systemPrompt = `You are a contract analyst extracting obligations.
Find obligations that are not obvious payment/notice/NDA obligations — e.g., performance milestones, IP assignments, representation obligations, indemnities, compliance requirements.

Respond ONLY with a JSON array:
[{ "title": "...", "description": "exact quote from contract", "obligorParty": "...", "obligeeParty": "...", "obligationType": "...", "frequency": "once|recurring|on_event" }]

Max 8 items. Skip payment and confidentiality obligations.`;

      const userPrompt = `DOCUMENT TYPE: ${documentType ?? 'contract'}
PARTIES: ${parties.join(', ')}

CONTRACT TEXT:
${rawText.slice(0, 6000)}

Find complex or non-obvious obligations.`;

      const result = await this.llm.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens: 1500,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return regexObligations;

      const llmItems = JSON.parse(jsonMatch[0]) as Array<{
        title: string;
        description: string;
        obligorParty?: string;
        obligeeParty?: string;
        obligationType?: string;
        frequency?: string;
      }>;

      // Deduplicate against regex results
      const existingFingerprints = new Set(
        regexObligations.map((o) => o.description.slice(0, 80).toLowerCase()),
      );

      const llmObligations: ObligationExtract[] = [];
      for (const item of llmItems) {
        const fingerprint = item.description.slice(0, 80).toLowerCase();
        if (existingFingerprints.has(fingerprint)) continue;
        existingFingerprints.add(fingerprint);

        llmObligations.push({
          title: item.title,
          description: item.description,
          obligorParty: item.obligorParty ?? 'Unknown',
          obligeeParty: item.obligeeParty ?? undefined,
          obligationType: item.obligationType ?? 'general',
          recurringSchedule: (item as any).frequency ?? undefined,
          dueDate: undefined,
          consequences: item.description,
        });
      }

      return [...regexObligations, ...llmObligations];
    } catch (err) {
      this.logger.warn(`LLM obligation extraction failed: ${String(err)}`);
      return regexObligations;
    }
  }

  extractObligations(rawText: string, parties: string[]): ObligationExtract[] {
    const obligations: ObligationExtract[] = [];
    const seen = new Set<string>();

    for (const pattern of OBLIGATION_PATTERNS) {
      for (const regex of pattern.regexes) {
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;

        while ((match = regex.exec(rawText)) !== null) {
          const sentence = match[0].trim();
          const fingerprint = sentence.slice(0, 80).toLowerCase();

          if (seen.has(fingerprint)) continue;
          seen.add(fingerprint);

          const obligation = this.buildObligation(
            sentence,
            pattern.type,
            pattern.defaultTitle,
            parties,
          );

          obligations.push(obligation);

          // Guard against runaway regex
          if (obligations.length >= 200) return obligations;
        }
      }
    }

    return obligations;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildObligation(
    sentence: string,
    obligationType: string,
    defaultTitle: string,
    parties: string[],
  ): ObligationExtract {
    return {
      title: defaultTitle,
      description: sentence,
      obligorParty: this.identifyObligor(sentence, parties),
      obligeeParty: this.identifyObligee(sentence, parties),
      obligationType,
      dueDate: this.extractDueDate(sentence),
      recurringSchedule: this.extractRecurring(sentence),
      consequences: this.extractConsequences(sentence),
    };
  }

  private identifyObligor(sentence: string, parties: string[]): string {
    for (const party of parties) {
      if (sentence.toLowerCase().startsWith(party.toLowerCase())) {
        return party;
      }
    }
    // Fall back to first noun phrase before "shall" / "must"
    const m = sentence.match(/^([A-Z][a-zA-Z\s]{0,40}?)\s+(?:shall|must|agrees?)/);
    return m ? m[1].trim() : parties[0] ?? 'Party';
  }

  private identifyObligee(sentence: string, parties: string[]): string | undefined {
    // Look for "to [Party]" or "with [Party]"
    for (const party of parties) {
      const escaped = party.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:to|with|for)\\s+${escaped}`, 'i').test(sentence)) {
        return party;
      }
    }
    return undefined;
  }

  private extractDueDate(sentence: string): Date | undefined {
    let m = sentence.match(DATE_IN_TEXT);
    if (m) {
      const parsed = new Date(m[1]);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    m = sentence.match(WITHIN_DAYS);
    if (m) {
      const days = parseInt(m[1], 10);
      const future = new Date();
      future.setDate(future.getDate() + days);
      return future;
    }

    return undefined;
  }

  private extractRecurring(sentence: string): string | undefined {
    const m = sentence.match(RECURRING);
    return m ? m[0].toLowerCase() : undefined;
  }

  private extractConsequences(sentence: string): string | undefined {
    const m = sentence.match(CONSEQUENCE);
    return m ? m[1].trim() : undefined;
  }
}
