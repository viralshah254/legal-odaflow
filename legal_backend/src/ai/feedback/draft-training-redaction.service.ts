import { Injectable } from '@nestjs/common';
import { DataClassificationService } from '@/platform/security/data-classification.service';

export interface RedactionContext {
  /** Raw case details string from the draft (used to extract party names) */
  caseDetails?: string;
  /** Explicit party names already known — e.g. clientName, opposingParty */
  knownParties?: string[];
}

export interface TrainingRedactionResult {
  text: string;
  redactedTokens: string[];
}

/**
 * Legal-domain redaction for training data.
 * Wraps DataClassificationService (covers email, phone, Aadhaar, PAN, SSN, DOB,
 * bank accounts, credit cards, titled names) and adds patterns specific to
 * court documents: case numbers, untitled party names, and addresses.
 */
@Injectable()
export class DraftTrainingRedactionService {
  constructor(private readonly dataClassification: DataClassificationService) {}

  /**
   * Redact both the AI-generated text and the user-edited text for safe storage.
   * Always call this before inserting into DraftSectionFeedback.
   */
  redactPair(
    aiText: string,
    userText: string,
    context: RedactionContext = {},
  ): { aiText: string; userText: string; redactedTokens: string[] } {
    const partyReplacementMap = this.buildPartyMap(context);

    const aiResult = this.redactForTraining(aiText, partyReplacementMap);
    const userResult = this.redactForTraining(userText, partyReplacementMap);

    const allTokens = Array.from(
      new Set([...aiResult.redactedTokens, ...userResult.redactedTokens]),
    );

    return {
      aiText: aiResult.text,
      userText: userResult.text,
      redactedTokens: allTokens,
    };
  }

  /**
   * Redact a single text for training storage.
   */
  redactForTraining(
    text: string,
    partyReplacementMap?: Map<string, string>,
  ): TrainingRedactionResult {
    if (!text) return { text: '', redactedTokens: [] };

    let out = text;
    const redactedTokens: string[] = [];

    // 1. Replace known party names using the pre-built map (preserves consistency across sections)
    if (partyReplacementMap) {
      for (const [name, token] of partyReplacementMap) {
        if (out.includes(name)) {
          out = out.split(name).join(token);
          redactedTokens.push(name);
        }
      }
    }

    // 2. Legal-specific structural patterns
    const legalPatternResults = this.applyLegalPatterns(out);
    out = legalPatternResults.text;
    redactedTokens.push(...legalPatternResults.redactedTokens);

    // 3. General PII via existing DataClassificationService (email, phone, Aadhaar, PAN, etc.)
    const piiResult = this.dataClassification.redactPii(out, 'full');
    out = piiResult.redacted;
    for (const r of piiResult.redactions) {
      redactedTokens.push(r.original);
    }

    return { text: out.trim(), redactedTokens };
  }

  /**
   * Build a stable party→token map from caseDetails and knownParties.
   * Extracts names from common legal patterns like "A v. B", "Petitioner: X", etc.
   */
  buildPartyMap(context: RedactionContext): Map<string, string> {
    const map = new Map<string, string>();
    const names: string[] = [];

    // Gather from explicit known parties first
    if (context.knownParties) {
      for (const name of context.knownParties) {
        if (name && name.trim().length > 2) {
          names.push(name.trim());
        }
      }
    }

    // Parse caseDetails for common legal name patterns
    if (context.caseDetails) {
      const extracted = this.extractNamesFromCaseDetails(context.caseDetails);
      for (const name of extracted) {
        if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) {
          names.push(name);
        }
      }
    }

    // Assign stable placeholder tokens sorted by length (longest first to avoid partial replacement)
    const sorted = names.filter((n) => n.length > 2).sort((a, b) => b.length - a.length);
    const labels = ['PARTY_A', 'PARTY_B', 'PARTY_C', 'PARTY_D', 'PARTY_E'];

    sorted.forEach((name, idx) => {
      const label = labels[idx] ?? `PARTY_${idx + 1}`;
      map.set(name, `[${label}]`);
    });

    return map;
  }

  private extractNamesFromCaseDetails(caseDetails: string): string[] {
    const names: string[] = [];
    const text = caseDetails.slice(0, 3000); // limit work to first 3000 chars

    // Pattern: "Petitioner: <Name>" / "Plaintiff: <Name>" / "Appellant: <Name>" / "Client: <Name>"
    const rolePatterns = [
      /(?:Petitioner|Plaintiff|Appellant|Applicant|Claimant|Complainant)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/g,
      /(?:Respondent|Defendant|Opposite Party|OP|Accused)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/g,
      /(?:Client|Client Name)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/g,
    ];

    for (const pattern of rolePatterns) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].trim().length > 2) {
          names.push(match[1].trim());
        }
      }
    }

    // Pattern: "X v. Y" or "X vs Y" or "X Versus Y"
    const vsPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:v\.|vs\.?|versus)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/g;
    let match: RegExpExecArray | null;
    vsPattern.lastIndex = 0;
    while ((match = vsPattern.exec(text)) !== null) {
      if (match[1]) names.push(match[1].trim());
      if (match[2] && !/^State|^Union|^Government|^Govt/i.test(match[2])) {
        names.push(match[2].trim());
      }
    }

    return [...new Set(names)];
  }

  private applyLegalPatterns(text: string): TrainingRedactionResult {
    const redactedTokens: string[] = [];
    let out = text;

    const patterns: Array<{ regex: RegExp; replacement: string }> = [
      // Case / petition numbers: W.P. No. 1234/2023, CRL.A. 45/2024, O.S. No. 78/2022, CS(OS) 123/2024
      {
        regex: /\b(?:[A-Z]{1,5}(?:\.[A-Z]{1,5})*\s+(?:No\.?|Number)\s+\d+\/\d{2,4}|\bCS\([A-Z]+\)\s+\d+\/\d{4})/g,
        replacement: '[CASE_NO]',
      },
      // Bare case number patterns: "No. 1234/2023" when preceded by petition/case context
      {
        regex: /\b(?:Case|Petition|Suit|Appeal|Revision|Application)\s+(?:No\.?|Number)\s+[\d/\-]+/gi,
        replacement: '[CASE_NO]',
      },
      // FIR numbers: FIR No. 123/2023
      {
        regex: /\bFIR\s+(?:No\.?|Number)\s+[\d/\-]+/gi,
        replacement: '[CASE_NO]',
      },
      // Indian street/postal addresses (D.No., Plot No., House No., Flat No., Door No.)
      {
        regex: /\b(?:D\.No\.|H\.No\.|Plot\s+No\.|Flat\s+No\.|House\s+No\.|Door\s+No\.|Sy\.?\s+No\.?)\s+[\w/,-]+(?:\s+[\w,]+){0,5}/gi,
        replacement: '[ADDRESS]',
      },
      // Pin codes (6-digit Indian postal codes)
      {
        regex: /\b\d{6}\b(?=\s*(?:,|\.|$))/g,
        replacement: '[PINCODE]',
      },
    ];

    for (const { regex, replacement } of patterns) {
      regex.lastIndex = 0;
      const matches = out.match(regex) ?? [];
      if (matches.length > 0) {
        redactedTokens.push(...matches);
        out = out.replace(regex, replacement);
      }
    }

    return { text: out, redactedTokens };
  }
}
