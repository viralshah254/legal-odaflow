export type DraftDocumentClass =
  | 'pleading'
  | 'contract'
  | 'form'
  | 'application'
  | 'memo'
  | 'reply';

export interface GoverningSection {
  actId: string;
  section: string;
  label: string;
  predecessor?: { actId: string; section: string };
}

export interface ProceduralRouterResult {
  recommendedKind: string;
  userSelectedKind: string;
  kindOverridden: boolean;
  causeTitleVehicle: string;
  documentClass: DraftDocumentClass;
  governingSections: GoverningSection[];
  maintainabilityNotes: string[];
  requiredStructuralSections: string[];
  proceduralWarnings: string[];
  completenessGaps: string[];
}

export interface ProceduralRouterInput {
  kind: string;
  caseDetails: string;
  countryCode: string;
  courtName?: string;
  /** When true, keep `kind` for routing output; only add maintainability notes. */
  respectUserSelection?: boolean;
}
