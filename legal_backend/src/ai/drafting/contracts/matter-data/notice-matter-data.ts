/** Legal notice / demand notice extension for CaseRecord.matterData */

export interface NoticeMatterData {
  senderName?: string;
  recipientName?: string;
  legalRelationship?: string;
  transactionDate?: string;
  defaultDate?: string;
  demandAmount?: string;
  demandBasis?: string;
  curePeriod?: string;
  contractualNoticeClause?: string;
  limitationPosition?: string;
  deliveryMethod?: string;
  consequencesThreatened?: string[];
}

export function emptyNoticeMatterData(): NoticeMatterData {
  return {
    consequencesThreatened: [],
  };
}
