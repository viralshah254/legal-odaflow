import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { LegalRequestContext, ResearchMode, ResearchPlan } from './research.types';

@Injectable()
export class ResearchPlanService {
  buildPlan(
    objective: string,
    jurisdiction: string,
    mode: ResearchMode,
    context: LegalRequestContext,
    options?: { region?: string; court?: string; asOfDate?: string },
  ): ResearchPlan {
    const subQuestions = this.decomposeObjective(objective, mode, context);
    const sourceRequirements = this.identifySourceRequirements(mode, jurisdiction);
    const outputFormat = this.resolveOutputFormat(mode);
    const freshnessRequirement = options?.asOfDate ? 'as_of_date' : 'current';

    return {
      id: uuidv4(),
      objective,
      jurisdiction: {
        country: jurisdiction,
        region: options?.region,
        court: options?.court,
      },
      subQuestions,
      sourceRequirements,
      freshnessRequirement,
      asOfDate: options?.asOfDate,
      outputFormat,
    };
  }

  private decomposeObjective(
    objective: string,
    mode: ResearchMode,
    context: LegalRequestContext,
  ): string[] {
    const base: string[] = [`What is the legal position on: ${objective}?`];

    if (mode === 'quick') {
      return [...base, `What are the key applicable statutes or cases?`];
    }

    if (mode === 'deep') {
      return [
        ...base,
        `What statutory provisions directly govern this issue?`,
        `What leading cases have interpreted this area of law?`,
        `Are there any conflicting authorities or circuit splits?`,
        `What are the procedural requirements or limitations?`,
      ];
    }

    if (mode === 'matter_aware' && context.matterId) {
      return [
        ...base,
        `How does this apply to the specific facts of matter ${context.matterId}?`,
        `What defences or counter-arguments exist?`,
        `What remedies are available on these facts?`,
      ];
    }

    if (mode === 'update') {
      return [
        `What recent changes have occurred in: ${objective}?`,
        `Which prior authorities have been overruled or distinguished recently?`,
      ];
    }

    return base;
  }

  private identifySourceRequirements(mode: ResearchMode, jurisdiction: string): string[] {
    const common = ['official_statute', 'case_law'];

    if (mode === 'quick') return common;

    if (mode === 'deep') {
      return [...common, 'court_rules', 'secondary', 'forms'];
    }

    if (mode === 'matter_aware') {
      return [...common, 'firm_knowledge', 'matter_documents'];
    }

    if (mode === 'update') {
      return [...common, 'court_rules'];
    }

    return common;
  }

  private resolveOutputFormat(mode: ResearchMode): ResearchPlan['outputFormat'] {
    switch (mode) {
      case 'quick':
        return 'summary';
      case 'deep':
        return 'memo';
      case 'matter_aware':
        return 'brief';
      case 'update':
        return 'answer';
      default:
        return 'summary';
    }
  }
}
