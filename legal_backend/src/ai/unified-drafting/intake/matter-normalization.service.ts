import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DraftModelRouterService } from '../draft-model-router.service';
import { RequiredInputResolverService } from './required-input-resolver.service';
import { extractAccusedFromAddendum } from './addendum-parser';
import type { QualityTier } from '../contracts/model-aliases';
import type {
  NormalizedMatter,
  FactItem,
  PartyRef,
  DateItem,
  ReliefItem,
  MissingInput,
  Contradiction,
  CourtRef,
} from '../contracts/normalized-matter';

export interface StructuredDraftParties {
  plaintiffs: Array<{ name: string; role: string }>;
  defendants: Array<{ name: string; role: string }>;
}

export interface NormalizeInput {
  rawFacts: string;
  documentKind: string;
  jurisdiction?: string;
  courtName?: string;
  clientName?: string;
  opposingParty?: string;
  /** Explicit multi-party list from client extraction — preferred when present. */
  parties?: StructuredDraftParties;
  attachmentContext?: string;
  tenantId: string;
  userId: string;
  qualityTier: QualityTier;
}

const NORMALIZATION_SYSTEM_PROMPT = `You are a legal intake processor. Your job is to extract and structure the factual inputs for a court document or legal notice.

Rules:
- Extract all named parties, dates, amounts, and court references.
- Classify each fact as: confirmed (user stated it directly), alleged (user made a claim about the other side), disputed (user acknowledged it is contested), uncertain (unclear from the input).
- Identify genuinely absent required information (party names, FIR, sections, arrest date, etc.). If the user already provided a value — including in "Additional information provided" — treat it as confirmed; never re-flag it as placeholder or request confirmation.
- Put uncertain quality judgments in contradictions with blocking false — do NOT add missingInputs for values the user already stated.
- Set blocking: false on every missingInputs entry (system handles blocking separately).
- Preserve the user's exact wording for allegations — do not paraphrase or upgrade their strength.
- Do not invent any facts.
- Output ONLY valid JSON matching the schema provided. No markdown, no preamble.

DeepSeek Chat is used for intake extraction only. You are NOT the final legal drafter.`;

@Injectable()
export class MatterNormalizationService {
  private readonly logger = new Logger(MatterNormalizationService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly modelRouter: DraftModelRouterService,
    private readonly requiredInputResolver: RequiredInputResolverService,
  ) {}

