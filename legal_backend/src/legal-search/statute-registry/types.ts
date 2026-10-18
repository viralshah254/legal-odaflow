export interface SectionRemapEntry {
  from: { actId: string; section: string };
  to: { actId: string; section: string };
  note?: string;
}

export interface StatuteEntry {
  /** Stable slug, e.g. "bnss", "flsa", "cap-63" */
  id: string;
  countryCode: string;
  /** State/sub-jurisdiction code when act is state-specific, e.g. "MH", "DL" */
  jurisdiction?: string;
  acronyms: string[];
  fullName: string;
  shortName: string;
  year?: number;
  practiceAreas: string[];
  /** Prior act this replaces (e.g. crpc for bnss) */
  predecessorActId?: string;
  searchAliases: string[];
  sourceUrl?: string;
  /** Laws.Africa / Akoma Ntoso expression FRBR URI, e.g. akn/ke/act/2007/11/eng@2022-12-31 */
  frbrUri?: string;
  /** External source identifier for ingest jobs */
  externalId?: string;
  /** Ingest priority: 1 = highest (new codes, constitution) */
  ingestPriority?: number;
  /** Total number of sections (articles for constitution) in the Act */
  sectionCount?: number;
  /** True when the Act contains one or more Schedules */
  hasSchedules?: boolean;
  /** Number of Schedules appended to the Act */
  scheduleCount?: number;
  /** Number of Orders (e.g. CPC) */
  orderCount?: number;
  /** e.g. sections+orders+schedules */
  structureProfile?: string;
  /** Named list of Schedules, e.g. ["Schedule I — Offences", "Schedule II — Bail"] */
  scheduleNames?: string[];
  /** Constitution / manifest metadata */
  /** Commencement date used for historical current-law evaluation. */
  effectiveFrom?: string;
  /** Last date the enactment governed, when known. */
  effectiveTo?: string;
  editionDate?: string;
  lastEnactedAmendment?: string;
  lastAmendmentCommencement?: string;
  amendmentCount?: number;
  /** Act-level legal status for display and ingest */
  status?: 'active' | 'repealed' | 'superseded' | 'amended';
  /** Registry actId of the statute that repealed/superseded this act */
  repealedBy?: string;
  repealYear?: number;
}

export interface ParsedStatuteQuery {
  section?: string;
  actToken?: string;
  actId?: string;
  statute?: StatuteEntry;
  isBareActQuery: boolean;
}

export interface QueryExpansionResult {
  expandedQueries: string[];
  isBareActQuery: boolean;
  parsed?: ParsedStatuteQuery;
  remappedSection?: { actId: string; section: string; note?: string };
  searchTopics: string[];
}
