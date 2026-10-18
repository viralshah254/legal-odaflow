import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface DocumentRecommendationInput {
  tenantId: string;
  userId: string;
  matterId?: string;
  countryCode: string;
  documentKind?: string;
  rawFacts?: string;
  researchJobId?: string;
}

export interface DocumentRecommendation {
  id: string;
  documentKind: string;
  title: string;
  rationale: string;
  confidence: number;
  validated: boolean;
}

@Injectable()
export class DocumentRecommendationService {
  async recommend(input: DocumentRecommendationInput): Promise<DocumentRecommendation[]> {
    const facts = (input.rawFacts ?? '').toLowerCase();
    const candidates: DocumentRecommendation[] = [];

    if (/bail|anticipatory|custody/i.test(facts)) {
      candidates.push({
        id: randomUUID(),
        documentKind: 'india_regular_bail_bnss_480',
        title: 'Regular bail application (BNSS)',
        rationale: 'Facts mention liberty / bail — standard bail application is appropriate.',
        confidence: 0.82,
        validated: true,
      });
    }
    if (/consumer|deficiency|insurance|medical/i.test(facts)) {
      candidates.push({
        id: randomUUID(),
        documentKind: 'india_consumer_complaint',
        title: 'Consumer complaint',
        rationale: 'Consumer / deficiency facts suggest a CPA complaint.',
        confidence: 0.78,
        validated: true,
      });
    }
    if (/specific performance|agreement to sell|immovable/i.test(facts)) {
      candidates.push({
        id: randomUUID(),
        documentKind: 'india_specific_performance',
        title: 'Specific performance suit',
        rationale: 'Property / agreement facts align with specific performance relief.',
        confidence: 0.76,
        validated: true,
      });
    }

    if (candidates.length === 0 && input.documentKind) {
      candidates.push({
        id: randomUUID(),
        documentKind: input.documentKind,
        title: input.documentKind.replace(/_/g, ' '),
        rationale: 'Continue with the selected document profile.',
        confidence: 0.55,
        validated: true,
      });
    }

    return candidates;
  }
}
