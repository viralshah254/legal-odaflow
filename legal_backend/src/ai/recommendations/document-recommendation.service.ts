import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  DocumentRecommendation,
  DocumentRecommendationCategory,
} from './document-recommendation.types';

export interface DocumentRecommendationInput {
  tenantId: string;
  userId: string;
  matterId?: string;
  countryCode: string;
  documentKind?: string;
  rawFacts?: string;
  researchJobId?: string;
  contextRevision?: number;
}

const POLICY_VERSION = 'doc-rec-v1';

@Injectable()
export class DocumentRecommendationService {
  async recommend(input: DocumentRecommendationInput): Promise<DocumentRecommendation[]> {
    const facts = (input.rawFacts ?? '').toLowerCase();
    const contextRevision = input.contextRevision ?? 1;
    const jurisdiction = input.countryCode.toUpperCase();
    const candidates: DocumentRecommendation[] = [];

    const push = (
      category: DocumentRecommendationCategory,
      partial: Omit<DocumentRecommendation, 'id' | 'category' | 'contextRevision' | 'policyVersion' | 'jurisdiction'>,
    ) => {
      candidates.push({
        id: randomUUID(),
        category,
        jurisdiction,
        contextRevision,
        policyVersion: POLICY_VERSION,
        ...partial,
      });
    };

    if (/bail|anticipatory|custody|liberty/i.test(facts)) {
      // Select catalog ID based on jurisdiction
      const bailCatalogId =
        jurisdiction === 'KE'
          ? 'kenya_bail_application'
          : 'india_regular_bail_bnss_480';
      const bailTitle =
        jurisdiction === 'KE'
          ? 'Bail application (Kenya Criminal Procedure Code)'
          : 'Regular bail application (BNSS)';

      push('work_product', {
        catalogId: bailCatalogId,
        title: bailTitle,
        action: 'draft',
        reason: 'Facts reference liberty / custody — bail application is the primary work product.',
        factIds: [],
        authorityEvidenceIds: [],
        prerequisites: [{ id: 'fir_or_charges', state: facts.includes('fir') || facts.includes('charge') ? 'mentioned' : 'missing' }],
        priority: 'next',
        // Heuristic-only: proposed, not validated.  Validation requires LLM + evidence (C10/B07 fix).
        status: 'proposed',
        questions: [],
      });
    }

    if (/consumer|deficiency|insurance|repudiat|medical|negligence/i.test(facts)) {
      const consumerCatalogId =
        jurisdiction === 'KE'
          ? 'kenya_consumer_complaint'
          : 'india_consumer_complaint';
      const consumerTitle =
        jurisdiction === 'KE'
          ? 'Consumer complaint (Kenya Consumer Protection Act)'
          : 'Consumer complaint (Consumer Protection Act)';

      push('work_product', {
        catalogId: consumerCatalogId,
        title: consumerTitle,
        action: 'draft',
        reason: 'Consumer / deficiency pattern — CPA complaint is appropriate.',
        factIds: [],
        authorityEvidenceIds: [],
        prerequisites: [
          {
            id: 'supporting_invoice_or_policy',
            state: /invoice|policy|receipt|uploaded/i.test(facts) ? 'mentioned' : 'missing',
          },
        ],
        priority: 'next',
        // Heuristic-only: proposed, not validated (C10/B07 fix).
        status: 'proposed',
        questions: [],
      });
      push('matter_evidence', {
        title: 'Contract, invoice, or policy document',
        action: 'collect',
        reason: 'Consumer disputes require documentary proof of transaction or service.',
        factIds: [],
        authorityEvidenceIds: [],
        prerequisites: [{ id: 'transaction_record', state: 'missing' }],
        priority: 'next',
        status: 'needs_clarification',
        questions: ['Do you have a signed agreement, invoice, or policy schedule?'],
      });
    }

    if (/specific performance|agreement to sell|immovable|property/i.test(facts)) {
      const spCatalogId =
        jurisdiction === 'KE'
          ? 'kenya_specific_performance'
          : 'india_specific_performance';
      push('work_product', {
        catalogId: spCatalogId,
        title: 'Specific performance suit',
        action: 'draft',
        reason: 'Property / agreement facts align with specific performance.',
        factIds: [],
        authorityEvidenceIds: [],
        prerequisites: [
          {
            id: 'registered_agreement',
            state: /registered|sale deed|agreement/i.test(facts) ? 'mentioned' : 'missing',
          },
        ],
        priority: 'next',
        // Heuristic-only (C10/B07 fix)
        status: 'proposed',
        questions: [],
      });
      push('legal_authority', {
        catalogId: 'specific_performance_law',
        title: 'Research readiness and willingness / SP discretion',
        action: 'research',
        reason: 'Specific performance requires controlling precedent on discretion and hardship.',
        factIds: [],
        authorityEvidenceIds: [],
        prerequisites: [],
        priority: 'supporting',
        status: 'proposed',
        questions: [],
      });
    }

    if (candidates.length === 0 && input.documentKind) {
      push('work_product', {
        catalogId: input.documentKind,
        title: input.documentKind.replace(/_/g, ' '),
        action: 'draft',
        reason: 'Continue with the selected document profile.',
        factIds: [],
        authorityEvidenceIds: [],
        prerequisites: [],
        priority: 'next',
        status: 'proposed',
        questions: [],
      });
    }

    return this.validateCatalog(candidates, jurisdiction);
  }

  private validateCatalog(
    items: DocumentRecommendation[],
    jurisdiction: string,
  ): DocumentRecommendation[] {
    const allowedPrefixes =
      jurisdiction === 'KE'
        ? ['kenya_', 'ke_']
        : jurisdiction === 'IN'
          ? ['india_']
          : ['india_', 'us_', 'kenya_'];

    return items.map((item) => {
      if (!item.catalogId) return item;
      const ok = allowedPrefixes.some((p) => item.catalogId!.startsWith(p));
      if (!ok) {
        return {
          ...item,
          status: 'unsupported' as const,
          questions: [...item.questions, 'Selected catalog item is not valid for this jurisdiction.'],
        };
      }
      if (item.prerequisites.some((p) => p.state === 'missing') && item.action === 'draft') {
        return { ...item, status: 'needs_clarification' as const };
      }
      return item;
    });
  }
}
