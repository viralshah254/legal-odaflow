import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { LlmCompletionService } from '../llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '../model-costs.config';

export interface FirExtractedField<T = string> {
  value: T | null;
  confidence: 'high' | 'medium' | 'low' | 'missing';
  raw?: string;
}

export interface FirExtractedFacts {
  firNumber: FirExtractedField;
  policeStation: FirExtractedField;
  district: FirExtractedField;
  state: FirExtractedField;
  dateOfOccurrence: FirExtractedField;
  dateOfFiling: FirExtractedField;
  complainant: FirExtractedField;
  accused: FirExtractedField<string[]>;
  allegedOffences: FirExtractedField<string[]>;
  sections: FirExtractedField<string[]>;
  arrestStatus: FirExtractedField<'arrested' | 'not_arrested' | 'warrant_issued' | 'unknown'>;
  factsNarrative: FirExtractedField;
  propertyInvolved: FirExtractedField;
  amountInvolved: FirExtractedField;
  witnesses: FirExtractedField<string[]>;
  missingFields: string[];
  documentQuality: 'clear' | 'partial' | 'poor';
}

export interface FirNextStep {
  step: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: 'bail' | 'documents' | 'procedure' | 'research' | 'draft' | 'timeline' | 'defect';
  details: string;
}

export interface FirExtractionResult {
  extractedFacts: FirExtractedFacts;
  nextSteps: FirNextStep[];
  suggestedResearchQuery: string;
  suggestedDraftTypes: string[];
  bailPostureSummary: string;
  riskFlags: string[];
  countryCode: string;
  disclaimer: string;
}

const DISCLAIMER =
  'This FIR analysis is for informational purposes only. It is not legal advice. ' +
  'Extracted facts may be incomplete or require verification. ' +
  'Always consult a qualified advocate before taking any legal action.';

@Injectable()
export class FirExtractionService {
  private readonly logger = new Logger(FirExtractionService.name);

  constructor(private readonly llm: LlmCompletionService) {}

  async extractFromText(
    rawText: string,
    countryCode: string,
  ): Promise<FirExtractionResult> {
    if (countryCode !== 'IN') {
      throw new BadRequestException(
        'FIR-specific legal next steps are only available for India (IN). ' +
          'OCR extraction succeeded — use document review for other jurisdictions.',
      );
    }

    if (!rawText.trim()) {
      throw new BadRequestException('No text content to extract from');
    }

    const systemPrompt =
      'You are a precise JSON-only FIR extraction engine for Indian criminal law. ' +
      'Output only valid JSON. No markdown fences. No explanation outside JSON.';

    // Keep up to 14 000 chars — covers a typical 3-4 page Hindi+English FIR including all
    // sections, accused list, facts narrative and bail-relevant offence descriptions.
    const textSnippet = rawText.slice(0, 14000);

    const userPrompt = `Extract structured facts from this Indian FIR and produce the JSON below.

RULES:
- The document may be in Hindi, English, or a mix of both. Extract values in the language they appear; transliterate names to English where possible.
- confidence: "high" (explicit in text), "medium" (inferred), "low" (guessed), "missing" (absent).
- sections: all IPC/BNS/CrPC/BNSS section numbers mentioned (e.g. "106", "281", "IPC 302").
- Do NOT invent facts not in the text.
- missingFields: fields typically in a FIR but absent here.
- nextSteps: 3-7 practical steps for a defence advocate in India.
- riskFlags: procedural defects, jurisdiction or limitation issues.
- bailPostureSummary: based on the specific sections found, state whether bail is likely bailable, non-bailable, or requires High Court; name the key sections driving the posture.

IMPORTANT: Output ONLY the JSON object below. No preamble. No markdown fences. No explanation.

JSON SCHEMA:
{
  "extractedFacts": {
    "firNumber": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "policeStation": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "district": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "state": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "dateOfOccurrence": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "dateOfFiling": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "complainant": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "accused": { "value": string[]|null, "confidence": "high"|"medium"|"low"|"missing" },
    "allegedOffences": { "value": string[]|null, "confidence": "high"|"medium"|"low"|"missing" },
    "sections": { "value": string[]|null, "confidence": "high"|"medium"|"low"|"missing" },
    "arrestStatus": { "value": "arrested"|"not_arrested"|"warrant_issued"|"unknown", "confidence": "high"|"medium"|"low"|"missing" },
    "factsNarrative": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "propertyInvolved": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "amountInvolved": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
    "witnesses": { "value": string[]|null, "confidence": "high"|"medium"|"low"|"missing" },
    "missingFields": ["field1"],
    "documentQuality": "clear"|"partial"|"poor"
  },
  "nextSteps": [{ "step": string, "priority": "urgent"|"high"|"medium"|"low", "category": "bail"|"documents"|"procedure"|"research"|"draft"|"timeline"|"defect", "details": string }],
  "suggestedResearchQuery": string,
  "suggestedDraftTypes": [string],
  "bailPostureSummary": string,
  "riskFlags": [string]
}

FIR TEXT:
---
${textSnippet}
---`;

    let rawResponse: string;
    try {
      const result = await this.llm.complete({
        modelName: DEFAULT_AUTO_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 3000,
        temperature: 0.1,
      });
      rawResponse = result.content;
    } catch (err) {
      this.logger.error('FIR extraction LLM call failed', err);
      throw new BadRequestException(
        'Could not analyse the FIR. Please check the document quality and try again.',
      );
    }

    let parsed: Omit<FirExtractionResult, 'countryCode' | 'disclaimer'>;
    try {
      // Strip markdown fences first, then find the outermost JSON object.
      // LLMs occasionally add preamble/postamble text despite the instruction.
      const stripped = rawResponse
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      // Find the first '{' and the matching last '}' to extract the JSON block.
      const start = stripped.indexOf('{');
      const end = stripped.lastIndexOf('}');
      const jsonBlock = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

      parsed = JSON.parse(jsonBlock) as typeof parsed;
    } catch {
      this.logger.warn(
        'FIR extraction JSON parse failed — raw LLM response (first 500 chars): ' +
        rawResponse.slice(0, 500),
      );
      parsed = {
        extractedFacts: {
          firNumber: { value: null, confidence: 'missing' },
          policeStation: { value: null, confidence: 'missing' },
          district: { value: null, confidence: 'missing' },
          state: { value: null, confidence: 'missing' },
          dateOfOccurrence: { value: null, confidence: 'missing' },
          dateOfFiling: { value: null, confidence: 'missing' },
          complainant: { value: null, confidence: 'missing' },
          accused: { value: null, confidence: 'missing' },
          allegedOffences: { value: null, confidence: 'missing' },
          sections: { value: null, confidence: 'missing' },
          arrestStatus: { value: 'unknown', confidence: 'missing' },
          factsNarrative: { value: rawText.slice(0, 500), confidence: 'low' },
          propertyInvolved: { value: null, confidence: 'missing' },
          amountInvolved: { value: null, confidence: 'missing' },
          witnesses: { value: null, confidence: 'missing' },
          missingFields: [],
          documentQuality: 'poor',
        },
        nextSteps: [],
        suggestedResearchQuery: '',
        suggestedDraftTypes: [],
        bailPostureSummary: 'Unable to determine bail posture — document quality insufficient.',
        riskFlags: ['OCR or document quality issue: could not fully parse the FIR.'],
      };
    }

    return {
      ...parsed,
      countryCode: 'IN',
      disclaimer: DISCLAIMER,
    };
  }
}
