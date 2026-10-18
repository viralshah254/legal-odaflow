import { Injectable, Logger, Optional } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_EXTRACT_MODEL } from '@/ai/model-costs.config';

export interface ExtractFormFieldsInput {
  caseDetails: string;
  kind?: string;
  category?: string;
}

export interface ExtractedFormParty {
  name: string;
  role: 'plaintiff' | 'petitioner' | 'defendant' | 'respondent';
}

export interface ExtractFormFieldsResult {
  clientName?: string;
  opposingParty?: string;
  courtName?: string;
  parties?: {
    plaintiffs: ExtractedFormParty[];
    defendants: ExtractedFormParty[];
  };
  source: 'regex' | 'llm' | 'hybrid';
}

const INDIAN_CITIES =
  'Ahmedabad|Mumbai|Pune|Delhi|New Delhi|Bengaluru|Bangalore|Chennai|Hyderabad|Kolkata|Jaipur|Lucknow|Surat|Noida|Gurugram|Chandigarh';

const LABEL_NAME_STOP =
  '(?=\\s*[,.]|\\s+aged|\\s+residing|\\s+r/o|\\s+son\\s+of|\\s+daughter\\s+of|\\s+s/o|\\s+d/o|\\s+w/o|\\s+consultant|\\s+of\\s+|\\s*$|\\n)';

const LABELED_NAME =
  String.raw`(?:Dr\.?[^\S\n]+)?[A-Z][A-Za-z.']*(?:[^\S\n]+[A-Z][A-Za-z.']*){0,7}`;

const LABELED_PLAINTIFF_RE = new RegExp(
  String.raw`\b((?:Plaintiff|Petitioner|Complainant|Purchaser|Buyer|plaintiff|petitioner|complainant|purchaser|buyer))(?:\s+No\.?\s*\d+)?\s*:\s*(${LABELED_NAME})${LABEL_NAME_STOP}`,
  'gm',
);

const LABELED_DEFENDANT_RE = new RegExp(
  String.raw`\b((?:Defendant|Respondent|Opposite\s+Part(?:y|ies)|Vendor|Seller|defendant|respondent|opposite\s+part(?:y|ies)|vendor|seller))(?:\s+No\.?\s*\d+)?\s*:\s*(${LABELED_NAME})${LABEL_NAME_STOP}`,
  'gm',
);

const ORG_SUFFIX =
  /^(?:Pvt\.?|Ltd\.?|LLP|Inc\.?|Corp\.?|Co\.?|Company|Limited|Private|Hospital|Hospitals|Clinic|Clinics|Insurance|Bank|Motors|Industries|Technologies|Services)$/i;

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/g, '').trim();
}

function isPlausibleCourtName(value: string): boolean {
  const cleaned = cleanName(value);
  if (!cleaned || cleaned.length < 3 || cleaned.length > 120) return false;
  if (/\bscan\b/i.test(cleaned)) return false;
  if (/\bwas\s+performed\b/i.test(cleaned)) return false;
  return true;
}

function isPlausibleOrg(name: string): boolean {
  const cleaned = cleanName(name);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 8) return false;
  return tokens.every(
    (t) => ORG_SUFFIX.test(t) || /^[A-Z][A-Za-z']*\.?$/.test(t) || /^[A-Za-z]\.?$/.test(t),
  );
}

function isPlausiblePerson(name: string): boolean {
  const cleaned = cleanName(name);
  if (!cleaned || cleaned.length > 80) return false;
  if (/^(?:Mrs?|Ms|Miss|Mr|Shri|Smt|Dr)\.?\s+/i.test(cleaned)) {
    const rest = cleaned.replace(/^(?:Mrs?|Ms|Miss|Mr|Shri|Smt|Dr)\.?\s+/i, '');
    return /^[A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){0,4}$/.test(rest) || /^[A-Za-z](?:\s+[A-Za-z])?$/.test(rest);
  }
  return /^[A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){0,4}$/.test(cleaned);
}

function isConsumerContext(kind?: string, category?: string, text?: string): boolean {
  const cat = category?.trim().toLowerCase() ?? '';
  const k = (kind ?? '').toLowerCase();
  if (cat === 'consumer') return true;
  if (k.includes('consumer')) return true;
  if (/research_memo|case_strategy|document_production/i.test(k)) {
    return Boolean(
      text &&
        /\bconsumer\s+complaint\b|\bcpa\b|\bconsumer\s+protection\b|\bdeficiency\s+(?:of|in)\s+service\b/i.test(
          text,
        ),
    );
  }
  if (cat === 'research') {
    return Boolean(text && /\bconsumer\s+complaint\b|\bcpa\b/i.test(text));
  }
  return false;
}

@Injectable()
export class ExtractFormFieldsService {
  private readonly logger = new Logger(ExtractFormFieldsService.name);

  constructor(@Optional() private readonly llm?: LlmCompletionService) {}

