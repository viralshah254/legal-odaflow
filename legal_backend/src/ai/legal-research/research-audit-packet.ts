import { createHash, randomUUID } from 'node:crypto';

export type ResearchAuditJson =
  | null
  | boolean
  | number
  | string
  | ResearchAuditJson[]
  | { [key: string]: ResearchAuditJson };

export interface ResearchAuditNormalizedRequest {
  query: string;
  countryCode: string;
  jurisdiction?: string;
  asOfDate?: string;
  researchMode?: string;
  matterIdHash?: string;
  parameters?: Record<string, ResearchAuditJson>;
}

export interface ResearchAuditVersion {
  id: string;
  version: string;
  hash?: string;
}

export interface ResearchAuditSourceInput {
  id: string;
  uri?: string;
  title?: string;
  authorityIdentity?: string;
  retrievedAt?: string;
  content?: string;
  contentHash?: string;
  metadata?: Record<string, ResearchAuditJson>;
}

export interface ResearchAuditSource
  extends Omit<ResearchAuditSourceInput, 'content'> {
  contentHash: string;
}

export interface ResearchAuditDecision {
  candidateId: string;
  decision: 'admitted' | 'rejected';
  reasonCodes: string[];
  score?: number;
  stage?: string;
}

export interface ResearchAuditPassage {
  id: string;
  sourceId: string;
  locator?: string;
  textHash: string;
  text?: string;
  propositionIds: string[];
}

export interface ResearchAuditGraph {
  nodes: Array<Record<string, ResearchAuditJson>>;
  edges: Array<Record<string, ResearchAuditJson>>;
  hash: string;
}

export interface ResearchAuditHumanApproval {
  status: 'not_requested' | 'pending' | 'approved' | 'rejected';
  approverIdHash?: string;
  decidedAt?: string;
  notesHash?: string;
}

export interface ResearchAuditPrivacy {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  containsPersonalData: boolean;
  redactionApplied: boolean;
  redactionPolicyVersion?: string;
  redactedFields: string[];
  retentionPolicy?: string;
  encryptionKeyId?: string;
}

export interface ResearchAuditPacket {
  schemaVersion: '1.0';
  packetId: string;
  createdAt: string;
  normalizedRequest: ResearchAuditNormalizedRequest;
  capability: Record<string, ResearchAuditJson>;
  task: Record<string, ResearchAuditJson>;
  plan: Record<string, ResearchAuditJson>;
  queries: Array<Record<string, ResearchAuditJson>>;
  sources: ResearchAuditSource[];
  admissions: ResearchAuditDecision[];
  rejections: ResearchAuditDecision[];
  passages: ResearchAuditPassage[];
  issueGraph: ResearchAuditGraph;
  authorityGraph: ResearchAuditGraph;
  temporalResults: Array<Record<string, ResearchAuditJson>>;
  conflictResults: Array<Record<string, ResearchAuditJson>>;
  verification: Record<string, ResearchAuditJson>;
  publication: Record<string, ResearchAuditJson>;
  outputHash: string;
  models: ResearchAuditVersion[];
  prompts: ResearchAuditVersion[];
  dependencySet: Record<string, string>;
  confidence: number | null;
  humanApproval: ResearchAuditHumanApproval;
  privacy: ResearchAuditPrivacy;
  packetHash: string;
}

export interface BuildResearchAuditPacketInput {
  packetId?: string;
  createdAt?: string;
  normalizedRequest: ResearchAuditNormalizedRequest;
  capability: Record<string, ResearchAuditJson>;
  task: Record<string, ResearchAuditJson>;
  plan: Record<string, ResearchAuditJson>;
  queries?: Array<Record<string, ResearchAuditJson>>;
  sources?: ResearchAuditSourceInput[];
  decisions?: ResearchAuditDecision[];
  passages?: Array<Omit<ResearchAuditPassage, 'textHash'> & { textHash?: string }>;
  issueGraph?: Omit<ResearchAuditGraph, 'hash'>;
  authorityGraph?: Omit<ResearchAuditGraph, 'hash'>;
  temporalResults?: Array<Record<string, ResearchAuditJson>>;
  conflictResults?: Array<Record<string, ResearchAuditJson>>;
  verification: Record<string, ResearchAuditJson>;
  publication: Record<string, ResearchAuditJson>;
  output?: string;
  outputHash?: string;
  models: ResearchAuditVersion[];
  prompts: ResearchAuditVersion[];
  dependencySet: Record<string, string>;
  confidence?: number | null;
  humanApproval: ResearchAuditHumanApproval;
  privacy: ResearchAuditPrivacy;
}

