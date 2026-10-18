import { resolveDocumentKind } from '@/config/templates/document-kinds';

/**
 * Contract intake field registry and helpers for extract-then-ask flow.
 * Field IDs align with planningAnswers keys and document-automation merge fields.
 */

export type ExtractedFieldValue = string | string[] | null;

export type ExtractedFields = Record<string, ExtractedFieldValue>;

export interface PlanQuestionItem {
  id: string;
  text: string;
  required: boolean;
  type: 'single' | 'multi' | 'text';
  options: string[];
  allowAllOfAbove?: boolean;
}

/** Canonical contract drafting field IDs used across intake, preview, and merge. */
export const CONTRACT_INTAKE_FIELD_IDS = [
  'party1Name',
  'party1Address',
  'party1Role',
  'party2Name',
  'party2Address',
  'party2Role',
  'scopeOfWork',
  'paymentTerms',
  'contractDuration',
  'contractStartDate',
  'documentType',
  'governingLaw',
  'specialClauses',
  'ipOwnership',
  'taxWithholding',
  'terminationNotice',
  'confidentiality',
] as const;

export type ContractIntakeFieldId = (typeof CONTRACT_INTAKE_FIELD_IDS)[number];

/** Human-readable labels for summary UI (frontend may mirror). */
export const CONTRACT_FIELD_LABELS: Record<string, string> = {
  party1Name: 'Party 1 — name',
  party1Address: 'Party 1 — address',
  party1Role: 'Party 1 — role',
  party2Name: 'Party 2 — name',
  party2Address: 'Party 2 — address',
  party2Role: 'Party 2 — role',
  scopeOfWork: 'Scope of work',
  paymentTerms: 'Payment terms',
  contractDuration: 'Duration',
  contractStartDate: 'Start date',
  documentType: 'Document type',
  governingLaw: 'Governing law',
  specialClauses: 'Special clauses',
  ipOwnership: 'IP ownership',
  taxWithholding: 'Tax / withholding',
  terminationNotice: 'Termination notice',
  confidentiality: 'Confidentiality',
};

/** Fields shown in the "What we understood" summary (exclude internal role hints). */
export const SUMMARY_FIELD_IDS = [
  'documentType',
  'party1Name',
  'party1Address',
  'party2Name',
  'party2Address',
  'scopeOfWork',
  'paymentTerms',
  'contractDuration',
  'contractStartDate',
  'governingLaw',
] as const;

function isNonEmptyValue(value: ExtractedFieldValue | undefined): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0 && value.some((v) => v.trim().length > 0);
  return typeof value === 'string' && value.trim().length > 0;
}

/** Normalize LLM extractedFields payload — drop null/empty, trim strings. */
export function normalizeExtractedFields(
  raw: Record<string, unknown> | undefined | null,
): ExtractedFields {
  if (!raw || typeof raw !== 'object') return {};

  const out: ExtractedFields = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const arr = value
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean);
      if (arr.length > 0) out[key] = arr;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
    }
  }
  return out;
}

/**
 * Drop questions whose id maps to a non-empty extracted value.
 * Also drops questions whose text clearly asks for an already-extracted party field.
 */
export function filterQuestionsByExtractedFields(
  questions: PlanQuestionItem[],
  extractedFields: ExtractedFields,
): PlanQuestionItem[] {
  const partyNamePatterns: Record<string, RegExp> = {
    party1Name: /party\s*1.*(name|legal name)/i,
    party1Address: /party\s*1.*(address|location)/i,
    party2Name: /party\s*2.*(name|legal name)|counterparty.*(name|legal name)/i,
    party2Address: /party\s*2.*(address|location)|counterparty.*(address|location)/i,
    scopeOfWork: /scope|subject matter|services|purpose of the agreement/i,
    paymentTerms: /payment|financial terms|fee|salary|rent/i,
    contractDuration: /duration|term|length|end date/i,
    governingLaw: /governing law|jurisdiction.*apply/i,
  };

  return questions.filter((q) => {
    if (isNonEmptyValue(extractedFields[q.id])) return false;

    for (const [fieldId, pattern] of Object.entries(partyNamePatterns)) {
      if (isNonEmptyValue(extractedFields[fieldId]) && pattern.test(q.text)) {
        return false;
      }
    }
    return true;
  });
}

