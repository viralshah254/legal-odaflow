export interface DraftingClauseOutline {
  title: string;
  summary: string;
}

export interface DraftingMissingField {
  field: string;
  question: string;
  options?: string[];
}

export interface DraftingSmartStep {
  type: string;
  label: string;
  detail?: string;
  fieldId?: string;
}

export interface MatterDraftWorkspace {
  documentType?: string;
  documentTitle?: string;
  situation?: string;
  clauseOutline?: DraftingClauseOutline[];
  missingFields?: DraftingMissingField[];
  smartNextSteps?: DraftingSmartStep[];
  sourcesCited?: string[];
  draftMarkdown?: string;
  /** Titles of clauses the user has explicitly selected for inclusion. */
  selectedClauses?: string[];
}

export {
  DOCUMENT_TYPE_TO_TEMPLATE_KIND,
  ALL_DOCUMENT_KINDS,
  resolveDocumentKind,
} from '@/config/templates/document-kinds';