  async extract(input: ExtractFormFieldsInput): Promise<ExtractFormFieldsResult> {
    const text = input.caseDetails.trim();
    if (!text) return { source: 'regex' };

    const regex = this.extractRegex(text, input.kind, input.category);
    const needsLlm =
      !regex.clientName?.trim() ||
      !regex.opposingParty?.trim() ||
      !regex.courtName?.trim();

    if (!needsLlm || !this.llm) {
      return { ...regex, source: 'regex' };
    }

    try {
      const llmResult = await this.extractWithLlm(text, input.kind, input.category);
      return {
        clientName: regex.clientName || llmResult.clientName,
        opposingParty: regex.opposingParty || llmResult.opposingParty,
        courtName: regex.courtName || llmResult.courtName,
        parties: regex.parties ?? llmResult.parties,
        source: 'hybrid',
      };
    } catch (err) {
      this.logger.warn(
        `LLM form-field extract failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ...regex, source: 'regex' };
    }
  }

  /** Deterministic labeled-party + court extraction (no LLM). */
  extractRegex(
    text: string,
    kind?: string,
    category?: string,
  ): Omit<ExtractFormFieldsResult, 'source'> {
    const plaintiffs: ExtractedFormParty[] = [];
    const defendants: ExtractedFormParty[] = [];
    const seenP = new Set<string>();
    const seenD = new Set<string>();

    for (const m of text.matchAll(LABELED_PLAINTIFF_RE)) {
      const roleLabel = m[1].toLowerCase();
      const name = cleanName(m[2]);
      if (!name || (!isPlausiblePerson(name) && !isPlausibleOrg(name))) continue;
      const key = name.toLowerCase();
      if (seenP.has(key)) continue;
      seenP.add(key);
      plaintiffs.push({
        name,
        role:
          roleLabel.startsWith('petitioner') || roleLabel.startsWith('complainant')
            ? 'petitioner'
            : 'plaintiff',
      });
    }

    for (const m of text.matchAll(LABELED_DEFENDANT_RE)) {
      const roleLabel = m[1].toLowerCase().replace(/\s+/g, ' ');
      const name = cleanName(m[2]);
      if (!name || (!isPlausiblePerson(name) && !isPlausibleOrg(name))) continue;
      const key = name.toLowerCase();
      if (seenD.has(key)) continue;
      seenD.add(key);
      defendants.push({
        name,
        role:
          roleLabel.startsWith('respondent') || roleLabel.startsWith('opposite')
            ? 'respondent'
            : 'defendant',
      });
    }

    const clientName =
      plaintiffs.length > 0 ? plaintiffs.map((p) => p.name).join('; ') : undefined;
    const opposingParty =
      defendants.length > 0 ? defendants.map((p) => p.name).join('; ') : undefined;

    let courtName: string | undefined;
    const courtMatch = text.match(
      /\b((?:District Consumer Disputes Redressal Commission|State Consumer Disputes Redressal Commission|Consumer Forum|Consumer Commission|High Court|Supreme Court|Sessions Court|District Court|Family Court|Civil Court|Magistrate(?:'s)? Court|Police Station|NCDRC|NCLT|NCLAT|ITAT|CCI|DRAT|DRT)(?:[^\n,;.]{0,60})?)/i,
    );
    if (courtMatch && isPlausibleCourtName(courtMatch[1])) {
      courtName = cleanName(courtMatch[1]);
    } else {
      const jurisdictionCity = text.match(
        new RegExp(`(?:^|\\n)\\s*Jurisdiction\\s*:?\\s*(?:\\n\\s*)?(${INDIAN_CITIES})\\b`, 'im'),
      );
      const cityOnly = text.match(new RegExp(`\\b(${INDIAN_CITIES})\\b`, 'i'));
      const city = cleanName(jurisdictionCity?.[1] ?? cityOnly?.[1] ?? '');
      if (city) {
        if (isConsumerContext(kind, category, text)) {
          courtName = `District Consumer Disputes Redressal Commission, ${city}`;
        } else if (/\bfamily court\b/i.test(text)) {
          courtName = `Family Court, ${city}`;
        } else {
          courtName = `District Court, ${city}`;
        }
      }
    }

    return {
      clientName,
      opposingParty,
      courtName: courtName && isPlausibleCourtName(courtName) ? courtName : undefined,
      parties:
        plaintiffs.length || defendants.length
          ? { plaintiffs, defendants }
          : undefined,
    };
  }

  private async extractWithLlm(
    text: string,
    kind?: string,
    category?: string,
  ): Promise<Omit<ExtractFormFieldsResult, 'source'>> {
    if (!this.llm) return {};

    const snippet = text.slice(0, 6000);
    const system = `Extract party and court fields for an Indian legal draft form.
Return ONLY valid JSON:
{"clientName":string|null,"opposingParty":string|null,"courtName":string|null,"oppositeParties":string[]|null}
Rules:
- clientName = complainant/petitioner/plaintiff only (not doctors unless they are the client).
- opposingParty = semicolon-joined opposite parties / defendants / respondents from labeled lists when present.
- Do NOT invent names. Use null when absent.
- courtName = consumer forum for consumer/medical-negligence facts when city known (e.g. "District Consumer Disputes Redressal Commission, Ahmedabad"). Never use fragments like "scan was performed".`;

    const user = `kind=${kind ?? 'unknown'}; category=${category ?? 'unknown'}\n\nCASE TEXT:\n${snippet}`;

    const completion = await this.llm.complete({
      modelName: DEFAULT_EXTRACT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      maxTokens: 400,
    });

    let parsed: {
      clientName?: string | null;
      opposingParty?: string | null;
      courtName?: string | null;
      oppositeParties?: string[] | null;
    };
    try {
      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return {};
      parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
    } catch {
      return {};
    }

    const opposing =
      (typeof parsed.opposingParty === 'string' && parsed.opposingParty.trim()) ||
      (Array.isArray(parsed.oppositeParties)
        ? parsed.oppositeParties.map((s) => String(s).trim()).filter(Boolean).join('; ')
        : undefined);

    const court =
      typeof parsed.courtName === 'string' && isPlausibleCourtName(parsed.courtName)
        ? cleanName(parsed.courtName)
        : undefined;

    return {
      clientName:
        typeof parsed.clientName === 'string' && parsed.clientName.trim()
          ? cleanName(parsed.clientName)
          : undefined,
      opposingParty: opposing ? cleanName(opposing) : undefined,
      courtName: court,
    };
  }
}
