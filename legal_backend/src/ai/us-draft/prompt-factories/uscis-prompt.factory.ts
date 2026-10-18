export interface UscisFormMeta {
  formNumber: string;
  title: string;
  category?: string;
}

const USCIS_FORMS: UscisFormMeta[] = [
  { formNumber: 'I-130', title: 'Petition for Alien Relative', category: 'Family' },
  { formNumber: 'I-485', title: 'Application to Register Permanent Residence', category: 'Adjustment' },
  { formNumber: 'I-765', title: 'Application for Employment Authorization', category: 'Employment' },
  { formNumber: 'I-129', title: 'Petition for Nonimmigrant Worker', category: 'Employment' },
  { formNumber: 'I-140', title: 'Immigrant Petition for Alien Worker', category: 'Employment' },
  { formNumber: 'I-539', title: 'Application to Extend/Change Nonimmigrant Status', category: 'Status' },
  { formNumber: 'I-751', title: 'Petition to Remove Conditions on Residence', category: 'Family' },
  { formNumber: 'I-90', title: 'Application to Replace Permanent Resident Card', category: 'Card' },
  { formNumber: 'I-824', title: 'Application for Action on Approved Application', category: 'Derivative' },
  { formNumber: 'I-864', title: 'Affidavit of Support Under Section 213A', category: 'Financial' },
  { formNumber: 'I-912', title: 'Request for Fee Waiver', category: 'Administrative' },
  { formNumber: 'I-131', title: 'Application for Travel Document', category: 'Travel' },
  { formNumber: 'I-821', title: 'Application for Temporary Protected Status', category: 'TPS' },
  { formNumber: 'N-400', title: 'Application for Naturalization', category: 'Citizenship' },
  { formNumber: 'I-589', title: 'Application for Asylum and Withholding of Removal', category: 'Asylum' },
  { formNumber: 'I-601', title: 'Application for Waiver of Grounds of Inadmissibility', category: 'Waiver' },
  { formNumber: 'I-693', title: 'Report of Medical Examination and Vaccination Record', category: 'Medical' },
  { formNumber: 'I-129F', title: 'Petition for Alien Fiancé(e)', category: 'Family' },
  { formNumber: 'I-360', title: 'Petition for Amerasian, Widow(er), or Special Immigrant', category: 'Special' },
  { formNumber: 'I-526', title: 'Immigrant Petition by Standalone Investor', category: 'EB-5' },
  { formNumber: 'I-526E', title: 'Immigrant Petition by Regional Center Investor', category: 'EB-5' },
  { formNumber: 'I-829', title: 'Petition by Investor to Remove Conditions', category: 'EB-5' },
  { formNumber: 'I-918', title: 'Petition for U Nonimmigrant Status', category: 'Victim' },
  { formNumber: 'I-918A', title: 'Petition for Qualifying Family Member of U-1', category: 'Victim' },
  { formNumber: 'I-914', title: 'Application for T Nonimmigrant Status', category: 'Victim' },
  { formNumber: 'I-914A', title: 'Application for Derivative T Nonimmigrant Status', category: 'Victim' },
  { formNumber: 'I-918B', title: 'Supplement B for U Nonimmigrant Status Certification', category: 'Victim' },
  { formNumber: 'I-102', title: 'Application for Replacement/Initial Nonimmigrant Arrival-Departure Document', category: 'Travel' },
  { formNumber: 'I-212', title: 'Application for Permission to Reapply for Admission', category: 'Waiver' },
  { formNumber: 'I-290B', title: 'Notice of Appeal or Motion', category: 'Appeal' },
  { formNumber: 'I-407', title: 'Record of Abandonment of Lawful Permanent Resident Status', category: 'Status' },
  { formNumber: 'I-485J', title: 'Confirmation of Bona Fide Job Offer', category: 'Employment' },
  { formNumber: 'I-508', title: 'Waiver of Rights, Privileges, Exemptions and Immunities', category: 'Diplomatic' },
  { formNumber: 'I-566', title: 'Interagency Record of Request', category: 'Diplomatic' },
  { formNumber: 'I-600', title: 'Petition to Classify Orphan as Immediate Relative', category: 'Adoption' },
  { formNumber: 'I-600A', title: 'Application for Advance Processing of Orphan Petition', category: 'Adoption' },
  { formNumber: 'I-800', title: 'Petition to Classify Convention Adoptee', category: 'Adoption' },
  { formNumber: 'I-800A', title: 'Application for Determination of Suitability to Adopt', category: 'Adoption' },
  { formNumber: 'I-907', title: 'Request for Premium Processing Service', category: 'Administrative' },
  { formNumber: 'I-941', title: 'Application for Entrepreneur Parole', category: 'Parole' },
  { formNumber: 'N-565', title: 'Application for Replacement Naturalization/Citizenship Document', category: 'Citizenship' },
  { formNumber: 'N-600', title: 'Application for Certificate of Citizenship', category: 'Citizenship' },
  { formNumber: 'N-648', title: 'Medical Certification for Disability Exceptions', category: 'Citizenship' },
  { formNumber: 'I-765V', title: 'Application for Employment Authorization for Abused Nonimmigrant Spouse', category: 'VAWA' },
  { formNumber: 'I-914B', title: 'Declaration for Trafficking Victim', category: 'Victim' },
  { formNumber: 'I-918D', title: 'Law Enforcement Certification for U Nonimmigrant Status', category: 'Victim' },
  { formNumber: 'I-929', title: 'Petition for Qualifying Family Member of U-1 Nonimmigrant', category: 'Victim' },
  { formNumber: 'I-956', title: 'Application for Regional Center Designation', category: 'EB-5' },
  { formNumber: 'I-956F', title: 'Application for Approval of an Investment in a Commercial Enterprise', category: 'EB-5' },
];

export function uscisFormKind(formNumber: string): string {
  return `us_immigration_${formNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

export function buildUscisPrompt(meta: UscisFormMeta): string {
  return `You are completing USCIS Form ${meta.formNumber} (${meta.title})${meta.category ? ` — ${meta.category}` : ''}. Follow official USCIS form instructions structure: form heading, applicant/petitioner information, eligibility sections, supporting evidence checklist, declarations, and signature blocks. Use descriptive [BLANK] placeholders for all fields requiring user input. Apply standard US immigration drafting conventions and cite INA/regulatory provisions where applicable.`;
}

export function resolveUscisPrompt(formNumber: string): string | null {
  const meta = USCIS_FORMS.find((f) => f.formNumber.toUpperCase() === formNumber.toUpperCase());
  if (!meta) return null;
  return buildUscisPrompt(meta);
}

export function resolveUscisPromptByKind(kind: string): string | null {
  const match = kind.match(/^us_immigration_(i\d+[a-z]?|n\d+[a-z]?)$/i);
  if (!match) return null;
  const num = match[1].toUpperCase().replace(/^I(\d)/, 'I-$1').replace(/^N(\d)/, 'N-$1');
  const normalized = USCIS_FORMS.find((f) => uscisFormKind(f.formNumber) === kind.toLowerCase());
  if (normalized) return buildUscisPrompt(normalized);
  return resolveUscisPrompt(num);
}

export const USCIS_FORM_CATALOG = USCIS_FORMS;
