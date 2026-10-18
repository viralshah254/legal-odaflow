import { BadRequestException, Injectable } from '@nestjs/common';
import { extractNamedStatuteLabels } from './named-statute-extract';
import type {
  NormalizedResearchRequest,
  NormalizeResearchRequestInput,
} from './research-planning.types';

const COUNTRY_ALIASES: Record<string, string> = {
  INDIA: 'IN',
  IN: 'IN',
  USA: 'US',
  'UNITED STATES': 'US',
  US: 'US',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  GB: 'GB',
  KENYA: 'KE',
  KE: 'KE',
};

function clean(value?: string): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

@Injectable()
export class ResearchRequestNormalizerService {
  normalize(input: NormalizeResearchRequestInput): NormalizedResearchRequest {
    const objective = clean(input.query);
    if (!objective) throw new BadRequestException('Research query is required');

    const countryInput = clean(input.countryCode)?.toUpperCase();
    const countryCode = countryInput ? (COUNTRY_ALIASES[countryInput] ?? countryInput) : undefined;
    const asOfDate = this.normalizeDate(input.asOfDate);
    const eventDate = input.eventDate ? this.normalizeDate(input.eventDate) : undefined;

    return {
      objective,
      facts: clean(input.facts),
      countryCode,
      jurisdiction: clean(input.jurisdiction),
      practiceArea: clean(input.practiceArea),
      proceduralPosture: clean(input.proceduralPosture),
      courtLevel: clean(input.courtLevel),
      asOfDate,
      eventDate,
      desiredOutput: input.desiredOutput ?? (input.facts ? 'MEMO' : 'ANSWER'),
      requestedTaskKind: input.requestedTaskKind,
      requestedSources: unique(input.requestedSources ?? []),
      citedAuthorities: this.extractCitations(objective),
      statuteReferences: this.extractStatutes(objective),
      raw: Object.freeze({ ...input }),
    };
  }

  private normalizeDate(value?: string): string {
    if (!value) return new Date().toISOString().slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('asOfDate must be a valid date');
    return date.toISOString().slice(0, 10);
  }

  private extractCitations(query: string): string[] {
    const matches = query.match(
      /\b(?:AIR\s+\d{4}\s+[A-Z]{2,}\s+\d+|\(\d{4}\)\s+\d+\s+SCC\s+\d+|\[\d{4}\]\s+[A-Z]{2,}\s+\d+|\d{4}\s+SCC\s+OnLine\s+[A-Z]{2,}\s+\d+)\b/gi,
    );
    return unique(matches ?? []);
  }

  private extractStatutes(query: string): string[] {
    const named = extractNamedStatuteLabels(query);
    if (named.length > 0) return named;
    const matches = query.match(
      /\b(?:section|article|rule|regulation|order)\s+\d+[A-Za-z]?(?:\(\d+\))?(?:\s+of\s+(?:the\s+)?[A-Z][A-Za-z\s.-]+?(?:Act|Code|Rules|Regulations))?/gi,
    );
    return unique(matches ?? []);
  }
}
