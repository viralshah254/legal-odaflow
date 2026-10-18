import { Injectable } from '@nestjs/common';

export type DataSensitivityLevel = 'public' | 'internal' | 'confidential' | 'privileged' | 'restricted';

export interface ClassificationResult {
  level: DataSensitivityLevel;
  reasons: string[];
  piiDetected: boolean;
  piiTypes: string[];
  privileged: boolean;
  privilegeType?: string;
}

export interface RedactionResult {
  redacted: string;
  redactions: Array<{ type: string; original: string; replacement: string }>;
}

interface PiiPattern {
  type: string;
  regex: RegExp;
}

const PII_PATTERNS: PiiPattern[] = [
  { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: 'phone', regex: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g },
  { type: 'aadhaar', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { type: 'pan', regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g },
  { type: 'ssn', regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g },
  { type: 'passport', regex: /\b[A-Z]{1,2}[0-9]{6,9}\b/g },
  { type: 'dob', regex: /\b(?:date\s+of\s+birth|dob|born\s+on)[:\s]+\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/gi },
  { type: 'bank_account', regex: /\b\d{9,18}\b(?=\s*(?:account|a\/c|acct))?/g },
  { type: 'credit_card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  {
    type: 'full_name',
    regex: /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
  },
];

const PRIVILEGE_MARKERS: Array<{ marker: string; type: string }> = [
  { marker: 'attorney-client', type: 'attorney_client_privilege' },
  { marker: 'attorney client', type: 'attorney_client_privilege' },
  { marker: 'work product', type: 'work_product_doctrine' },
  { marker: 'privileged and confidential', type: 'privileged_and_confidential' },
  { marker: 'without prejudice', type: 'without_prejudice' },
];

const LEGAL_MATTER_TERMS = [
  'litigation',
  'pleading',
  'affidavit',
  'deposition',
  'subpoena',
  'injunction',
  'plaintiff',
  'defendant',
  'petitioner',
  'respondent',
  'settlement',
  'confidential',
  'legal advice',
  'counsel',
];

@Injectable()
export class DataClassificationService {
  classify(text: string, _context?: { matterId?: string; tenantId?: string }): ClassificationResult {
    const lower = text.toLowerCase();
    const reasons: string[] = [];
    const piiTypes: string[] = [];
    let privileged = false;
    let privilegeType: string | undefined;

    for (const { marker, type } of PRIVILEGE_MARKERS) {
      if (lower.includes(marker)) {
        privileged = true;
        privilegeType = type;
        reasons.push(`Privilege marker detected: "${marker}"`);
        break;
      }
    }

    for (const { type, regex } of PII_PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(text)) {
        piiTypes.push(type);
        reasons.push(`PII detected: ${type}`);
      }
    }

    const piiDetected = piiTypes.length > 0;

    let level: DataSensitivityLevel;
    if (privileged) {
      level = 'privileged';
    } else if (piiDetected) {
      level = 'confidential';
      reasons.push('Contains personally identifiable information');
    } else if (LEGAL_MATTER_TERMS.some((term) => lower.includes(term))) {
      level = 'confidential';
      reasons.push('Contains legal matter terminology');
    } else {
      level = 'internal';
      reasons.push('No sensitive markers detected');
    }

    return { level, reasons, piiDetected, piiTypes, privileged, privilegeType };
  }

  redactPii(text: string, level: 'partial' | 'full'): RedactionResult {
    const redactions: RedactionResult['redactions'] = [];
    let redacted = text;

    for (const { type, regex } of PII_PATTERNS) {
      regex.lastIndex = 0;
      const matches = [...text.matchAll(regex)];
      for (const match of matches) {
        const original = match[0];
        const replacement =
          level === 'full' ? `[PII:${type.toUpperCase()}]` : this.partialRedact(original, type);
        redactions.push({ type, original, replacement });
      }
    }

    const sorted = redactions.slice().sort((a, b) => b.original.length - a.original.length);
    const seen = new Set<string>();
    for (const r of sorted) {
      if (seen.has(r.original)) continue;
      seen.add(r.original);
      redacted = redacted.split(r.original).join(r.replacement);
    }

    return { redacted, redactions };
  }

  private partialRedact(value: string, type: string): string {
    if (type === 'email') {
      const atIdx = value.indexOf('@');
      if (atIdx > 2) {
        return value.slice(0, 2) + '***' + value.slice(atIdx);
      }
      return '***' + value.slice(atIdx);
    }
    if (type === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 6) {
        return digits.slice(0, 2) + '***' + digits.slice(-4);
      }
    }
    if (value.length <= 4) return '****';
    const keep = Math.max(2, Math.floor(value.length * 0.2));
    return value.slice(0, keep) + '***' + value.slice(-keep);
  }
}
