export type KeLegislationNature =
  | 'act'
  | 'legal_notice'
  | 'gazette_notice'
  | 'corrigenda'
  | 'constitution';

export interface KeManifestActEntry {
  actId: string;
  title: string;
  workFrbrUri: string;
  expressionFrbrUri: string;
  expressionDate?: string;
  publicUrl: string;
  alternatePublicUrls?: string[];
  alternateSourceNote?: string;
  nature?: KeLegislationNature;
  year?: string;
  number?: string;
}

export interface KeSourcesManifest {
  countryCode: 'KE';
  source: 'laws.africa' | 'kenyalaw.org';
  builtAt: string;
  placeCode: string;
  acts: KeManifestActEntry[];
}
