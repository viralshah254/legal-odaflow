export interface JurisdictionFormSeed {
  countryCode: string;
  jurisdiction?: string;
  practiceArea: string;
  formName: string;
  formNumber?: string;
  authority: string;
  sourceUrl: string;
  description?: string;
  category?: string;
  feeInfo?: string;
  lastUpdated?: Date;
  isSystem: boolean;
  /** Optional JSON (e.g. `{ caseLaws: [...] }`). Stored on JurisdictionForm.metadata. */
  metadata?: Record<string, unknown>;
}
