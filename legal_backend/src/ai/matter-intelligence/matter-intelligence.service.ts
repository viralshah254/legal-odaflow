import { Injectable } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';
import {
  DOMAIN_SIGNALS,
  detectNature,
  scoreDomainMatch,
} from './domain-signals';
import {
  buildProfileFromRule,
  matchRoutingRule,
  getSubPracticeForProfile,
} from './matter-taxonomy-routing';
import { resolvePracticeAreaAliases } from './matter-taxonomy';
import { ConfidenceGateService } from './confidence-gate.service';
import { ALL_DOCUMENT_KINDS } from '@/config/templates/document-kinds';
import type {
  MatterClassificationResult,
  MatterIntelligenceInput,
  MatterProfile,
} from './matter-intelligence.types';

const CONFIDENCE_THRESHOLDS = {
  practiceArea: 0.8,
  subPracticeArea: 0.7,
  nature: 0.75,
  forum: 0.6,
  aggregate: 0.65,
};

const DOCUMENT_KIND_SET = new Set<string>(ALL_DOCUMENT_KINDS);

function normalizeDocumentKind(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return DOCUMENT_KIND_SET.has(normalized) ? normalized : undefined;
}

@Injectable()
export class MatterIntelligenceService {
  constructor(
    private readonly llmCompletion: LlmCompletionService,
    private readonly confidenceGate: ConfidenceGateService,
  ) {}

  async classify(input: MatterIntelligenceInput): Promise<MatterClassificationResult> {
    const facts = input.facts?.trim() ?? '';
    const country = (input.countryCode ?? 'IN').toUpperCase();

    if (!facts) {
      return this.emptyResult(country);
    }

    if (input.existingProfile && input.existingProfile.confidence >= 0.85) {
      return {
        profile: input.existingProfile,
        clarifyingQuestions: [],
        shouldProceed: true,
        recommendationMode: 'matched',
      };
    }

    const heuristic = this.classifyHeuristic(facts, country, input.jurisdiction);

    let profile = heuristic.profile;
    if (heuristic.profile.confidence < 0.7 && this.llmCompletion.isProviderConfigured('openai')) {
      try {
        const llmProfile = await this.classifyWithLlm(facts, country, input.jurisdiction);
        if (llmProfile && llmProfile.confidence > profile.confidence) {
          profile = llmProfile;
        }
      } catch {
        // keep heuristic
      }
    }

    const gate = this.confidenceGate.evaluate(profile);
    return {
      profile,
      clarifyingQuestions: gate.questions,
      shouldProceed: gate.shouldProceed,
      recommendationMode: gate.recommendationMode,
    };
  }

  classifyHeuristic(
    facts: string,
    country: string,
    jurisdiction?: string,
  ): { profile: MatterProfile } {
    const { nature, confidence: natureConf } = detectNature(facts);

    let bestArea = { slug: 'litigation_disputes', score: 0.3 };
    for (const signal of DOMAIN_SIGNALS) {
      const score = scoreDomainMatch(facts, signal);
      if (score > bestArea.score) {
        bestArea = { slug: signal.practiceArea, score };
      }
    }

    const practiceArea = resolvePracticeAreaAliases(bestArea.slug);
    const rule = matchRoutingRule(facts, nature, { preferredPracticeArea: practiceArea });

    let profile: MatterProfile;

    if (rule) {
      const partial = buildProfileFromRule(
        rule,
        country,
        jurisdiction,
        Math.min(0.97, 0.7 + bestArea.score * 0.2),
      );
      profile = this.completeProfile(partial, facts, nature, natureConf, jurisdiction);
    } else {
      const subDef = getSubPracticeForProfile(practiceArea, undefined);
      profile = {
        country,
        practiceArea,
        nature: nature === 'unknown' ? 'dispute' : nature,
        remedies: subDef?.remedies ?? [],
        issues: [],
        documentTypes: subDef?.documentTypes ?? [],
        curatedKinds: subDef?.curatedKinds ?? [],
        jurisdiction,
        confidence: Math.min(0.75, bestArea.score),
        fieldConfidence: {
          practiceArea: bestArea.score,
          subPracticeArea: 0.4,
          nature: natureConf,
          forum: 0.3,
        },
      };
    }

    profile.confidence = this.aggregateConfidence(profile);
    profile.fieldConfidence = {
      practiceArea: bestArea.score,
      subPracticeArea: profile.subPracticeArea ? 0.85 : 0.45,
      nature: natureConf,
      forum: profile.forum ? 0.75 : 0.35,
    };

    return { profile };
  }

