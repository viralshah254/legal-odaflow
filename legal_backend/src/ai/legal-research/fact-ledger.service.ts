import { Injectable } from '@nestjs/common';
import type {
  FactLedgerRecord,
  FactSource,
  FactSourceReference,
  FactStatus,
  ResearchMateriality,
  ResearchScope,
} from './high-confidence-research.types';

export interface CreateFactLedgerRecord extends ResearchScope {
  factId: string;
  statement: string;
  status: FactStatus;
  materiality: ResearchMateriality;
  sources?: FactSourceReference[];
}

@Injectable()
export class FactLedgerService {
  private readonly sourcesByScope = new Map<string, Map<string, FactSource>>();
  private readonly factsByScope = new Map<string, Map<string, FactLedgerRecord>>();

  registerSource(scope: ResearchScope, source: FactSource): FactSource {
    this.assertScope(scope);
    if (!source.sourceId.trim() || !source.title.trim()) {
      throw new Error('Fact source requires a sourceId and title');
    }

    const sources = this.scopedSources(scope);
    if (sources.has(source.sourceId)) {
      throw new Error(`Source ${source.sourceId} already exists in this matter`);
    }
    const stored = structuredClone(source);
    sources.set(source.sourceId, stored);
    return structuredClone(stored);
  }

  createRecord(input: CreateFactLedgerRecord): FactLedgerRecord {
    this.assertScope(input);
    if (!input.factId.trim() || !input.statement.trim()) {
      throw new Error('Fact record requires a factId and statement');
    }

    const records = this.scopedFacts(input);
    if (records.has(input.factId)) {
      throw new Error(`Fact ${input.factId} already exists in this matter`);
    }

    const sources = structuredClone(input.sources ?? []);
    this.validateSourceReferences(input, sources);
    const now = new Date().toISOString();
    const record: FactLedgerRecord = {
      tenantId: input.tenantId,
      matterId: input.matterId,
      factId: input.factId,
      statement: input.statement,
      status: input.status,
      disputed: input.status === 'DISPUTED',
      assumed: input.status === 'ASSUMED',
      materiality: input.materiality,
      sources,
      createdAt: now,
      updatedAt: now,
    };
    records.set(record.factId, record);
    return structuredClone(record);
  }

  updateStatus(
    scope: ResearchScope,
    factId: string,
    status: FactStatus,
  ): FactLedgerRecord {
    const record = this.requireRecord(scope, factId);
    if (
      status === 'VERIFIED' &&
      !record.sources.some((reference) => reference.supports)
    ) {
      throw new Error('A verified fact requires at least one supporting source');
    }
    const updated = {
      ...record,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.scopedFacts(scope).set(factId, updated);
    return structuredClone(updated);
  }

  getRecord(scope: ResearchScope, factId: string): FactLedgerRecord | undefined {
    this.assertScope(scope);
    const record = this.scopedFacts(scope).get(factId);
    return record ? structuredClone(record) : undefined;
  }

  requireRecord(scope: ResearchScope, factId: string): FactLedgerRecord {
    const record = this.getRecord(scope, factId);
    if (!record) {
      throw new Error(`Fact ${factId} was not found in the requested matter`);
    }
    return record;
  }

  listRecords(scope: ResearchScope): FactLedgerRecord[] {
    this.assertScope(scope);
    return [...this.scopedFacts(scope).values()].map((record) =>
      structuredClone(record),
    );
  }

  listSources(scope: ResearchScope): FactSource[] {
    this.assertScope(scope);
    return [...this.scopedSources(scope).values()].map((source) =>
      structuredClone(source),
    );
  }

  private validateSourceReferences(
    scope: CreateFactLedgerRecord,
    references: FactSourceReference[],
  ): void {
    const registered = this.scopedSources(scope);
    for (const reference of references) {
      if (!registered.has(reference.sourceId)) {
        throw new Error(
          `Source ${reference.sourceId} is not registered in this matter`,
        );
      }
      if (!this.hasPinpoint(reference)) {
        throw new Error(
          `Source ${reference.sourceId} requires a page, paragraph, section, timestamp, or quote`,
        );
      }
    }

    if (
      scope.status === 'VERIFIED' &&
      !references.some((reference) => reference.supports)
    ) {
      throw new Error('A verified fact requires at least one supporting source');
    }
  }

  private hasPinpoint(reference: FactSourceReference): boolean {
    const pinpoint = reference.pinpoint;
    return (
      pinpoint.page !== undefined ||
      Boolean(pinpoint.paragraph?.trim()) ||
      Boolean(pinpoint.section?.trim()) ||
      Boolean(pinpoint.timestamp?.trim()) ||
      Boolean(pinpoint.quote?.trim())
    );
  }

  private scopedSources(scope: ResearchScope): Map<string, FactSource> {
    const key = this.scopeKey(scope);
    let sources = this.sourcesByScope.get(key);
    if (!sources) {
      sources = new Map();
      this.sourcesByScope.set(key, sources);
    }
    return sources;
  }

  private scopedFacts(scope: ResearchScope): Map<string, FactLedgerRecord> {
    const key = this.scopeKey(scope);
    let facts = this.factsByScope.get(key);
    if (!facts) {
      facts = new Map();
      this.factsByScope.set(key, facts);
    }
    return facts;
  }

  private scopeKey(scope: ResearchScope): string {
    this.assertScope(scope);
    return `${scope.tenantId}\u0000${scope.matterId}`;
  }

  private assertScope(scope: ResearchScope): void {
    if (!scope.tenantId.trim() || !scope.matterId.trim()) {
      throw new Error('Fact ledger operations require tenantId and matterId');
    }
  }
}