/** Merge extracted fields into user answers; user edits win. */
export function mergeExtractedIntoAnswers(
  extractedFields: ExtractedFields,
  userAnswers: Record<string, string | string[]>,
): Record<string, string | string[]> {
  const merged: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(extractedFields)) {
    if (isNonEmptyValue(value)) {
      merged[key] = value as string | string[];
    }
  }

  for (const [key, value] of Object.entries(userAnswers)) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    merged[key] = value;
  }

  return merged;
}

/**
 * Heuristic extraction from facts when AI is unavailable (offline fallback).
 * Conservative — only extracts obvious patterns.
 */
export function extractFieldsHeuristicFromFacts(facts: string): ExtractedFields {
  const extracted: ExtractedFields = {};
  const lower = facts.toLowerCase();

  // Document type hint
  if (/\bcontractor\b|\bcontractor agreement\b/i.test(facts)) {
    extracted.documentType = 'contractor_agreement';
  } else if (/\bnda\b|non.?disclosure/i.test(facts)) {
    extracted.documentType = 'nda';
  } else if (/\bemployment contract\b|\bemployee\b/i.test(facts)) {
    extracted.documentType = 'employment_contract';
  } else if (/\bcontract\b|\bagreement\b/i.test(facts)) {
    extracted.documentType = 'service_agreement';
  }

  // Company as party 1: "company is X" or "we are a/us company"
  const companyMatch = facts.match(
    /(?:company is|our company is|we are (?:a\s+)?(?:us\s+)?company(?:\s+named)?)\s+([a-z0-9][a-z0-9\s.&'-]{1,60})/i,
  );
  if (companyMatch?.[1]) {
    extracted.party1Name = companyMatch[1].trim().replace(/[,.]$/, '');
    extracted.party1Role = 'client';
  }

  // Contractor as party 2: "for NAME a contractor"
  const contractorMatch = facts.match(
    /\bfor\s+([a-z][a-z\s.'-]{2,40})\s+(?:a\s+)?contractor\b/i,
  );
  if (contractorMatch?.[1]) {
    extracted.party2Name = contractorMatch[1].trim();
    extracted.party2Role = 'contractor';
  }

  // Address: "address is ..."
  const addressMatch = facts.match(
    /address\s+is\s+([^,.]+(?:,\s*[^,.]+){0,4})/i,
  );
  if (addressMatch?.[1]) {
    extracted.party1Address = addressMatch[1].trim();
  }

  // Payment: "earning X per month" or "X inr/usd per month"
  const paymentMatch = facts.match(
    /(?:earning|pay(?:ing)?|salary|fee|rate)\s+(?:of\s+)?(\d+k?\s*(?:inr|usd|eur|gbp)?(?:\s*per\s*month)?[^,.]*)/i,
  );
  if (paymentMatch?.[1]) {
    extracted.paymentTerms = paymentMatch[1].trim();
  }

  // Duration: "for 3 months" or "3 months"
  const durationMatch = facts.match(/\b(?:for\s+)?(\d+\s*(?:month|year|week)s?)\b/i);
  if (durationMatch?.[1]) {
    extracted.contractDuration = durationMatch[1].trim();
  }

  // Scope: job description / tasks
  const scopeMatch = facts.match(
    /(?:job description is|role is|tasks are(?: to)?|scope is)\s+([^,.]+(?:,\s*[^,.]+)?)/i,
  );
  if (scopeMatch?.[1]) {
    extracted.scopeOfWork = scopeMatch[1].trim();
  }

  // Cross-border hint — don't set governingLaw, but useful for question generation
  if (/\bus company\b/i.test(facts) && /\binr\b/i.test(lower)) {
    // payment in INR from US company — governing law still unknown
  }

  return extracted;
}

/** Filter contract drafting fallback questions using heuristic extraction. */
export function filterContractFallbackQuestions(
  questions: PlanQuestionItem[],
  facts: string,
): { extractedFields: ExtractedFields; questions: PlanQuestionItem[] } {
  const extractedFields = extractFieldsHeuristicFromFacts(facts);
  const filtered = filterQuestionsByExtractedFields(questions, extractedFields);
  return { extractedFields, questions: filtered };
}

/** Map preview/intake documentType synonyms to canonical documentKind. */
export function resolveCanonicalDocumentKind(
  documentType: string | undefined,
  factsSummary?: string,
  planningAnswers?: Record<string, string>,
  matterTitle?: string,
): string {
  return resolveDocumentKind(documentType, factsSummary, planningAnswers, matterTitle);
}
