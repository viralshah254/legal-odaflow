/** A source entry in the Verified Source Registry. Models may only cite sources listed here. */

export type SourceVerificationStatus = 'verified' | 'partially_verified' | 'rejected';

export interface VerifiedSource {
  id: string;
  type: 'statute' | 'case' | 'rule' | 'template' | 'matter_document';
  /** Explicit jurisdiction code or `unknown` — never silently default to IN. */
  jurisdiction: string;
  title: string;
  citation?: string;
  court?: string;
  date?: string;
  section?: string;
  /** Verbatim quoted passage the model may treat as a quotation. */
  verbatimPassage?: string;
  /** Legacy alias; prefer verbatimPassage. */
  text?: string;
  /** Non-authoritative summary of the source (not citable as a quote). */
  summary?: string;
  /** Generated proposition — not a quotation. */
  proposition?: string;
  bindingLevel?: 'binding' | 'persuasive' | 'informational';
  verificationStatus: SourceVerificationStatus;
  /** Full SHA-256 of canonical source artifact text. */
  contentHash: string;
  /** Verifier receipt id when status is verified. */
  evidenceReceiptId?: string;
  allowedSectionIds?: string[];
}

export interface VerifiedSourceRegistry {
  jobId: string;
  sources: VerifiedSource[];
  builtAt: string;
}

export type PromptChannel = 'citable' | 'background';

/** Prompt-safe representation — reflects actual verification, not a blanket verified flag. */
export interface SourcePromptEntry {
  id: string;
  title: string;
  citation?: string;
  section?: string;
  proposition?: string;
  permitted_use?: string;
  channel: PromptChannel;
  verified: boolean;
  citable: boolean;
  verificationStatus: SourceVerificationStatus;
}

export function canonicalPassage(source: VerifiedSource): string | undefined {
  const passage = source.verbatimPassage ?? source.text;
  return passage?.trim() ? passage : undefined;
}

export function toSourcePromptEntry(source: VerifiedSource): SourcePromptEntry {
  const isVerified = source.verificationStatus === 'verified';
  const channel: PromptChannel = isVerified ? 'citable' : 'background';
  const passage = canonicalPassage(source);
  return {
    id: source.id,
    title: source.title,
    citation: source.citation,
    section: source.section,
    proposition: source.proposition,
    permitted_use: isVerified && passage ? passage.slice(0, 400) : source.summary?.slice(0, 400),
    channel,
    verified: isVerified,
    citable: isVerified && Boolean(passage || source.proposition),
    verificationStatus: source.verificationStatus,
  };
}

export function toBackgroundPromptEntry(source: VerifiedSource): SourcePromptEntry {
  return { ...toSourcePromptEntry(source), channel: 'background', citable: false, verified: false };
}

/** Downgrade sources that claim verified without a receipt or citable passage. */
export function enforceVerifiedSourceAdmission(source: VerifiedSource): VerifiedSource {
  if (source.verificationStatus !== 'verified') return source;
  const passage = canonicalPassage(source);
  if (!source.evidenceReceiptId?.trim() || !passage) {
    return { ...source, verificationStatus: 'partially_verified' };
  }
  return source;
}
