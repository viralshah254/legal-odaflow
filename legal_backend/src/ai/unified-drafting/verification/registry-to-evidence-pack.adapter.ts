import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import type { PinnedCaseLaw } from '@/ai/drafting/draft-pinned-authorities';
import type { LegalEvidencePack, EvidenceCase, EvidenceStatute } from '@/ai/legal-research/legal-evidence-pack.service';
import type { VerifiedSource, VerifiedSourceRegistry } from '../contracts/verified-source';
import { resolveCuratedEnrichBank, allCuratedEnrichBanks } from '../enrich/curated-enrich-banks';

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function normalizeCite(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function sourceToEvidenceCase(source: VerifiedSource): EvidenceCase | null {
  if (source.type !== 'case') return null;
  const text = source.text ?? source.proposition ?? '';
  const evidenceId = `EVD_${source.id.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 24)}`;
  return {
    evidenceId,
    authorityId: source.id,
    title: source.title,
    citation: source.citation ?? source.title,
    court: source.court ?? 'Unknown',
    decidedDate: source.date,
    passages: [
      {
        evidenceId: `${evidenceId}_P1`,
        authorityId: source.id,
        text,
        sourceHash: source.contentHash || hashText(text),
        propositionTags: [],
        sourceTier: 'CURATED',
        retrievalScore: 1,
      },
    ],
    subsequentTreatment: 'good_law',
    controllingJurisdiction: source.jurisdiction,
  };
}

function sourceToEvidenceStatute(source: VerifiedSource): EvidenceStatute | null {
  if (source.type !== 'statute' && source.type !== 'rule') return null;
  const text = source.text ?? source.proposition ?? '';
  const evidenceId = `EVD_${source.id.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 24)}`;
  return {
    evidenceId,
    actId: source.title,
    section: source.section ?? '',
    heading: source.title,
    text,
    sourceHash: source.contentHash || hashText(text),
  };
}

function curatedToEvidenceCase(
  c: ReturnType<typeof resolveCuratedEnrichBank>[number],
): EvidenceCase {
  const evidenceId = `EVD_${c.caseId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 24)}`;
  const text = c.proposition;
  return {
    evidenceId,
    authorityId: c.caseId,
    title: c.title,
    citation: c.citation,
    court: c.court,
    decidedDate: c.decisionYear ? String(c.decisionYear) : undefined,
    passages: [
      {
        evidenceId: `${evidenceId}_P1`,
        authorityId: c.caseId,
        text,
        sourceHash: hashText(text),
        propositionTags: c.areas,
        sourceTier: 'CURATED',
        retrievalScore: 1,
        sourceUrl: c.sourceUrl,
      },
    ],
    subsequentTreatment: c.treatmentStatus,
    controllingJurisdiction: 'IN',
  };
}

function pinnedToEvidenceCase(pin: PinnedCaseLaw): EvidenceCase {
  const authorityId = pin.authorityId ?? `pin__${normalizeCite(pin.citation).replace(/\W+/g, '_')}`;
  const evidenceId = `EVD_${authorityId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 24)}`;
  const text = pin.holding ?? pin.caseName ?? pin.citation;
  return {
    evidenceId,
    authorityId,
    title: pin.caseName ?? pin.citation,
    citation: pin.citation,
    court: 'Pinned authority',
    passages: [
      {
        evidenceId: `${evidenceId}_P1`,
        authorityId,
        text,
        sourceHash: hashText(text),
        propositionTags: ['pinned'],
        sourceTier: 'OFFICIAL',
        retrievalScore: 1,
      },
    ],
    subsequentTreatment: 'good_law',
    controllingJurisdiction: 'IN',
  };
}

export interface RegistryToEvidencePackInput {
  sourceRegistry: VerifiedSourceRegistry;
  documentKind: string;
  jurisdiction?: string;
  rawFacts?: string;
  pinnedCaseLaws?: PinnedCaseLaw[];
}

export interface RegistryToEvidencePackResult {
  pack: LegalEvidencePack;
  evidenceIdByCitation: Map<string, string[]>;
}

export function buildEvidencePackFromRegistry(
  input: RegistryToEvidencePackInput,
): RegistryToEvidencePackResult {
  const { sourceRegistry, documentKind, rawFacts = '', pinnedCaseLaws = [] } = input;
  const jurisdiction = input.jurisdiction ?? 'IN';
  const authorities: EvidenceCase[] = [];
  const statutes: EvidenceStatute[] = [];
  const evidenceIdByCitation = new Map<string, string[]>();

  const addCitationIndex = (citation: string, evidenceIds: string[]) => {
    const key = normalizeCite(citation);
    const existing = evidenceIdByCitation.get(key) ?? [];
    evidenceIdByCitation.set(key, [...new Set([...existing, ...evidenceIds])]);
  };

  for (const source of sourceRegistry.sources) {
    if (source.verificationStatus === 'rejected') continue;
    const caseEntry = sourceToEvidenceCase(source);
    if (caseEntry) {
      authorities.push(caseEntry);
      const ids = [caseEntry.evidenceId, ...caseEntry.passages.map((p) => p.evidenceId)];
      addCitationIndex(caseEntry.citation, ids);
      continue;
    }
    const statuteEntry = sourceToEvidenceStatute(source);
    if (statuteEntry) statutes.push(statuteEntry);
  }

  const curated = allCuratedEnrichBanks(documentKind, rawFacts);

  const seenCitations = new Set(authorities.map((a) => normalizeCite(a.citation)));
  for (const c of curated) {
    const key = normalizeCite(c.citation);
    if (seenCitations.has(key)) continue;
    seenCitations.add(key);
    const entry = curatedToEvidenceCase(c);
    authorities.push(entry);
    const ids = [entry.evidenceId, ...entry.passages.map((p) => p.evidenceId)];
    addCitationIndex(entry.citation, ids);
  }

  for (const pin of pinnedCaseLaws) {
    const key = normalizeCite(pin.citation);
    if (seenCitations.has(key)) continue;
    seenCitations.add(key);
    const entry = pinnedToEvidenceCase(pin);
    authorities.push(entry);
    const ids = [entry.evidenceId, ...entry.passages.map((p) => p.evidenceId)];
    addCitationIndex(entry.citation, ids);
  }

  return {
    pack: {
      evidencePackId: randomUUID(),
      version: 'draft-authority-v1',
      jurisdiction,
      asOfDate: new Date().toISOString().slice(0, 10),
      statutes,
      authorities,
      officialMaterials: [],
      sourceSnapshots: [],
      matterFacts: [],
      unresolvedGaps: [],
    },
    evidenceIdByCitation,
  };
}
