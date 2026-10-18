import { Injectable } from '@nestjs/common';
import type { MissingInput, NormalizedMatter, PartyRef } from '../contracts/normalized-matter';
import type { NormalizeInput } from './matter-normalization.service';
import { addendumValue, parseAddendumEntries } from './addendum-parser';

interface FieldRule {
  field: string;
  description: string;
  blocking: boolean;
  isPresent: (ctx: ResolverContext) => boolean;
}

interface ResolverContext {
  haystack: string;
  parties: PartyRef[];
  input: NormalizeInput;
  addendum: Record<string, string>;
}

/**
 * Deterministic required-field checks so the procedural gate surfaces every
 * missing input in one pass instead of relying on partial LLM output per job.
 * User-confirmed values in "Additional information provided" are always accepted.
 */
@Injectable()
export class RequiredInputResolverService {
  resolve(input: NormalizeInput, matter: Pick<NormalizedMatter, 'parties' | 'facts' | 'dates'>): MissingInput[] {
    const addendum = parseAddendumEntries(input.rawFacts);
    const haystack = this.buildHaystack(input, matter, addendum);
    const ctx: ResolverContext = { haystack, parties: matter.parties ?? [], input, addendum };
    const rules = this.rulesForKind(input.documentKind);

    const missing: MissingInput[] = [];
    for (const rule of rules) {
      if (!rule.isPresent(ctx)) {
        missing.push({
          field: rule.field,
          description: rule.description,
          blocking: rule.blocking,
        });
      }
    }
    return missing;
  }

  private buildHaystack(
    input: NormalizeInput,
    matter: Pick<NormalizedMatter, 'parties' | 'facts' | 'dates'>,
    addendum: Record<string, string>,
  ): string {
    const parts = [
      input.rawFacts,
      input.clientName ?? '',
      input.opposingParty ?? '',
      input.courtName ?? '',
      input.attachmentContext ?? '',
      ...Object.entries(addendum).map(([k, v]) => `${k} ${v}`),
      ...(matter.parties ?? []).map((p) => `${p.role} ${p.name} ${p.description ?? ''}`),
      ...(matter.facts ?? []).map((f) => f.statement),
      ...(matter.dates ?? []).map((d) => `${d.label} ${d.date}`),
    ];
    return parts.join(' ').toLowerCase();
  }

  private rulesForKind(documentKind: string): FieldRule[] {
    const kind = documentKind.toLowerCase();
    return [
      ...this.partyRules(kind),
      ...this.bailRules(kind),
      ...this.orderChallengeRules(kind),
    ];
  }

  private partyRules(kind: string): FieldRule[] {
    const isBail = /bail/i.test(kind);
    const needsRespondent = !/^notice|^letter|^affidavit|^declaration/i.test(kind) && !isBail;
    return [
      {
        field: 'petitioner_name',
        description: 'Petitioner/accused name not specified',
        blocking: true,
        isPresent: ({ haystack, parties, addendum }) =>
          Boolean(addendumValue(addendum, 'petitioner_accused_name', 'accused_name', 'petitioner_name', 'applicant_name')) ||
          this.hasPetitionerParty(parties) ||
          /(?:petitioner|applicant|accused|plaintiff|appellant|complainant)\s*(?:name|:)/i.test(haystack) ||
          /(?:Mrs?|Ms|Mr|Shri|Smt|Dr)\.?\s+[A-Z]/i.test(haystack),
      },
      ...(needsRespondent
        ? [
            {
              field: 'respondent_name',
              description: 'Respondent/State name not specified',
              blocking: true,
              isPresent: ({ haystack, parties, addendum, input }: ResolverContext) =>
                Boolean(addendumValue(addendum, 'respondent_name', 'respondent_state_name', 'state_name')) ||
                this.hasRespondentParty(parties) ||
                Boolean(input.opposingParty?.trim()) ||
                /(?:respondent|defendant|state of|opposite party|complainant)\s*(?:name|:)/i.test(haystack) ||
                /state of [a-z]/i.test(haystack),
            } satisfies FieldRule,
          ]
        : []),
    ];
  }

