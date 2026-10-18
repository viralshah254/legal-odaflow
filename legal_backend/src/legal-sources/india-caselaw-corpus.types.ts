export type CaselawCourtLevel = 'supreme' | 'high' | 'tribunal' | 'district';
export type CaselawTreatmentStatus =
  | 'good_law'
  | 'overruled'
  | 'distinguished'
  | 'superseded'
  | 'repealed';
export type CaselawExtractionConfidence = 'high' | 'medium' | 'needs_review';

export interface IndiaCaselawCorpusManifest {
  version: string;
  corpusEdition: string;
  generatedAt: string;
  entryCount: number;
  bundles: string[];
}

export interface IndiaCaselawEntry {
  id: string;
  title: string;
  titleAliases?: string[];
  citation: string;
  neutralCitation?: string;
  court: string;
  courtLevel: CaselawCourtLevel;
  countryCode: 'IN';
  jurisdiction: string;
  decisionDate?: string;
  caseNumber?: string;
  sourceName: string;
  sourceUrl?: string;
  sourceBundle: string;
  sourcePdf?: string;
  sourcePageRange?: string;
  summary: string;
  holding?: string;
  topics: string[];
  practiceAreas: string[];
  draftKinds: string[];
  enrichAreas?: string[];
  sectionsCited?: string[];
  keyParagraphs?: string[];
  treatmentStatus: CaselawTreatmentStatus;
  extractionConfidence: CaselawExtractionConfidence;
  reviewedByHuman: boolean;
  dedupeKey: string;
}

export interface IndiaCaselawCorpusFile {
  manifest: IndiaCaselawCorpusManifest;
  entries: IndiaCaselawEntry[];
}