  private completeProfile(
    partial: Partial<MatterProfile>,
    facts: string,
    nature: import('./matter-intelligence.types').MatterNature,
    natureConf: number,
    jurisdiction?: string,
  ): MatterProfile {
    const posture = this.detectPosture(facts);
    const stage = this.detectStage(facts, nature);

    return {
      country: partial.country ?? 'IN',
      practiceArea: partial.practiceArea ?? 'litigation_disputes',
      subPracticeArea: partial.subPracticeArea,
      nature: partial.nature ?? nature,
      forum: partial.forum,
      stage: partial.stage ?? stage,
      posture,
      remedies: partial.remedies ?? [],
      issues: partial.issues ?? [],
      documentTypes: partial.documentTypes ?? [],
      documentKind: partial.documentKind,
      curatedKinds: partial.curatedKinds ?? [],
      jurisdiction: partial.jurisdiction ?? jurisdiction,
      confidence: partial.confidence ?? 0.7,
      fieldConfidence: {
        practiceArea: 0.85,
        subPracticeArea: partial.subPracticeArea ? 0.88 : 0.5,
        nature: natureConf,
        forum: partial.forum ? 0.8 : 0.4,
      },
    };
  }

  private detectPosture(facts: string): MatterProfile['posture'] {
    if (/\brevision\b/i.test(facts)) return 'revision';
    if (/\bappeal\b/i.test(facts)) return 'appeal';
    if (/\bexecution\b/i.test(facts)) return 'execution';
    if (/\breview\b/i.test(facts)) return 'review';
    return 'original';
  }

  private detectStage(
    facts: string,
    nature: import('./matter-intelligence.types').MatterNature,
  ): MatterProfile['stage'] {
    if (/\bappeal\b/i.test(facts)) return 'appeal';
    if (/\b(order|judgment|decree|disposed)\b/i.test(facts) && /\b(challenge|set aside|revision)\b/i.test(facts)) {
      return 'post_order';
    }
    if (nature === 'compliance') return 'compliance';
    if (/\bfile\b|\bpetition\b|\bapplication\b/i.test(facts)) return 'filing';
    return 'pre_filing';
  }

  private aggregateConfidence(profile: MatterProfile): number {
    const fc = profile.fieldConfidence;
    if (!fc) return profile.confidence;
    return Math.min(
      0.99,
      fc.practiceArea * 0.35 +
        fc.subPracticeArea * 0.25 +
        fc.nature * 0.25 +
        fc.forum * 0.15,
    );
  }

  private async classifyWithLlm(
    facts: string,
    country: string,
    jurisdiction?: string,
  ): Promise<MatterProfile | null> {
    const prompt = `Classify this legal matter. Return JSON only:
{
  "practiceArea": "employment_labour|family_matrimonial|litigation_disputes|consumer|corporate_commercial|real_estate_property|arbitration_adr|insolvency|tax",
  "subPracticeArea": "slug",
  "nature": "dispute|transaction|compliance|advisory",
  "forum": "optional",
  "issues": ["issue1"],
  "remedies": ["remedy1"],
  "documentTypes": ["doc_type"],
  "documentKind": "canonical_document_kind_or_null",
  "confidence": 0.0-1.0
}
Country: ${country}
Jurisdiction: ${jurisdiction ?? 'unknown'}
Allowed documentKind slugs: ${ALL_DOCUMENT_KINDS.join(', ')}
Facts: ${facts.slice(0, 3000)}`;

    const response = await this.llmCompletion.complete({
      modelName: DEFAULT_AUTO_MODEL,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800,
      temperature: 0.1,
    });

    const text = response.content?.trim() ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<MatterProfile>;
      const documentKind = normalizeDocumentKind(parsed.documentKind);
      const rule = parsed.subPracticeArea
        ? matchRoutingRule(facts, (parsed.nature as MatterProfile['nature']) ?? 'dispute')
        : undefined;

      return this.completeProfile(
        {
          ...parsed,
          documentKind,
          country,
          jurisdiction,
          practiceArea: resolvePracticeAreaAliases(parsed.practiceArea ?? 'litigation_disputes'),
          curatedKinds: rule
            ? buildProfileFromRule(rule, country, jurisdiction).curatedKinds
            : [],
        },
        facts,
        (parsed.nature as MatterProfile['nature']) ?? 'unknown',
        parsed.confidence ?? 0.75,
        jurisdiction,
      );
    } catch {
      return null;
    }
  }

  private emptyResult(country: string): MatterClassificationResult {
    const profile: MatterProfile = {
      country,
      practiceArea: 'litigation_disputes',
      nature: 'unknown',
      remedies: [],
      issues: [],
      documentTypes: [],
      curatedKinds: [],
      confidence: 0,
    };
    return {
      profile,
      clarifyingQuestions: [],
      shouldProceed: false,
      recommendationMode: 'clarification_required',
    };
  }
}