  private bailRules(kind: string): FieldRule[] {
    if (!/bail/i.test(kind)) return [];

    const anticipatory = /anticipatory/i.test(kind);
    const rules: FieldRule[] = [
      {
        field: 'fir_reference',
        description: 'FIR number not specified',
        blocking: true,
        isPresent: ({ haystack, addendum }) =>
          Boolean(addendumValue(addendum, 'fir_number', 'fir_no', 'fir_reference')) ||
          /\bfir\b|first information report|crime no|cr\.?\s*no|police complaint|chargesheet|charge sheet/i.test(
            haystack,
          ) && /\d{2,}/.test(haystack),
      },
      {
        field: 'sections_charged',
        description: 'Sections charged not specified',
        blocking: true,
        isPresent: ({ haystack, addendum }) =>
          Boolean(addendumValue(addendum, 'sections', 'sections_charged')) ||
          /section\s*\d|sec\.?\s*\d|\bbns\b|\bipc\b|\bbnss\b|\bundps\b|\bpocso\b|u\/s\s*\d|under\s*section/i.test(
            haystack,
          ),
      },
      {
        field: 'police_station',
        description: 'Police station not specified',
        blocking: true,
        isPresent: ({ haystack, addendum }) =>
          Boolean(addendumValue(addendum, 'police_station', 'ps_name')) ||
          /police station|p\.?\s*s\.?|ps\.?\s+[a-z]|station house officer|\bsho\b/i.test(haystack),
      },
    ];

    if (!anticipatory) {
      rules.push({
        field: 'arrest_date',
        description: 'Date of arrest not specified',
        blocking: true,
        isPresent: ({ haystack, addendum }) =>
          Boolean(addendumValue(addendum, 'arrest_date', 'date_of_arrest')) ||
          this.hasExplicitDate(haystack) ||
          /arrest(?:ed| date)?|taken into custody|in judicial custody|remanded|detained on|book(?:ed)? under/i.test(
            haystack,
          ),
      });
    }

    rules.push({
      field: 'case_facts',
      description: 'Brief facts of the case not specified',
      blocking: true,
      isPresent: ({ input }) => {
        const stripped = input.rawFacts.replace(/\n\nAdditional information provided:[\s\S]*/gi, '').trim();
        return stripped.length >= 40;
      },
    });

    return rules;
  }

  private orderChallengeRules(kind: string): FieldRule[] {
    const needsOrder =
      /revision|appeal|review|set aside|impugned|maintenance_order|interim_order/i.test(kind);
    if (!needsOrder) return [];

    return [
      {
        field: 'order_date',
        description: 'Order date not specified',
        blocking: true,
        isPresent: ({ haystack, addendum }) =>
          Boolean(addendumValue(addendum, 'order_date', 'impugned_order_date')) ||
          this.hasExplicitDate(haystack) ||
          /order dated|impugned order|interim order|maintenance order dated|dated\s+\d{1,2}/i.test(haystack),
      },
    ];
  }

  private hasPetitionerParty(parties: PartyRef[]): boolean {
    const roles = new Set(['petitioner', 'plaintiff', 'appellant', 'applicant', 'accused', 'complainant']);
    return parties.some((p) => roles.has(p.role.toLowerCase().replace(/\s+/g, '_')) && p.name.trim());
  }

  private hasRespondentParty(parties: PartyRef[]): boolean {
    const roles = new Set(['respondent', 'defendant', 'other']);
    return parties.some((p) => roles.has(p.role.toLowerCase().replace(/\s+/g, '_')) && p.name.trim());
  }

  private hasExplicitDate(haystack: string): boolean {
    return (
      /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(haystack) ||
      /\d{4}-\d{2}-\d{2}/.test(haystack) ||
      /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/i.test(haystack)
    );
  }
}
