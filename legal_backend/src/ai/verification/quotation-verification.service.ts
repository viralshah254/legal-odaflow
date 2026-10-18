import { Injectable } from '@nestjs/common';
import type { LegalEvidencePack } from '@/ai/legal-research/legal-evidence-pack.service';
import type { VerificationFinding } from './verification-finding.types';

export interface QuotationCheckInput {
  propositionId: string;
  text: string;
  evidenceIds: string[];
  evidencePack: LegalEvidencePack;
}

@Injectable()
export class QuotationVerificationService {
  verify(input: QuotationCheckInput): VerificationFinding[] {
    const quotes = this.extractQuotes(input.text);
    if (quotes.length === 0) {
      return [
        {
          checkId: `quotation:${input.propositionId}:none`,
          state: 'NOT_APPLICABLE',
          severity: 'LOW',
          dimension: 'quotation',
          propositionId: input.propositionId,
          evidenceIds: input.evidenceIds,
          explanation: 'No quoted source text detected.',
          verifierVersion: 'quotation-v1',
        },
      ];
    }

    const passages = this.resolveEvidenceText(input.evidencePack, input.evidenceIds);
    return quotes.map((quote, index) => {
      const matched = passages.some((passage) => this.normalize(passage.text).includes(this.normalize(quote)));
      const hasPinpoint = passages.some((passage) => passage.paragraph || passage.page);
      if (!matched) {
        return {
          checkId: `quotation:${input.propositionId}:${index}`,
          state: 'FAIL',
          severity: 'BLOCKER',
          dimension: 'quotation',
          propositionId: input.propositionId,
          evidenceIds: input.evidenceIds,
          explanation: 'Quote does not match the linked source passage.',
          repairAction: 'RECITE',
          verifierVersion: 'quotation-v1',
        };
      }
      if (!hasPinpoint) {
        return {
          checkId: `quotation:${input.propositionId}:${index}:pinpoint`,
          state: 'INDETERMINATE',
          severity: 'HIGH',
          dimension: 'quotation',
          propositionId: input.propositionId,
          evidenceIds: input.evidenceIds,
          explanation: 'Quote matches source text, but no pinpoint paragraph/page was available.',
          repairAction: 'RECITE',
          verifierVersion: 'quotation-v1',
        };
      }
      return {
        checkId: `quotation:${input.propositionId}:${index}`,
        state: 'PASS',
        severity: 'LOW',
        dimension: 'quotation',
        propositionId: input.propositionId,
        evidenceIds: input.evidenceIds,
        explanation: 'Quote matches linked source passage.',
        verifierVersion: 'quotation-v1',
      };
    });
  }

  private extractQuotes(text: string): string[] {
    return [...text.matchAll(/"([^"]{8,})"|'([^']{8,})'|“([^”]{8,})”/g)]
      .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
      .filter(Boolean);
  }

  private resolveEvidenceText(pack: LegalEvidencePack, evidenceIds: string[]): Array<{ text: string; paragraph?: string; page?: number }> {
    const wanted = new Set(evidenceIds);
    const passages = pack.authorities.flatMap((authority) => authority.passages);
    return [
      ...pack.statutes.filter((s) => wanted.has(s.evidenceId)).map((s) => ({ text: s.text, paragraph: s.section })),
      ...passages.filter((p) => wanted.has(p.evidenceId)).map((p) => ({ text: p.text, paragraph: p.paragraph, page: p.page })),
      ...pack.officialMaterials.filter((m) => wanted.has(m.evidenceId)).map((m) => ({ text: m.text })),
    ];
  }

  private normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }
}
