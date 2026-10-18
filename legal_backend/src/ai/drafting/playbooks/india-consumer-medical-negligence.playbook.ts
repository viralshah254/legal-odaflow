/**
 * India consumer medical-negligence playbook — filing-grade behaviour contract.
 * Kind alias: india_consumer_medical_negligence (also guides india_consumer_complaint
 * when medical facts are present).
 */

export const INDIA_CONSUMER_MEDICAL_NEGLIGENCE_PLAYBOOK = {
  documentKind: 'india_consumer_medical_negligence',
  jurisdiction: 'IN',
  version: '1.0.0',
  requiredPartyRoles: [
    'complainant',
    'opposite_party_hospital',
    'opposite_party_surgeon',
    'opposite_party_anaesthesiologist',
    'opposite_party_insurer',
  ],
  requiredFacts: [
    'patient',
    'hospital',
    'doctors',
    'procedure',
    'diagnosis',
    'consent',
    'deterioration',
    'transfer',
    'corrective_treatment',
    'expert_evidence',
    'record_inconsistencies',
    'jurisdiction',
    'limitation',
    'compensation',
  ],
  requiredLegalIssues: [
    'medical_negligence_allegation',
    'informed_consent',
    'hospital_vicarious_liability',
    'deficiency_in_service',
    'record_preservation',
  ],
  prohibitedAssertions: [
    'conclusive_negligence',
    'conclusive_absence_of_consent',
    'conclusive_record_forgery',
    'invented_insurer_denial',
    'anaesthesiologist_caused_surgical_injury_without_support',
    'res_ipsa_automatic',
    'expert_opinion_as_fact',
    'invented_doctor_qualification',
  ],
  companionDocuments: [
    'india_interim_application_document_production',
    'india_consumer_supporting_affidavit',
    'india_consumer_compensation_schedule',
    'india_consumer_list_of_documents',
  ],
  draftingRules: [
    'Distinguish recognised complication from alleged negligent technique.',
    'Distinguish surgical injury from delayed diagnosis / delayed transfer.',
    'Plead consent defects as allegations.',
    'Qualify private expert opinions (probable / based on available records).',
    'Separate liability theories for hospital, surgeon, anaesthesiologist, and insurer.',
    'Include insurer denial grounds only when CaseRecord contains repudiation facts.',
    'Do not assert res ipsa automatically.',
    'Do not assert conclusive forgery or tampering.',
    'Do not state Dr. Rao caused bile-duct injury without supporting facts.',
  ],
} as const;
