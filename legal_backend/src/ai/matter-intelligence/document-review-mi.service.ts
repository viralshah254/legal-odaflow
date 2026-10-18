import { Injectable } from '@nestjs/common';
import { MatterIntelligenceService } from './matter-intelligence.service';
import { LegalResearchClassifierService } from '@/ai/legal-research/legal-research-classifier.service';
import { buildDomainChecklistBlock } from '@/ai/legal-research/domain-checklists';
import { isMiEnabled } from './mi-feature-flags';
import type { MatterProfile } from './matter-intelligence.types';

export interface DocumentReviewMiContext {
  matterProfile: MatterProfile;
  practiceChecklistBlock: string;
}

@Injectable()
export class DocumentReviewMiService {
  constructor(
    private readonly matterIntelligence: MatterIntelligenceService,
    private readonly researchClassifier: LegalResearchClassifierService,
  ) {}

  async buildReviewContext(
    extractedText: string,
    countryCode?: string,
    jurisdiction?: string,
  ): Promise<DocumentReviewMiContext | null> {
    if (!isMiEnabled('documentReview')) return null;

    // For long documents, sample start + middle + end so jurisdiction and
    // domain hints are not biased solely to the opening paragraphs.
    const sample = extractedText.length <= 4000
      ? extractedText.trim()
      : [
          extractedText.slice(0, 1500),
          extractedText.slice(Math.floor(extractedText.length / 2) - 750, Math.floor(extractedText.length / 2) + 750),
          extractedText.slice(-1500),
        ].join('\n\n').trim();

    if (sample.length < 80) return null;

    const classification = await this.matterIntelligence.classify({
      facts: sample,
      countryCode,
      jurisdiction,
    });

    const researchClass = await this.researchClassifier.classifyAsync({
      query: sample.slice(0, 500),
      facts: sample,
      countryCode,
      jurisdiction,
    });

    return {
      matterProfile: classification.profile,
      practiceChecklistBlock: buildDomainChecklistBlock(researchClass.legalDomain),
    };
  }
}