  async normalize(input: NormalizeInput): Promise<NormalizedMatter> {
    const model = this.modelRouter.resolveIntakeModel(input.qualityTier);

    const userPrompt = this.buildPrompt(input);

    let parsed: Partial<NormalizedMatter> = {};
    try {
      const result = await this.llm.complete({
        modelName: model,
        messages: [
          { role: 'system', content: NORMALIZATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        maxTokens: 3000,
      });

      parsed = JSON.parse(result.content) as Partial<NormalizedMatter>;
    } catch (err) {
      this.logger.warn(`Matter normalization LLM failed, using fallback: ${String(err)}`);
      parsed = this.buildFallbackMatter(input);
    }

    return this.mergeParsed(parsed, input);
  }

  private buildPrompt(input: NormalizeInput): string {
    const schemaExample = `{
  "parties": [{"role": "petitioner", "name": "...", "description": "...", "address": "..."}],
  "facts": [{"id": "f1", "statement": "...", "status": "confirmed|alleged|disputed|uncertain", "source": "user", "date": "YYYY-MM-DD or null"}],
  "dates": [{"id": "d1", "label": "Order date", "date": "...", "factIds": ["f1"]}],
  "requestedRelief": [{"id": "r1", "description": "...", "type": "primary|interim|costs|ancillary"}],
  "proceduralHistory": [],
  "userAssertions": [{"id": "a1", "text": "...", "confidence": "high|medium|low", "factIds": ["f1"]}],
  "missingInputs": [{"field": "court_name", "description": "Court name not specified", "blocking": true}],
  "contradictions": []
}`;

    const parts = [
      `DOCUMENT TYPE: ${input.documentKind}`,
      `JURISDICTION: ${input.jurisdiction ?? 'India'}`,
      input.courtName ? `COURT: ${input.courtName}` : '',
      input.clientName ? `CLIENT: ${input.clientName}` : '',
      input.opposingParty ? `OPPOSING PARTY: ${input.opposingParty}` : '',
      input.parties
        ? `STRUCTURED PARTIES JSON:\n${JSON.stringify(input.parties, null, 2)}`
        : '',
      '',
      `RAW FACTS FROM USER:`,
      input.rawFacts,
      input.attachmentContext ? `\nATTACHED DOCUMENT TEXT:\n${input.attachmentContext.slice(0, 3000)}` : '',
      '',
      `OUTPUT SCHEMA (return only valid JSON):`,
      schemaExample,
    ].filter(Boolean).join('\n');

    return parts;
  }

  private mergeParsed(parsed: Partial<NormalizedMatter>, input: NormalizeInput): NormalizedMatter {
    const court: CourtRef | undefined = input.courtName
      ? {
          name: input.courtName,
          jurisdiction: input.jurisdiction ?? 'IN',
          level: 'district',
        }
      : undefined;

    const facts: FactItem[] = (parsed.facts ?? []).map((f) => ({
      ...f,
      id: f.id ?? randomUUID(),
    }));

    // Ensure client and opposing party appear in parties if not already extracted
    let parties: PartyRef[] = (parsed.parties ?? []).map((p) => ({
      ...p,
      role: this.normalizePartyRole(p.role, input.documentKind),
    }));

    // Prefer explicit structured parties from the client (multi-plaintiff / multi-defendant).
    if (input.parties) {
      parties = this.mergeStructuredParties(parties, input.parties, input.documentKind);
    } else {
      this.mergeJoinedPartyStrings(parties, input);
    }

    const addendumAccused = extractAccusedFromAddendum(input.rawFacts);
    if (addendumAccused) {
      parties = parties.filter(
        (p) =>
          !(
            p.role === 'petitioner' &&
            input.clientName &&
            p.name.toLowerCase() === input.clientName.toLowerCase() &&
            p.name.toLowerCase() !== addendumAccused.toLowerCase()
          ),
      );
      if (!parties.some((p) => p.name.toLowerCase() === addendumAccused.toLowerCase())) {
        parties.unshift({ role: 'petitioner', name: addendumAccused });
      }
    } else if (
      !input.parties &&
      input.clientName &&
      !input.clientName.includes(';') &&
      !parties.some((p) => p.name === input.clientName)
    ) {
      parties.unshift({ role: 'petitioner', name: input.clientName });
    }

    // Infer parties from raw narrative when the LLM omitted structured roles.
    if (parties.length === 0 && input.rawFacts.trim()) {
      parties = this.inferPartiesFromText(input.rawFacts, input.documentKind, input.clientName);
    }

    const matterSlice = {
      parties,
      facts,
      dates: (parsed.dates ?? []).map((d) => ({ ...d, id: d.id ?? randomUUID() })) as DateItem[],
    };

    // Blocking is deterministic only — LLM "confirmation" loops are disabled.
    const deterministicMissing = this.requiredInputResolver.resolve(input, matterSlice);
    const missingInputs = this.filterIrrelevantMissing(
      deterministicMissing,
      input.documentKind,
    );

    return {
      id: randomUUID(),
      jurisdiction: input.jurisdiction ?? 'IN',
      documentKind: input.documentKind,
      court,
      parties,
      facts,
      dates: matterSlice.dates,
      requestedRelief: (parsed.requestedRelief ?? []).map((r) => ({ ...r, id: r.id ?? randomUUID() })) as ReliefItem[],
      proceduralHistory: parsed.proceduralHistory ?? [],
      userAssertions: parsed.userAssertions ?? [],
      missingInputs,
      contradictions: (parsed.contradictions ?? []) as Contradiction[],
      sourceDocumentIds: [],
      rawUserInput: input.rawFacts,
      normalizedAt: new Date().toISOString(),
    };
  }

  private normalizePartyRole(role: string, documentKind: string): PartyRef['role'] {
    const r = role.toLowerCase().replace(/\s+/g, '_');
    const VALID_ROLES: PartyRef['role'][] = [
      'petitioner', 'plaintiff', 'appellant', 'applicant', 'accused',
      'respondent', 'defendant', 'other',
    ];
    if (VALID_ROLES.includes(r as PartyRef['role'])) {
      return r as PartyRef['role'];
    }
    if (['opposite_party'].includes(r)) return 'respondent';
    if (/family|divorce|matrimonial|maintenance|conjugal/i.test(documentKind)) {
      if (r === 'complainant') return 'petitioner';
    }
    return 'other';
  }

  /** Merge client-extracted multi-party JSON into NormalizedMatter parties. */
  private mergeStructuredParties(
    existing: PartyRef[],
    structured: StructuredDraftParties,
    documentKind: string,
  ): PartyRef[] {
    const out = [...existing];
    const hasName = (name: string) =>
      out.some((p) => p.name.toLowerCase() === name.toLowerCase());

    for (const p of structured.plaintiffs ?? []) {
      if (!p?.name?.trim() || hasName(p.name)) continue;
      out.unshift({
        role: this.normalizePartyRole(p.role || 'plaintiff', documentKind),
        name: p.name.trim(),
      });
    }
    for (const p of structured.defendants ?? []) {
      if (!p?.name?.trim() || hasName(p.name)) continue;
      out.push({
        role: this.normalizePartyRole(p.role || 'defendant', documentKind),
        name: p.name.trim(),
      });
    }
    return out;
  }

  /** Split joined "A; B" client/opposing strings into individual parties. */
  private mergeJoinedPartyStrings(parties: PartyRef[], input: NormalizeInput): void {
    const splitNames = (raw?: string): string[] =>
      (raw ?? '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);

    for (const name of splitNames(input.clientName)) {
      if (!parties.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        parties.unshift({
          role: this.normalizePartyRole('plaintiff', input.documentKind),
          name,
        });
      }
    }
    for (const name of splitNames(input.opposingParty)) {
      if (!parties.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        parties.push({
          role: this.normalizePartyRole('defendant', input.documentKind),
          name,
        });
      }
    }
  }

  private inferPartiesFromText(rawFacts: string, documentKind: string, clientName?: string): PartyRef[] {
    const parties: PartyRef[] = [];
    const person =
      '(?:Mrs?|Ms|Miss|Mr|Shri|Smt|Dr)\\.?\\s+[A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)*';

    const married = rawFacts.match(
      new RegExp(`(${person})\\s+and\\s+(${person})\\s+were\\s+married`, 'i'),
    );
    if (married) {
      parties.push({ role: 'petitioner', name: married[1].trim() });
      parties.push({ role: 'respondent', name: married[2].trim() });
      return parties;
    }

    const vsMatch = rawFacts.match(
      new RegExp(`(${person})\\s+(?:vs\\.?|v\\.?|versus)\\s+(${person})`, 'i'),
    );
    if (vsMatch) {
      parties.push({ role: 'petitioner', name: vsMatch[1].trim() });
      parties.push({ role: 'respondent', name: vsMatch[2].trim() });
      return parties;
    }

    const seeks = rawFacts.match(
      new RegExp(`(${person})\\s+seeks\\s+(?:remedy|relief)`, 'i'),
    );
    const contends = rawFacts.match(
      new RegExp(`(${person})\\s+contends\\s+that`, 'i'),
    );
    if (seeks) parties.push({ role: 'petitioner', name: seeks[1].trim() });
    if (contends) parties.push({ role: 'respondent', name: contends[1].trim() });

    if (parties.length === 0 && clientName) {
      parties.push({ role: 'petitioner', name: clientName });
    }

    return parties;
  }

  private filterIrrelevantMissing(inputs: MissingInput[], documentKind: string): MissingInput[] {
    const kind = documentKind.toLowerCase();
    const needsOrderDate =
      /revision|appeal|review|challenge|set aside|impugned|maintenance_order|interim_order/i.test(kind);

    return inputs.filter((item) => {
      const key = `${item.field} ${item.description}`.toLowerCase();
      if (!needsOrderDate && /order date|impugned order|interim order date/.test(key)) {
        return false;
      }
      return true;
    });
  }

  private buildFallbackMatter(input: NormalizeInput): Partial<NormalizedMatter> {
    let parties: PartyRef[] = [];
    if (input.parties) {
      parties = this.mergeStructuredParties([], input.parties, input.documentKind);
    }
    const addendumAccused = extractAccusedFromAddendum(input.rawFacts);
    if (addendumAccused) {
      if (!parties.some((p) => p.name.toLowerCase() === addendumAccused.toLowerCase())) {
        parties.unshift({ role: 'petitioner', name: addendumAccused });
      }
    } else if (!input.parties) {
      this.mergeJoinedPartyStrings(parties, input);
    }
    if (parties.length === 0 && input.rawFacts.trim()) {
      parties = this.inferPartiesFromText(input.rawFacts, input.documentKind, input.clientName);
    }

    return {
      parties,
      facts: [
        {
          id: 'f1',
          statement: input.rawFacts.slice(0, 500),
          status: 'confirmed',
          source: 'user',
        },
      ],
      dates: [],
      requestedRelief: [],
      proceduralHistory: [],
      userAssertions: [],
      missingInputs: [{ field: 'full_facts', description: 'Intake normalization failed — facts require manual review', blocking: false }],
      contradictions: [],
    };
  }
}
