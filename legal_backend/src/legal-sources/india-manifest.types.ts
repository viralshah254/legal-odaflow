export type IndiaSourceAuthority =
  | 'india-code'
  | 'prsindia'
  | 'ncrb'
  | 'legislative-department'
  | 'yourlordships-mirror'
  | 'gst-council';

export type IndiaSourceTier = 'primary' | 'mirror' | 'fallback';

export interface IndiaManifestSupplementaryAuthority {
  type: string;
  id: string;
  amendment?: string;
  effectiveDate?: string;
  title: string;
  summary: string;
  fullText?: string;
  sourceName: string;
  sourceUrl?: string;
}

export interface IndiaManifestPendingAmendment {
  bill: string;
  status: string;
  date?: string;
  url?: string;
  note?: string;
}

export interface IndiaManifestActEntry {
  actId: string;
  sourceAuthority: IndiaSourceAuthority;
  sourceTier: IndiaSourceTier;
  primaryPdfUrl?: string;
  fallbackPdfUrl?: string;
  mirrorPdfUrl?: string;
  /** Path relative to cwd (e.g. "corpus/in/foo.pdf") for locally-bundled PDFs. Tried first, before any remote URL. */
  localPdfPath?: string;
  externalId?: string;
  documentType?: 'act' | 'constitution';
  effectiveFrom?: string;
  editionDate?: string;
  lastVerified?: string;
  lastEnactedAmendment?: string;
  lastAmendmentCommencement?: string;
  amendmentCount?: number;
  supplementaryAuthorities?: IndiaManifestSupplementaryAuthority[];
  pendingAmendments?: IndiaManifestPendingAmendment[];
  notes?: string;
  isRepealed?: boolean;
  repealNotes?: string;
}

export interface IndiaSourcesManifest {
  version: number;
  countryCode: string;
  acts: IndiaManifestActEntry[];
}

export interface YourLordshipsMirrorEntry {
  actId: string;
  pdfFile: string;
  validateAgainst?: string;
  constitutionPrimary?: boolean;
  note?: string;
}

export interface YourLordshipsMirrorManifest {
  version: number;
  baseUrl: string;
  catalogPage: string;
  lastVerified?: string;
  mirrors: YourLordshipsMirrorEntry[];
}
