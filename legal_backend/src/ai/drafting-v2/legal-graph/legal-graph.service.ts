/**
 * Stage 3 — Legal Knowledge Graph
 *
 * Maintains a reusable issue → statute → section → ingredient → exception →
 * case → procedure → evidence → form/template graph.
 *
 * Generation never asks "what law applies?" — it receives verified law from
 * this graph. The planner and outline builder query the graph; the generator
 * consumes verified law from it.
 *
 * Current implementation: in-memory graph over the static issue taxonomy,
 * backed by `LegalAuthority` and `StatuteSectionProfile` DB records.
 *
 * Future: graph edges will be persisted as first-class records, and the
 * graph will grow through retrieval write-through (LegalGraphEdge table).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { LegalGraph, LegalGraphNode, LegalGraphEdge } from '../drafting-v2.types';

// ─── Static graph seed — India common disputes ──────────────────────────────

const STATIC_GRAPH_SEEDS: Record<
  string,
  {
    nodes: Omit<LegalGraphNode, 'id'>[];
    edges: Array<{ fromLabel: string; toLabel: string; relation: LegalGraphEdge['relation'] }>;
  }
> = {
  'maintenance-revision': {
    nodes: [
      { type: 'issue', label: 'Excessive interim maintenance under BNSS §144', jurisdiction: 'IN' },
      { type: 'statute', label: 'BNSS 2023', jurisdiction: 'IN', countryCode: 'IN' },
      { type: 'section', label: 'BNSS §144 — Maintenance', jurisdiction: 'IN' },
      { type: 'section', label: 'BNSS §438 — Revision', jurisdiction: 'IN' },
      { type: 'ingredient', label: 'Income and financial capacity of respondent' },
      { type: 'ingredient', label: 'Needs of applicant and children' },
      { type: 'ingredient', label: 'Standard of living before separation' },
      { type: 'ingredient', label: 'Proportionality of quantum' },
      { type: 'exception', label: 'Condonation of delay under BNSS §479' },
      { type: 'case', label: 'Rajnesh v Neha (2020 SC)', jurisdiction: 'IN' },
      { type: 'case', label: 'Kalyan Dey Chowdhury (2017 SC)', jurisdiction: 'IN' },
      { type: 'procedure', label: 'File in High Court of state where trial court is situated', jurisdiction: 'IN' },
      { type: 'evidence', label: 'Income affidavit' },
      { type: 'evidence', label: 'Salary slips' },
      { type: 'evidence', label: 'Impugned maintenance order' },
    ],
    edges: [
      { fromLabel: 'Excessive interim maintenance under BNSS §144', toLabel: 'BNSS 2023', relation: 'governs' },
      { fromLabel: 'BNSS 2023', toLabel: 'BNSS §144 — Maintenance', relation: 'governs' },
      { fromLabel: 'BNSS 2023', toLabel: 'BNSS §438 — Revision', relation: 'governs' },
      { fromLabel: 'BNSS §144 — Maintenance', toLabel: 'Income and financial capacity of respondent', relation: 'requires' },
      { fromLabel: 'BNSS §144 — Maintenance', toLabel: 'Needs of applicant and children', relation: 'requires' },
      { fromLabel: 'BNSS §144 — Maintenance', toLabel: 'Proportionality of quantum', relation: 'requires' },
      { fromLabel: 'BNSS §438 — Revision', toLabel: 'Condonation of delay under BNSS §479', relation: 'excepts' },
      { fromLabel: 'BNSS §144 — Maintenance', toLabel: 'Rajnesh v Neha (2020 SC)', relation: 'cites' },
      { fromLabel: 'BNSS §144 — Maintenance', toLabel: 'Kalyan Dey Chowdhury (2017 SC)', relation: 'cites' },
      { fromLabel: 'BNSS §438 — Revision', toLabel: 'File in High Court of state where trial court is situated', relation: 'procedural_step' },
      { fromLabel: 'Income and financial capacity of respondent', toLabel: 'Income affidavit', relation: 'requires' },
      { fromLabel: 'Income and financial capacity of respondent', toLabel: 'Salary slips', relation: 'requires' },
    ],
  },
  'bail': {
    nodes: [
      { type: 'issue', label: 'Entitlement to bail under BNSS §480/§483', jurisdiction: 'IN' },
      { type: 'statute', label: 'BNSS 2023', jurisdiction: 'IN', countryCode: 'IN' },
      { type: 'section', label: 'BNSS §480 — Bail by Magistrate', jurisdiction: 'IN' },
      { type: 'section', label: 'BNSS §483 — Bail by Sessions/HC', jurisdiction: 'IN' },
      { type: 'ingredient', label: 'Nature and gravity of accusation' },
      { type: 'ingredient', label: 'Antecedents of accused' },
      { type: 'ingredient', label: 'Risk of fleeing justice' },
      { type: 'ingredient', label: 'Risk of tampering with evidence' },
      { type: 'case', label: 'Sanjay Chandra v CBI (2012 SC)', jurisdiction: 'IN' },
      { type: 'case', label: 'Dataram Singh v State of UP (2018 SC)', jurisdiction: 'IN' },
      { type: 'evidence', label: 'FIR copy' },
      { type: 'evidence', label: 'Arrest memo' },
    ],
    edges: [
      { fromLabel: 'Entitlement to bail under BNSS §480/§483', toLabel: 'BNSS §480 — Bail by Magistrate', relation: 'governs' },
      { fromLabel: 'BNSS §480 — Bail by Magistrate', toLabel: 'Nature and gravity of accusation', relation: 'requires' },
      { fromLabel: 'BNSS §480 — Bail by Magistrate', toLabel: 'Risk of fleeing justice', relation: 'requires' },
      { fromLabel: 'BNSS §480 — Bail by Magistrate', toLabel: 'Sanjay Chandra v CBI (2012 SC)', relation: 'cites' },
      { fromLabel: 'Entitlement to bail under BNSS §480/§483', toLabel: 'BNSS §483 — Bail by Sessions/HC', relation: 'governs' },
      { fromLabel: 'BNSS §483 — Bail by Sessions/HC', toLabel: 'Nature and gravity of accusation', relation: 'requires' },
      { fromLabel: 'BNSS §483 — Bail by Sessions/HC', toLabel: 'Risk of fleeing justice', relation: 'requires' },
      { fromLabel: 'BNSS §483 — Bail by Sessions/HC', toLabel: 'Dataram Singh v State of UP (2018 SC)', relation: 'cites' },
    ],
  },
  'cheque-dishonour': {
    nodes: [
      { type: 'issue', label: 'Dishonour of cheque — NI Act §138', jurisdiction: 'IN' },
      { type: 'statute', label: 'Negotiable Instruments Act 1881', jurisdiction: 'IN', countryCode: 'IN' },
      { type: 'section', label: 'NI Act §138 — Dishonour of cheque', jurisdiction: 'IN' },
      { type: 'section', label: 'NI Act §142 — Cognizance', jurisdiction: 'IN' },
      { type: 'ingredient', label: 'Cheque drawn on bank account for legally enforceable debt' },
      { type: 'ingredient', label: 'Cheque returned unpaid — insufficient funds or account closure' },
      { type: 'ingredient', label: 'Legal notice served within 30 days of dishonour' },
      { type: 'ingredient', label: 'Failure to pay within 15 days of notice' },
      { type: 'exception', label: 'Gift cheque / security cheque defence under §139' },
      { type: 'case', label: 'Kusum Ingots v Pennar Peterson (2000 SC)', jurisdiction: 'IN' },
      { type: 'evidence', label: 'Original cheque' },
      { type: 'evidence', label: 'Bank dishonour memo' },
      { type: 'evidence', label: 'Legal notice with postal receipt' },
    ],
    edges: [
      { fromLabel: 'NI Act §138 — Dishonour of cheque', toLabel: 'Cheque drawn on bank account for legally enforceable debt', relation: 'requires' },
      { fromLabel: 'NI Act §138 — Dishonour of cheque', toLabel: 'Legal notice served within 30 days of dishonour', relation: 'requires' },
      { fromLabel: 'NI Act §138 — Dishonour of cheque', toLabel: 'Exception — gift cheque / security cheque defence under §139', relation: 'excepts' },
      { fromLabel: 'NI Act §138 — Dishonour of cheque', toLabel: 'Kusum Ingots v Pennar Peterson (2000 SC)', relation: 'cites' },
    ],
  },
};

function mapIssueToGraphKey(documentKind: string): string | null {
  if (/maintenance.*revision|revision.*maintenance/i.test(documentKind)) return 'maintenance-revision';
  if (/bail/i.test(documentKind)) return 'bail';
  if (/cheque|ni_act|138/i.test(documentKind)) return 'cheque-dishonour';
  return null;
}

@Injectable()
export class LegalGraphService {
  private readonly logger = new Logger(LegalGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve the legal graph for a given document kind.
   * Returns static seed if DB has no graph entries yet.
   */
  async getGraph(
    documentKind: string,
    countryCode: string,
  ): Promise<LegalGraph | null> {
    const graphKey = mapIssueToGraphKey(documentKind);
    if (!graphKey) return null;

    const seed = STATIC_GRAPH_SEEDS[graphKey];
    if (!seed) return null;

    // Attempt to enrich with LegalAuthority DB records
    let dbAuthorities: Array<{ id: string; authorityType: string; title: string; citation: string | null }> = [];
    try {
      dbAuthorities = await this.prisma.legalAuthority.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          OR: seed.nodes
            .filter((n) => n.type === 'case' || n.type === 'statute')
            .map((n) => ({ title: { contains: n.label.split('(')[0].trim(), mode: 'insensitive' as const } })),
        },
        select: { id: true, authorityType: true, title: true, citation: true },
        take: 20,
      });
    } catch (err) {
      this.logger.debug(`DB enrichment skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Build nodes — assign IDs and enrich with DB authority IDs where matched
    const nodes: LegalGraphNode[] = seed.nodes.map((n, idx) => {
      const dbMatch = dbAuthorities.find(
        (a) => a.title.toLowerCase().includes(n.label.toLowerCase().split('(')[0].trim().toLowerCase()),
      );
      return {
        id: `node-${graphKey}-${idx}`,
        ...n,
        authorityId: dbMatch?.id,
      };
    });

    // Build node label → id map for edge resolution
    const labelToId = new Map<string, string>(nodes.map((n) => [n.label, n.id]));

    const edges: LegalGraphEdge[] = seed.edges
      .map((e) => ({
        from: labelToId.get(e.fromLabel) ?? '',
        to: labelToId.get(e.toLabel) ?? '',
        relation: e.relation,
      }))
      .filter((e) => e.from && e.to);

    return {
      issue: graphKey,
      nodes,
      edges,
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract the verified statutes, required ingredients, and leading cases
   * for use by the Planning Engine without a full graph traversal.
   */
  async getIssueSummary(
    documentKind: string,
    countryCode: string,
  ): Promise<{
    statutes: string[];
    ingredients: string[];
    leadingCases: string[];
    proceduralSteps: string[];
    requiredEvidence: string[];
  }> {
    const graph = await this.getGraph(documentKind, countryCode);
    if (!graph) {
      return { statutes: [], ingredients: [], leadingCases: [], proceduralSteps: [], requiredEvidence: [] };
    }

    return {
      statutes: graph.nodes.filter((n) => n.type === 'statute' || n.type === 'section').map((n) => n.label),
      ingredients: graph.nodes.filter((n) => n.type === 'ingredient').map((n) => n.label),
      leadingCases: graph.nodes.filter((n) => n.type === 'case').map((n) => n.label),
      proceduralSteps: graph.nodes.filter((n) => n.type === 'procedure').map((n) => n.label),
      requiredEvidence: graph.nodes.filter((n) => n.type === 'evidence').map((n) => n.label),
    };
  }
}
