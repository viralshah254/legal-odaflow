/**
 * TODO-077, TODO-078 — Playbook Comparison Service
 *
 * Compares extracted clauses against tenant/system playbooks to flag
 * prohibited, acceptable, or preferred language.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ContractClauseV2, ContractPlaybook } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { PlaybookComparisonResult } from './document-review.types';

@Injectable()
export class PlaybookComparisonService {
  private readonly logger = new Logger(PlaybookComparisonService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  async compare(
    clauses: ContractClauseV2[],
    tenantId: string,
    contractType: string,
  ): Promise<PlaybookComparisonResult[]> {
    const playbooks = await this.getApplicablePlaybooks(tenantId, contractType);

    if (playbooks.length === 0) {
      this.logger.debug(`No playbooks found for tenant=${tenantId} contractType=${contractType}`);
      return clauses.map((c) => ({
        clauseType: c.clauseType,
        playbookId: '',
        found: true,
        status: 'acceptable' as const,
      }));
    }

    const results: PlaybookComparisonResult[] = [];
    const checkedClauseTypes = new Set<string>();

    for (const clause of clauses) {
      checkedClauseTypes.add(clause.clauseType);

      const applicablePlaybooks = playbooks.filter(
        (p) => p.clauseType === clause.clauseType || p.clauseType === '*',
      );

      if (applicablePlaybooks.length === 0) {
        results.push({
          clauseType: clause.clauseType,
          playbookId: '',
          found: true,
          status: 'acceptable',
        });
        continue;
      }

      // Use the first applicable playbook (most specific wins)
      const playbook = applicablePlaybooks[0];
      const result = this.evaluateClauseAgainstPlaybook(clause, playbook);
      results.push(result);
    }

    // Check for missing required clause types from playbooks
    const playbookClauseTypes = new Set(playbooks.map((p) => p.clauseType));
    for (const clauseType of playbookClauseTypes) {
      if (!checkedClauseTypes.has(clauseType) && clauseType !== '*') {
        const playbook = playbooks.find((p) => p.clauseType === clauseType)!;
        results.push({
          clauseType,
          playbookId: playbook.id,
          found: false,
          status: 'missing',
          issue: `Required clause type "${clauseType}" not found in document`,
          suggestedReplacement: playbook.preferredText ?? playbook.acceptableText ?? undefined,
        });
      }
    }

    return results;
  }

  async getApplicablePlaybooks(
    tenantId: string,
    contractType: string,
  ): Promise<ContractPlaybook[]> {
    const where = contractType
      ? { active: true, contractType, OR: [{ tenantId }, { tenantId: null }] }
      : { active: true, OR: [{ tenantId }, { tenantId: null }] };

    return this.prisma.contractPlaybook.findMany({
      where,
      orderBy: [
        // Tenant-specific playbooks take precedence over system-wide
        { tenantId: 'desc' },
        { version: 'desc' },
      ],
    });
  }

  async createPlaybook(data: {
    tenantId?: string | null;
    name: string;
    contractType: string;
    clauseType: string;
    description?: string;
    preferredText?: string;
    acceptableText?: string;
    prohibitedPatterns?: string[];
    flaggedPatterns?: string[];
    negotiationGuide?: string;
    riskLevel?: string;
    jurisdiction?: string;
  }): Promise<ContractPlaybook> {
    return this.prisma.contractPlaybook.create({
      data: {
        tenantId: data.tenantId ?? null,
        name: data.name,
        contractType: data.contractType,
        clauseType: data.clauseType,
        description: data.description,
        preferredText: data.preferredText,
        acceptableText: data.acceptableText,
        prohibitedPatterns: data.prohibitedPatterns ?? [],
        flaggedPatterns: data.flaggedPatterns ?? [],
        negotiationGuide: data.negotiationGuide,
        riskLevel: data.riskLevel ?? 'medium',
        jurisdiction: data.jurisdiction,
      },
    });
  }

  async getPlaybook(id: string, tenantId: string): Promise<ContractPlaybook> {
    const playbook = await this.prisma.contractPlaybook.findFirst({
      where: { id, OR: [{ tenantId }, { tenantId: null }] },
    });
    if (!playbook) {
      throw new NotFoundException(`Contract playbook ${id} not found`);
    }
    return playbook;
  }

  async updatePlaybook(
    id: string,
    tenantId: string,
    data: Partial<{
      name: string;
      contractType: string;
      clauseType: string;
      description: string;
      preferredText: string;
      acceptableText: string;
      prohibitedPatterns: string[];
      flaggedPatterns: string[];
      negotiationGuide: string;
      riskLevel: string;
      jurisdiction: string;
      active: boolean;
    }>,
  ): Promise<ContractPlaybook> {
    const existing = await this.prisma.contractPlaybook.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Contract playbook ${id} not found for tenant`);
    }
    return this.prisma.contractPlaybook.update({
      where: { id },
      data,
    });
  }

  async deletePlaybook(id: string, tenantId: string): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.contractPlaybook.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Contract playbook ${id} not found for tenant`);
    }
    await this.prisma.contractPlaybook.update({
      where: { id },
      data: { active: false },
    });
    return { deleted: true };
  }

  // ─── Evaluation logic ─────────────────────────────────────────────────────

  private evaluateClauseAgainstPlaybook(
    clause: ContractClauseV2,
    playbook: ContractPlaybook,
  ): PlaybookComparisonResult {
    const text = clause.rawText;

    // Check prohibited patterns first (highest severity)
    for (const pattern of playbook.prohibitedPatterns) {
      try {
        const re = new RegExp(pattern, 'i');
        if (re.test(text)) {
          return {
            clauseType: clause.clauseType,
            playbookId: playbook.id,
            found: true,
            status: 'prohibited',
            matchedText: this.extractMatch(text, re),
            issue: `Clause contains prohibited pattern: "${pattern}"`,
            suggestedReplacement: playbook.preferredText ?? undefined,
          };
        }
      } catch {
        this.logger.warn(`Invalid prohibited regex in playbook ${playbook.id}: ${pattern}`);
      }
    }

    // Check flagged patterns
    for (const pattern of playbook.flaggedPatterns) {
      try {
        const re = new RegExp(pattern, 'i');
        if (re.test(text)) {
          return {
            clauseType: clause.clauseType,
            playbookId: playbook.id,
            found: true,
            status: 'flagged',
            matchedText: this.extractMatch(text, re),
            issue: `Clause contains flagged pattern: "${pattern}"`,
            suggestedReplacement: playbook.acceptableText ?? playbook.preferredText ?? undefined,
          };
        }
      } catch {
        this.logger.warn(`Invalid flagged regex in playbook ${playbook.id}: ${pattern}`);
      }
    }

    // Check if preferred text is present
    if (playbook.preferredText && text.toLowerCase().includes(playbook.preferredText.toLowerCase().slice(0, 50))) {
      return {
        clauseType: clause.clauseType,
        playbookId: playbook.id,
        found: true,
        status: 'preferred',
        matchedText: text.slice(0, 200),
      };
    }

    return {
      clauseType: clause.clauseType,
      playbookId: playbook.id,
      found: true,
      status: 'acceptable',
    };
  }

  private extractMatch(text: string, re: RegExp): string {
    const match = text.match(re);
    if (!match) return '';
    const start = text.indexOf(match[0]);
    return text.slice(Math.max(0, start - 20), start + match[0].length + 20).trim();
  }
}
