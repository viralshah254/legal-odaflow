/** Contract / commercial agreement extension for CaseRecord.matterData */

export interface CommercialTerm {
  key: string;
  value: string;
  source?: 'user_instruction' | 'playbook_default' | 'counterparty' | 'recommendation';
}

export interface PaymentTerm {
  amount?: string;
  schedule?: string;
  currency?: string;
  source?: string;
}

export interface Deliverable {
  description: string;
  dueDate?: string;
}

export interface IpPosition {
  ownership?: string;
  licence?: string;
  workProduct?: string;
}

export interface TerminationPosition {
  forConvenience?: string;
  forCause?: string;
  noticePeriod?: string;
}

export interface RiskPreference {
  key: string;
  preference: string;
}

export type TermDecisionSource =
  | 'user_instruction'
  | 'playbook_default'
  | 'counterparty_request'
  | 'legal_recommendation';

export interface TermDecision {
  key: string;
  value: string;
  source: TermDecisionSource;
  flagged?: boolean;
  note?: string;
}

export interface ContractTermMatrix {
  commercialTerms: TermDecision[];
  paymentTerms: TermDecision[];
  deliverables: TermDecision[];
  acceptance: TermDecision[];
  revisions: TermDecision[];
  intellectualProperty: TermDecision[];
  usageRights: TermDecision[];
  confidentiality: TermDecision[];
  liability: TermDecision[];
  indemnity: TermDecision[];
  termination: TermDecision[];
  exclusivity: TermDecision[];
  governingLaw: TermDecision[];
  disputeResolution: TermDecision[];
}

export interface ContractMatterData {
  transactionType: string;
  commercialTerms: CommercialTerm[];
  paymentStructure: PaymentTerm[];
  deliverables: Deliverable[];
  intellectualPropertyPosition: IpPosition;
  terminationPosition: TerminationPosition;
  governingLawPreference?: string;
  disputeResolutionPreference?: string;
  riskAllocationPreferences: RiskPreference[];
  termMatrix?: ContractTermMatrix;
}

export function emptyContractMatterData(): ContractMatterData {
  return {
    transactionType: 'general',
    commercialTerms: [],
    paymentStructure: [],
    deliverables: [],
    intellectualPropertyPosition: {},
    terminationPosition: {},
    riskAllocationPreferences: [],
  };
}

export function emptyTermMatrix(): ContractTermMatrix {
  return {
    commercialTerms: [],
    paymentTerms: [],
    deliverables: [],
    acceptance: [],
    revisions: [],
    intellectualProperty: [],
    usageRights: [],
    confidentiality: [],
    liability: [],
    indemnity: [],
    termination: [],
    exclusivity: [],
    governingLaw: [],
    disputeResolution: [],
  };
}
