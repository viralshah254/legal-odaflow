/** Civil dispute extension for CaseRecord.matterData */

export interface ReliefRequest {
  id: string;
  description: string;
  type: 'primary' | 'interim' | 'costs' | 'ancillary' | 'declaratory';
}

export interface NoticeRecord {
  date?: string;
  sender?: string;
  recipient?: string;
  summary?: string;
}

export interface ContractRecord {
  title?: string;
  date?: string;
  parties?: string[];
  summary?: string;
}

export interface CivilMatterData {
  causeOfActionDate?: string;
  limitationStartDate?: string;
  valuation?: number;
  courtFeeBasis?: string;
  territorialJurisdictionFacts: string[];
  pecuniaryJurisdictionFacts: string[];
  reliefsRequested: ReliefRequest[];
  priorNotices: NoticeRecord[];
  contracts?: ContractRecord[];
}

export function emptyCivilMatterData(): CivilMatterData {
  return {
    territorialJurisdictionFacts: [],
    pecuniaryJurisdictionFacts: [],
    reliefsRequested: [],
    priorNotices: [],
  };
}
