import { Injectable } from '@nestjs/common';
import { matchRoutingRule } from './matter-taxonomy-routing';
import type { MatterProfile, MatterTaskGraph } from './matter-intelligence.types';

export interface RecommendedAction {
  id: string;
  label: string;
  priority: number;
  documentKind?: string;
  curatedKind?: string;
}

@Injectable()
export class ActionRecommendationService {
  recommend(profile: MatterProfile, taskGraph?: MatterTaskGraph): RecommendedAction[] {
    const rule = matchRoutingRule('', profile.nature);
    const baseActions =
      taskGraph?.recommendedActions ??
      (rule && rule.practiceArea === profile.practiceArea
        ? rule.recommendedActions
        : this.defaultActions(profile));

    const actions: RecommendedAction[] = baseActions.map((label, index) => ({
      id: `action_${index}`,
      label,
      priority: index + 1,
    }));

    if (profile.documentKind) {
      actions.push({
        id: 'primary_document',
        label: `Prepare ${profile.documentKind.replace(/_/g, ' ')}`,
        priority: 0,
        documentKind: profile.documentKind,
        curatedKind: profile.curatedKinds[0],
      });
    }

    for (const kind of profile.curatedKinds.slice(0, 2)) {
      if (!actions.some((a) => a.curatedKind === kind)) {
        actions.push({
          id: `curated_${kind}`,
          label: `Draft ${kind.replace(/^india_|^us_/, '').replace(/_/g, ' ')}`,
          priority: actions.length + 1,
          curatedKind: kind,
        });
      }
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  private defaultActions(profile: MatterProfile): string[] {
    if (profile.nature === 'transaction') {
      return ['Gather party details', 'Draft document', 'Review and finalize'];
    }
    if (profile.nature === 'advisory') {
      return ['Analyze facts', 'Research applicable law', 'Prepare legal opinion'];
    }
    return [
      'Review case facts and documents',
      'Identify legal issues and forum',
      'Prepare required pleadings or notices',
    ];
  }
}
