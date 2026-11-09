import { createHash } from 'crypto';

export interface ResearchCacheIdentity {
  userId: string;
  tenantId?: string;
  tenantRole?: string;
  matterId?: string;
  countryCode: string;
  jurisdiction?: string;
  query: string;
  selectedDocumentIds?: string[];
  contextScope?: 'SELECTED' | 'MATTER' | 'FOLDERS';
  selectedFolderIds?: string[];
  selectedSavedResearchIds?: string[];
  authorizedMatterContext?: string;
  priorContext?: string;
  practiceArea?: string;
  asOfDate?: string;
  eventDate?: string;
  researchMode?: string;
  aiModelMode?: string;
  premiumModelId?: string;
  outputLanguage?: string;
  locale?: string;
  knowledgeSources?: string[];
  desiredOutput?: string;
  requestedTaskKind?: string;
}

/** No client text or IDs appear in cache keys. Call only after current ACL checks. */
export function researchCacheIdentity(input: ResearchCacheIdentity, pipelineVersion: string): string {
  const sorted = (values?: string[]) => [...new Set(values ?? [])].sort();
  return createHash('sha256').update(JSON.stringify({
    pipelineVersion,
    userId: input.userId,
    tenantId: input.tenantId ?? null,
    tenantRole: input.tenantRole ?? null,
    matterId: input.matterId ?? null,
    countryCode: input.countryCode.toUpperCase(),
    jurisdiction: input.jurisdiction ?? null,
    // Keep case and punctuation: names, quotations and statutory identifiers
    // can differ materially even if a lowercased search string looks identical.
    query: input.query.trim(),
    documentIds: sorted(input.selectedDocumentIds),
    contextScope: input.contextScope ?? 'SELECTED',
    folderIds: sorted(input.selectedFolderIds),
    researchIds: sorted(input.selectedSavedResearchIds),
    // Context includes source revisions and authorized source text, so edits or
    // access-driven scope changes invalidate the shortcut before retrieval.
    matterContext: input.authorizedMatterContext ?? null,
    priorContext: input.priorContext ?? null,
    practiceArea: input.practiceArea ?? null,
    asOfDate: input.asOfDate ?? null,
    eventDate: input.eventDate ?? null,
    researchMode: input.researchMode ?? 'FAST',
    aiModelMode: input.aiModelMode ?? 'AUTO',
    premiumModelId: input.premiumModelId ?? null,
    outputLanguage: input.outputLanguage ?? null,
    locale: input.locale ?? null,
    knowledgeSources: sorted(input.knowledgeSources),
    desiredOutput: input.desiredOutput ?? null,
    requestedTaskKind: input.requestedTaskKind ?? null,
  })).digest('hex');
}
