import { Injectable } from '@nestjs/common';
import { matchRoutingRule } from './matter-taxonomy-routing';
import { getSubPracticeForProfile } from './matter-taxonomy-routing';
import { DocumentDependencyService } from './document-dependency.service';
import type {
  MatterGraph,
  MatterProfile,
  MatterTaskGraph,
} from './matter-intelligence.types';

@Injectable()
export class MatterTaskGraphService {
  constructor(private readonly documentDependency: DocumentDependencyService) {}

  build(profile: MatterProfile, graph?: MatterGraph): MatterTaskGraph {
    const rule = matchRoutingRule('', profile.nature);
    const subDef = getSubPracticeForProfile(profile.practiceArea, profile.subPracticeArea);

    const recommendedActions =
      rule && rule.practiceArea === profile.practiceArea
        ? rule.recommendedActions
        : this.defaultActions(profile);

    const requiredDocuments = this.documentDependency.getRequiredDocuments(
      profile.documentKind ?? profile.documentTypes[0],
      profile,
    );

    const presentDocs = new Set(
      (graph?.documents ?? []).map((d) => d.documentType?.toLowerCase()).filter(Boolean),
    );

    const missingDocuments = requiredDocuments.filter(
      (doc) => !this.hasDocument(doc, presentDocs, graph),
    );

    const nextBestAction =
      missingDocuments.length > 0
        ? `Obtain: ${missingDocuments[0]}`
        : recommendedActions[0];

    return {
      recommendedActions,
      requiredDocuments,
      missingDocuments,
      deadlines: [],
      nextBestAction,
    };
  }

  private defaultActions(profile: MatterProfile): string[] {
    if (profile.nature === 'transaction') {
      return ['Gather party details', 'Draft document', 'Review and finalize'];
    }
    if (profile.nature === 'advisory') {
      return ['Analyze facts', 'Research applicable law', 'Prepare legal opinion'];
    }
    if (profile.nature === 'compliance') {
      return ['Identify filing requirements', 'Prepare compliance documents', 'Submit filing'];
    }
    return [
      'Review case facts and documents',
      'Identify legal issues and forum',
      'Prepare required pleadings or notices',
    ];
  }

  private hasDocument(
    required: string,
    present: Set<string | undefined>,
    graph?: MatterGraph,
  ): boolean {
    const normalized = required.toLowerCase().replace(/\s+/g, '_');
    if (present.has(normalized)) return true;
    if (/\btermination letter\b/i.test(required) && graph?.timeline.some((t) => t.eventType === 'termination')) {
      return true;
    }
    return false;
  }
}
