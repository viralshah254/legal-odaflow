import type { CitationAppendixEntry } from '@/ai/drafting-v2/drafting-v2.types';
import type { PinnedCaseLaw } from '@/ai/drafting/draft-pinned-authorities';
import type { VerifiedSourceRegistry } from '../contracts/verified-source';
import type {
  VerificationDimensions,
  VerificationFinding,
} from '@/ai/verification/verification-finding.types';

export interface DraftAuthorityVerificationInput {
  draftText: string;
  documentKind: string;
  jurisdiction?: string;
  courtName?: string;
  rawFacts?: string;
  sourceRegistry: VerifiedSourceRegistry;
  pinnedCaseLaws?: PinnedCaseLaw[];
  tenantId?: string;
  userId?: string;
}

export interface DraftAuthorityVerificationGate {
  canExport: boolean;
  status: 'pass' | 'fail' | 'limitations';
  userLabel: string;
  blockers: string[];
  verifiedCaseCount: number;
  minVerifiedCases: number;
  passingAuthorityCount: number;
}

export interface DraftAuthorityVerificationResult {
  citationAppendix: VerifiedCitationAppendixEntry[];
  gate: DraftAuthorityVerificationGate;
  findings: VerificationFinding[];
  aggregateDimensions: VerificationDimensions;
}

export interface VerifiedCitationAppendixEntry extends CitationAppendixEntry {
  dimensions?: VerificationDimensions;
  verificationFindings?: VerificationFinding[];
  issue?: string;
}

export interface ExtractedCitationProposition {
  id: string;
  citationKey: string;
  citationDisplay: string;
  title?: string;
  proposition: string;
  paragraphIndex: number;
  issue: string;
  evidenceIds: string[];
  orphan: boolean;
}