export type ResearchAuditReplayFailureCode =
  | 'PACKET_HASH_MISMATCH'
  | 'OUTPUT_HASH_MISMATCH'
  | 'SOURCE_HASH_MISMATCH'
  | 'PASSAGE_HASH_MISMATCH'
  | 'ISSUE_GRAPH_HASH_MISMATCH'
  | 'AUTHORITY_GRAPH_HASH_MISMATCH'
  | 'DEPENDENCY_SET_MISMATCH'
  | 'MODEL_VERSION_MISMATCH'
  | 'PROMPT_VERSION_MISMATCH'
  | 'INVALID_REFERENCE'
  | 'INVALID_CONFIDENCE';

export interface ResearchAuditReplayFailure {
  code: ResearchAuditReplayFailureCode;
  path: string;
  expected?: string;
  actual?: string;
}

export interface ResearchAuditReplayArtifacts {
  output?: string;
  sourceContents?: Record<string, string>;
  passageTexts?: Record<string, string>;
  dependencySet?: Record<string, string>;
  models?: ResearchAuditVersion[];
  prompts?: ResearchAuditVersion[];
}

export interface ResearchAuditReplayValidation {
  valid: boolean;
  failures: ResearchAuditReplayFailure[];
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

export function hashResearchAuditValue(value: unknown): string {
  return createHash('sha256').update(
    typeof value === 'string' ? value : canonicalize(value),
    'utf8',
  ).digest('hex');
}

function normalizeRequest(
  request: ResearchAuditNormalizedRequest,
): ResearchAuditNormalizedRequest {
  return {
    ...request,
    query: request.query.trim().replace(/\s+/g, ' '),
    countryCode: request.countryCode.trim().toUpperCase(),
    jurisdiction: request.jurisdiction?.trim().replace(/\s+/g, ' '),
    researchMode: request.researchMode?.trim().toLowerCase(),
  };
}

function graph(
  value: Omit<ResearchAuditGraph, 'hash'> | undefined,
): ResearchAuditGraph {
  const normalized = value ?? { nodes: [], edges: [] };
  return { ...normalized, hash: hashResearchAuditValue(normalized) };
}

function withoutPacketHash(
  packet: Omit<ResearchAuditPacket, 'packetHash'> | ResearchAuditPacket,
): Omit<ResearchAuditPacket, 'packetHash'> {
  const { packetHash: _packetHash, ...unsigned } = packet as ResearchAuditPacket;
  return unsigned;
}

export function buildResearchAuditPacket(
  input: BuildResearchAuditPacketInput,
): ResearchAuditPacket {
  if (input.output === undefined && !input.outputHash) {
    throw new Error('Research audit packet requires output or outputHash');
  }
  if (
    input.confidence !== undefined &&
    input.confidence !== null &&
    (input.confidence < 0 || input.confidence > 1)
  ) {
    throw new Error('Research confidence must be between 0 and 1');
  }

  const sources = (input.sources ?? []).map(({ content, ...source }) => ({
    ...source,
    contentHash: source.contentHash ?? hashResearchAuditValue(content ?? ''),
  }));
  const passages = (input.passages ?? []).map((passage) => ({
    ...passage,
    textHash: passage.textHash ?? hashResearchAuditValue(passage.text ?? ''),
  }));
  const decisions = input.decisions ?? [];
  const unsigned: Omit<ResearchAuditPacket, 'packetHash'> = {
    schemaVersion: '1.0',
    packetId: input.packetId ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    normalizedRequest: normalizeRequest(input.normalizedRequest),
    capability: input.capability,
    task: input.task,
    plan: input.plan,
    queries: input.queries ?? [],
    sources,
    admissions: decisions.filter(({ decision }) => decision === 'admitted'),
    rejections: decisions.filter(({ decision }) => decision === 'rejected'),
    passages,
    issueGraph: graph(input.issueGraph),
    authorityGraph: graph(input.authorityGraph),
    temporalResults: input.temporalResults ?? [],
    conflictResults: input.conflictResults ?? [],
    verification: input.verification,
    publication: input.publication,
    outputHash: input.outputHash ?? hashResearchAuditValue(input.output ?? ''),
    models: input.models,
    prompts: input.prompts,
    dependencySet: input.dependencySet,
    confidence: input.confidence ?? null,
    humanApproval: input.humanApproval,
    privacy: input.privacy,
  };
  return { ...unsigned, packetHash: hashResearchAuditValue(unsigned) };
}

function compareVersions(
  expected: ResearchAuditVersion[],
  actual: ResearchAuditVersion[] | undefined,
): boolean {
  return actual === undefined || canonicalize(expected) === canonicalize(actual);
}

export function validateResearchAuditReplay(
  packet: ResearchAuditPacket,
  artifacts: ResearchAuditReplayArtifacts = {},
): ResearchAuditReplayValidation {
  const failures: ResearchAuditReplayFailure[] = [];
  const check = (
    code: ResearchAuditReplayFailureCode,
    path: string,
    expected: string,
    actual: string,
  ) => {
    if (expected !== actual) failures.push({ code, path, expected, actual });
  };

  check(
    'PACKET_HASH_MISMATCH',
    'packetHash',
    packet.packetHash,
    hashResearchAuditValue(withoutPacketHash(packet)),
  );
  if (artifacts.output !== undefined) {
    check(
      'OUTPUT_HASH_MISMATCH',
      'outputHash',
      packet.outputHash,
      hashResearchAuditValue(artifacts.output),
    );
  }
  for (const source of packet.sources) {
    const content = artifacts.sourceContents?.[source.id];
    if (content !== undefined) {
      check(
        'SOURCE_HASH_MISMATCH',
        `sources.${source.id}.contentHash`,
        source.contentHash,
        hashResearchAuditValue(content),
      );
    }
  }
  const sourceIds = new Set(packet.sources.map(({ id }) => id));
  for (const passage of packet.passages) {
    if (!sourceIds.has(passage.sourceId)) {
      failures.push({
        code: 'INVALID_REFERENCE',
        path: `passages.${passage.id}.sourceId`,
        actual: passage.sourceId,
      });
    }
    const text = artifacts.passageTexts?.[passage.id] ?? passage.text;
    if (text !== undefined) {
      check(
        'PASSAGE_HASH_MISMATCH',
        `passages.${passage.id}.textHash`,
        passage.textHash,
        hashResearchAuditValue(text),
      );
    }
  }
  check(
    'ISSUE_GRAPH_HASH_MISMATCH',
    'issueGraph.hash',
    packet.issueGraph.hash,
    hashResearchAuditValue({
      nodes: packet.issueGraph.nodes,
      edges: packet.issueGraph.edges,
    }),
  );
  check(
    'AUTHORITY_GRAPH_HASH_MISMATCH',
    'authorityGraph.hash',
    packet.authorityGraph.hash,
    hashResearchAuditValue({
      nodes: packet.authorityGraph.nodes,
      edges: packet.authorityGraph.edges,
    }),
  );
  if (
    artifacts.dependencySet !== undefined &&
    canonicalize(packet.dependencySet) !== canonicalize(artifacts.dependencySet)
  ) {
    failures.push({ code: 'DEPENDENCY_SET_MISMATCH', path: 'dependencySet' });
  }
  if (!compareVersions(packet.models, artifacts.models)) {
    failures.push({ code: 'MODEL_VERSION_MISMATCH', path: 'models' });
  }
  if (!compareVersions(packet.prompts, artifacts.prompts)) {
    failures.push({ code: 'PROMPT_VERSION_MISMATCH', path: 'prompts' });
  }
  if (
    packet.confidence !== null &&
    (packet.confidence < 0 || packet.confidence > 1)
  ) {
    failures.push({ code: 'INVALID_CONFIDENCE', path: 'confidence' });
  }
  return { valid: failures.length === 0, failures };
}
