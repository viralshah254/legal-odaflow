import { createHash, randomUUID } from 'crypto';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  PublicationState,
  VerificationDimensions,
  VerificationFinding,
} from '@/ai/verification/verification-finding.types';
import {
  createEmptyDimensions,
  resolvePublicationState,
  summarizeFindings,
} from '@/ai/verification/verification-finding.types';
import type {
  VerifiedSource,
  VerifiedSourceRegistry,
} from '@/ai/unified-drafting/contracts/verified-source';

export interface AuthorityEvidenceBundle {
  bundleId: string;
  consumer:
    | 'legal_research'
    | 'draft_generation'
    | 'draft_enrich'
    | 'draft_reverify';
  jurisdiction: string;
  documentKind?: string;
  asOfDate: string;
  sourceRegistry: VerifiedSourceRegistry;
  findings: VerificationFinding[];
  dimensions: VerificationDimensions;
  publicationState: PublicationState;
  presentation: {
    allowInlineCitation: boolean;
    maxInlineCaseCites: number;
    appendixOnly: boolean;
  };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function registryFromRetrievedAuthorities(input: {
  jobId: string;
  jurisdiction: string;
  authorities: RetrievedAuthority[];
}): VerifiedSourceRegistry {
  const sources: VerifiedSource[] = input.authorities.map((authority) => {
    const text = authority.summary ?? authority.title;
    const authorityType = (authority.authorityType ?? '').toUpperCase();
    const sourceTier = (authority.sourceTier ?? '').toLowerCase();
    const isCase =
      authorityType.includes('CASE') || sourceTier.includes('case_law');
    return {
      id: authority.id,
      type: isCase ? 'case' : 'statute',
      jurisdiction: input.jurisdiction,
      title: authority.title,
      citation: authority.citation ?? undefined,
      court: authority.sourceName,
      date: authority.decisionYear ? String(authority.decisionYear) : undefined,
      text,
      proposition: authority.summary ?? undefined,
      bindingLevel: authority.courtTierRank === 0 ? 'binding' : 'persuasive',
      verificationStatus:
        authority.relevanceGate === 'rejected'
          ? 'rejected'
          : authority.relevanceGate === 'admitted'
            ? 'verified'
            : 'partially_verified',
      contentHash: hash(text),
    };
  });
  return {
    jobId: input.jobId,
    builtAt: new Date().toISOString(),
    sources,
  };
}

export function buildAuthorityEvidenceBundle(input: {
  consumer: AuthorityEvidenceBundle['consumer'];
  jurisdiction: string;
  documentKind?: string;
  sourceRegistry: VerifiedSourceRegistry;
  findings?: VerificationFinding[];
  appendixOnly?: boolean;
}): AuthorityEvidenceBundle {
  const findings = input.findings ?? [];
  return {
    bundleId: randomUUID(),
    consumer: input.consumer,
    jurisdiction: input.jurisdiction,
    documentKind: input.documentKind,
    asOfDate: new Date().toISOString().slice(0, 10),
    sourceRegistry: input.sourceRegistry,
    findings,
    dimensions:
      findings.length > 0 ? summarizeFindings(findings) : createEmptyDimensions(),
    publicationState:
      findings.length > 0 ? resolvePublicationState(findings) : 'RESEARCH_BACKED',
    presentation: {
      allowInlineCitation: !input.appendixOnly,
      maxInlineCaseCites: input.appendixOnly ? 0 : 4,
      appendixOnly: input.appendixOnly ?? false,
    },
  };
}
