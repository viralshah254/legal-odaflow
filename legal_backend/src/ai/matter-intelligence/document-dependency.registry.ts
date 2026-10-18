/** Required inputs per document type before drafting. */

export interface DocumentDependency {
  documentType: string;
  requiredInputs: string[];
  optionalInputs?: string[];
  blockMessage?: string;
}

export const DOCUMENT_DEPENDENCIES: DocumentDependency[] = [
  {
    documentType: 'maintenance_order_revision',
    requiredInputs: ['impugned_order'],
    optionalInputs: ['income_affidavit'],
    blockMessage:
      'A revision petition requires the impugned maintenance order (upload or describe it in case details). Income affidavits strengthen the draft.',
  },
  {
    documentType: 'wrongful_termination_petition',
    requiredInputs: ['termination_letter', 'employment_records'],
    blockMessage: 'Labour dispute petition requires termination letter and employment records.',
  },
  {
    documentType: 'india_wrongful_termination',
    requiredInputs: ['termination_letter'],
    blockMessage: 'Please upload or reference the termination letter before drafting the petition.',
  },
  {
    documentType: 'india_labour_court_application',
    requiredInputs: ['termination_letter'],
    blockMessage: 'Labour court application requires details of the termination.',
  },
  {
    documentType: 'india_illegal_termination_demand_notice',
    requiredInputs: ['termination_letter'],
    blockMessage: 'Demand notice requires termination details.',
  },
  {
    documentType: 'bail_application',
    requiredInputs: ['fir_copy'],
    blockMessage: 'Bail application requires a copy of the FIR or chargesheet.',
  },
  {
    documentType: 'india_bail_application',
    requiredInputs: ['fir_copy'],
    blockMessage: 'Bail application requires a copy of the FIR.',
  },
  {
    documentType: 'consumer_complaint',
    requiredInputs: ['purchase_invoice'],
    optionalInputs: ['correspondence_with_seller'],
  },
  {
    documentType: 'india_consumer_complaint_nch',
    requiredInputs: ['purchase_invoice'],
    optionalInputs: ['correspondence_with_seller'],
  },
];

export function getDependencyForDocument(documentType?: string): DocumentDependency | undefined {
  if (!documentType) return undefined;
  const normalized = documentType.toLowerCase();
  return DOCUMENT_DEPENDENCIES.find(
    (d) =>
      d.documentType === normalized ||
      d.documentType.replace(/^india_/, '') === normalized.replace(/^india_/, ''),
  );
}
