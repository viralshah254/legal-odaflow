import type { LegalAssetMetadata } from '@/ai/matter-intelligence/matter-intelligence.types';

/** Maps documentKind → LegalAssetMetadata for firm/system templates (P5-02). */
export const TEMPLATE_LEGAL_ASSET_METADATA: Record<string, LegalAssetMetadata> = {
  employment_contract: {
    practiceArea: 'employment_labour',
    subPracticeArea: 'employment_contract',
    nature: 'transaction',
  },
  service_agreement: {
    practiceArea: 'corporate_commercial',
    subPracticeArea: 'msa',
    nature: 'transaction',
  },
  nda: {
    practiceArea: 'corporate_commercial',
    subPracticeArea: 'nda',
    nature: 'transaction',
  },
  wrongful_termination_petition: {
    practiceArea: 'employment_labour',
    subPracticeArea: 'wrongful_termination',
    nature: 'dispute',
    forum: 'labour_court',
  },
  bail_application: {
    practiceArea: 'litigation_disputes',
    subPracticeArea: 'criminal_fir_bail',
    nature: 'dispute',
  },
  maintenance_order_revision: {
    practiceArea: 'family_matrimonial',
    subPracticeArea: 'maintenance',
    nature: 'dispute',
    forum: 'family_court',
  },
  consumer_complaint: {
    practiceArea: 'consumer',
    nature: 'dispute',
  },
};

export function getTemplateMetadata(documentKind?: string | null): LegalAssetMetadata | undefined {
  if (!documentKind) return undefined;
  return TEMPLATE_LEGAL_ASSET_METADATA[documentKind];
}
