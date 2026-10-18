import { Injectable } from '@nestjs/common';
import { FactLedgerService } from './fact-ledger.service';
import type {
  ApplicationNode,
  FactLedgerRecord,
  GraphValidationIssue,
  PropositionGraph,
  PropositionNode,
} from './high-confidence-research.types';

@Injectable()
export class PropositionGraphValidatorService {
  constructor(private readonly factLedger: FactLedgerService) {}

  validate(graph: PropositionGraph): GraphValidationIssue[] {
    const issues: GraphValidationIssue[] = [];
    const nodes = new Map<string, PropositionNode>();

    for (const node of graph.nodes) {
      if (nodes.has(node.nodeId)) {
        issues.push({
          code: 'DUPLICATE_NODE',
          nodeId: node.nodeId,
          message: `Proposition node ${node.nodeId} is duplicated`,
          blocking: true,
        });
        continue;
      }
      nodes.set(node.nodeId, node);
      if (
        node.tenantId !== graph.tenantId ||
        node.matterId !== graph.matterId
      ) {
        issues.push({
          code: 'SCOPE_MISMATCH',
          nodeId: node.nodeId,
          message: `Node ${node.nodeId} is outside the graph tenant or matter`,
          blocking: true,
        });
      }
    }

    for (const edge of graph.edges) {
      if (!nodes.has(edge.fromNodeId) || !nodes.has(edge.toNodeId)) {
        issues.push({
          code: 'DANGLING_EDGE',
          nodeId: edge.fromNodeId,
          dependencyNodeId: edge.toNodeId,
          message: `Edge ${edge.edgeId} refers to a missing proposition node`,
          blocking: true,
        });
      }
    }

    issues.push(...this.detectCycles(graph, nodes));
    issues.push(...this.validateCurrentLaw(nodes));
    issues.push(...this.validateApplications(graph, nodes));
    issues.push(...this.validateDispositiveFacts(graph, nodes));
    issues.push(...this.validateConflicts(graph, nodes));
    return issues;
  }

  private validateApplications(
    graph: PropositionGraph,
    nodes: Map<string, PropositionNode>,
  ): GraphValidationIssue[] {
    return graph.nodes
      .filter((node): node is ApplicationNode => node.kind === 'APPLICATION')
      .flatMap((application) => {
        const dependencies = graph.edges
          .filter(
            (edge) =>
              edge.kind === 'DEPENDS_ON' &&
              edge.fromNodeId === application.nodeId,
          )
          .map((edge) => nodes.get(edge.toNodeId))
          .filter((node): node is PropositionNode => Boolean(node));
        const legalDependencies = dependencies.filter(
          (node) => node.kind === 'LEGAL_RULE',
        );
        const factualDependencies = dependencies.filter(
          (node) => node.kind === 'FACT',
        );
        const issues: GraphValidationIssue[] = [];

        if (legalDependencies.length === 0) {
          issues.push({
            code: 'APPLICATION_MISSING_LEGAL_DEPENDENCY',
            nodeId: application.nodeId,
            message: `Application ${application.nodeId} has no legal-rule dependency`,
            blocking: true,
          });
        }
        if (factualDependencies.length === 0) {
          issues.push({
            code: 'APPLICATION_MISSING_FACTUAL_DEPENDENCY',
            nodeId: application.nodeId,
            message: `Application ${application.nodeId} has no factual dependency`,
            blocking: true,
          });
        }

        for (const legal of legalDependencies) {
          if (
            legal.kind === 'LEGAL_RULE' &&
            (legal.qualifiers.currentLawStatus !== 'CURRENT' ||
              legal.confidence.level !== 'VERIFIED')
          ) {
            issues.push({
              code: 'APPLICATION_UNVERIFIED_LEGAL_DEPENDENCY',
              nodeId: application.nodeId,
              dependencyNodeId: legal.nodeId,
              message: `Legal dependency ${legal.nodeId} is not verified current law`,
              blocking: true,
            });
          }
        }

        for (const fact of factualDependencies) {
          if (fact.kind !== 'FACT') {
            continue;
          }
          const record = this.factLedger.getRecord(graph, fact.factId);
          if (!record || record.status !== 'VERIFIED') {
            issues.push({
              code: 'APPLICATION_UNVERIFIED_FACTUAL_DEPENDENCY',
              nodeId: application.nodeId,
              dependencyNodeId: fact.nodeId,
              message: `Factual dependency ${fact.nodeId} is not verified`,
              blocking: true,
            });
          }
        }
        return issues;
      });
  }

