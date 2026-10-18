import type { DraftIntentBundleItem } from './draft-intent-bundles';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';

export type ExplicitResolutionSource = 'regex' | 'catalog' | 'llm';

export interface ExplicitDocumentSuggestion {
  kind: string;
  label: string;
  confidence: number;
}

export interface ExplicitDocumentResolution {
  phrase: string;
  kind: string;
  label: string;
  documentKind: string;
  confidence: number;
  source: ExplicitResolutionSource;
  provisional?: boolean;
  alternatives?: ExplicitDocumentSuggestion[];
}

export interface UnmappedExplicitPhrase {
  phrase: string;
  suggestions: ExplicitDocumentSuggestion[];
}

export interface ExplicitDocumentResolveResult {
  /** True when a Prepare / drafting-request list was parsed from the query. */
  hasExplicitSection: boolean;
  resolutions: ExplicitDocumentResolution[];
  unmapped: UnmappedExplicitPhrase[];
  bundle: DraftIntentBundleItem[];
}

export interface ExplicitDocumentResolveOptions {
  query: string;
  countryCode?: string;
  matterProfile?: MatterProfile;
  /** When false, skip LLM tier (tests). Default true. */
  useLlm?: boolean;
}