  private validateCurrentLaw(
    nodes: Map<string, PropositionNode>,
  ): GraphValidationIssue[] {
    const issues: GraphValidationIssue[] = [];
    for (const node of nodes.values()) {
      if (
        node.kind === 'LEGAL_RULE' &&
        node.qualifiers.currentLawStatus === 'UNKNOWN'
      ) {
        issues.push({
          code: 'CURRENT_LAW_UNKNOWN',
          nodeId: node.nodeId,
          message: `Current-law status is unknown for legal rule ${node.nodeId}`,
          blocking: node.materiality !== 'CONTEXT',
        });
      }
    }
    return issues;
  }

  private validateDispositiveFacts(
    graph: PropositionGraph,
    nodes: Map<string, PropositionNode>,
  ): GraphValidationIssue[] {
    const representedFactIds = new Set(
      [...nodes.values()]
        .filter((node) => node.kind === 'FACT')
        .map((node) => (node.kind === 'FACT' ? node.factId : '')),
    );
    const records = this.factLedger.listRecords(graph);
    const issues: GraphValidationIssue[] = [];

    for (const record of records.filter(
      (item) => item.materiality === 'DISPOSITIVE',
    )) {
      if (
        record.status !== 'VERIFIED' ||
        !representedFactIds.has(record.factId)
      ) {
        issues.push(this.missingDispositiveFact(record));
      }
    }

    for (const node of nodes.values()) {
      if (node.kind !== 'FACT' || node.materiality !== 'DISPOSITIVE') {
        continue;
      }
      const record = this.factLedger.getRecord(graph, node.factId);
      if (!record && !issues.some((issue) => issue.nodeId === node.nodeId)) {
        issues.push({
          code: 'MISSING_DISPOSITIVE_FACT',
          nodeId: node.nodeId,
          message: `Dispositive fact ${node.factId} is absent from the fact ledger`,
          blocking: true,
        });
      }
    }
    return issues;
  }

  private missingDispositiveFact(
    record: FactLedgerRecord,
  ): GraphValidationIssue {
    return {
      code: 'MISSING_DISPOSITIVE_FACT',
      nodeId: record.factId,
      message: `Dispositive fact ${record.factId} is not verified and represented`,
      blocking: true,
    };
  }

  private validateConflicts(
    graph: PropositionGraph,
    nodes: Map<string, PropositionNode>,
  ): GraphValidationIssue[] {
    return graph.edges
      .filter((edge) => edge.kind === 'CONFLICTS_WITH')
      .flatMap((edge) => {
        const from = nodes.get(edge.fromNodeId);
        const to = nodes.get(edge.toNodeId);
        if (!from || !to) {
          return [];
        }
        const materialities = [from.materiality, to.materiality];
        if (materialities.every((value) => value === 'CONTEXT')) {
          return [];
        }
        return [
          {
            code: 'MATERIAL_CONFLICT' as const,
            nodeId: edge.fromNodeId,
            dependencyNodeId: edge.toNodeId,
            message: `Material propositions ${edge.fromNodeId} and ${edge.toNodeId} conflict`,
            blocking: materialities.includes('DISPOSITIVE'),
          },
        ];
      });
  }

  private detectCycles(
    graph: PropositionGraph,
    nodes: Map<string, PropositionNode>,
  ): GraphValidationIssue[] {
    const adjacency = new Map<string, string[]>();
    for (const nodeId of nodes.keys()) {
      adjacency.set(nodeId, []);
    }
    for (const edge of graph.edges) {
      if (
        edge.kind === 'DEPENDS_ON' &&
        nodes.has(edge.fromNodeId) &&
        nodes.has(edge.toNodeId)
      ) {
        adjacency.get(edge.fromNodeId)?.push(edge.toNodeId);
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const cycleNodes = new Set<string>();
    const visit = (nodeId: string, path: string[]): void => {
      if (visiting.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        path.slice(cycleStart).forEach((id) => cycleNodes.add(id));
        return;
      }
      if (visited.has(nodeId)) {
        return;
      }
      visiting.add(nodeId);
      for (const dependency of adjacency.get(nodeId) ?? []) {
        visit(dependency, [...path, nodeId]);
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    for (const nodeId of nodes.keys()) {
      visit(nodeId, []);
    }

    return [...cycleNodes].map((nodeId) => ({
      code: 'CIRCULAR_DEPENDENCY',
      nodeId,
      message: `Proposition ${nodeId} participates in a circular dependency`,
      blocking: true,
    }));
  }
}
