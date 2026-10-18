export interface IrsFormMeta {
  formNumber: string;
  title: string;
  category: string;
}

const IRS_FORMS: IrsFormMeta[] = [
  { formNumber: '1040', title: 'U.S. Individual Income Tax Return', category: 'Individual' },
  { formNumber: '1040-SR', title: 'U.S. Tax Return for Seniors', category: 'Individual' },
  { formNumber: '1040-X', title: 'Amended U.S. Individual Income Tax Return', category: 'Individual' },
  { formNumber: '1040-ES', title: 'Estimated Tax for Individuals', category: 'Individual' },
  { formNumber: 'Schedule A', title: 'Itemized Deductions', category: 'Individual' },
  { formNumber: 'Schedule B', title: 'Interest and Ordinary Dividends', category: 'Individual' },
  { formNumber: 'Schedule C', title: 'Profit or Loss From Business', category: 'Individual' },
  { formNumber: 'Schedule D', title: 'Capital Gains and Losses', category: 'Individual' },
  { formNumber: 'Schedule E', title: 'Supplemental Income and Loss', category: 'Individual' },
  { formNumber: 'Schedule F', title: 'Profit or Loss From Farming', category: 'Individual' },
  { formNumber: 'Schedule SE', title: 'Self-Employment Tax', category: 'Individual' },
  { formNumber: 'W-4', title: 'Employee Withholding Certificate', category: 'Employment' },
  { formNumber: 'W-9', title: 'Request for Taxpayer Identification Number', category: 'Employment' },
  { formNumber: 'W-2', title: 'Wage and Tax Statement', category: 'Employment' },
  { formNumber: 'W-2G', title: 'Certain Gambling Winnings', category: 'Employment' },
  { formNumber: '1120', title: 'U.S. Corporation Income Tax Return', category: 'Business' },
  { formNumber: '1120-S', title: 'U.S. Income Tax Return for an S Corporation', category: 'Business' },
  { formNumber: '1065', title: 'U.S. Return of Partnership Income', category: 'Business' },
  { formNumber: '1065 Schedule K-1', title: 'Partner Share of Income', category: 'Business' },
  { formNumber: '1120-F', title: 'U.S. Income Tax Return of a Foreign Corporation', category: 'Business' },
  { formNumber: '990', title: 'Return of Organization Exempt From Income Tax', category: 'Nonprofit' },
  { formNumber: '990-EZ', title: 'Short Form Return of Organization Exempt From Income Tax', category: 'Nonprofit' },
  { formNumber: '990-PF', title: 'Return of Private Foundation', category: 'Nonprofit' },
  { formNumber: '941', title: 'Employer Quarterly Federal Tax Return', category: 'Payroll' },
  { formNumber: '940', title: 'Employer Annual Federal Unemployment Tax Return', category: 'Payroll' },
  { formNumber: '943', title: 'Employers Annual Federal Tax Return for Agricultural Employees', category: 'Payroll' },
  { formNumber: '944', title: 'Employers Annual Federal Tax Return', category: 'Payroll' },
  { formNumber: '1099-NEC', title: 'Nonemployee Compensation', category: 'Information' },
  { formNumber: '1099-MISC', title: 'Miscellaneous Information', category: 'Information' },
  { formNumber: '1099-INT', title: 'Interest Income', category: 'Information' },
  { formNumber: '1099-DIV', title: 'Dividends and Distributions', category: 'Information' },
  { formNumber: '1099-R', title: 'Distributions From Pensions', category: 'Information' },
  { formNumber: '1099-K', title: 'Payment Card and Third Party Network Transactions', category: 'Information' },
  { formNumber: '2848', title: 'Power of Attorney and Declaration of Representative', category: 'Administrative' },
  { formNumber: '433-A', title: 'Collection Information Statement for Wage Earners', category: 'Collection' },
  { formNumber: '433-B', title: 'Collection Information Statement for Businesses', category: 'Collection' },
  { formNumber: '433-F', title: 'Collection Information Statement', category: 'Collection' },
  { formNumber: '9465', title: 'Installment Agreement Request', category: 'Collection' },
  { formNumber: '4506-T', title: 'Request for Transcript of Tax Return', category: 'Administrative' },
  { formNumber: '8822', title: 'Change of Address', category: 'Administrative' },
  { formNumber: '56', title: 'Notice Concerning Fiduciary Relationship', category: 'Administrative' },
  { formNumber: '8821', title: 'Tax Information Authorization', category: 'Administrative' },
  { formNumber: '656', title: 'Offer in Compromise', category: 'Collection' },
  { formNumber: '843', title: 'Claim for Refund and Request for Abatement', category: 'Administrative' },
  { formNumber: '8857', title: 'Request for Innocent Spouse Relief', category: 'Individual' },
  { formNumber: '8379', title: 'Injured Spouse Allocation', category: 'Individual' },
  { formNumber: '4868', title: 'Application for Automatic Extension of Time', category: 'Individual' },
  { formNumber: '7004', title: 'Application for Automatic Extension (Business)', category: 'Business' },
  { formNumber: '2553', title: 'Election by a Small Business Corporation', category: 'Business' },
  { formNumber: '8832', title: 'Entity Classification Election', category: 'Business' },
  { formNumber: '5471', title: 'Information Return of U.S. Persons With Respect to Certain Foreign Corporations', category: 'International' },
  { formNumber: '5472', title: 'Information Return of a 25% Foreign-Owned U.S. Corporation', category: 'International' },
  { formNumber: '8938', title: 'Statement of Specified Foreign Financial Assets', category: 'International' },
  { formNumber: '3520', title: 'Annual Return To Report Transactions With Foreign Trusts', category: 'International' },
  { formNumber: '3520-A', title: 'Annual Information Return of Foreign Trust', category: 'International' },
  { formNumber: '8865', title: 'Return of U.S. Persons With Respect to Certain Foreign Partnerships', category: 'International' },
  { formNumber: '8858', title: 'Information Return of U.S. Persons With Respect to Foreign Disregarded Entities', category: 'International' },
  { formNumber: '8995', title: 'Qualified Business Income Deduction Simplified Computation', category: 'Individual' },
  { formNumber: '8995-A', title: 'Qualified Business Income Deduction', category: 'Individual' },
  { formNumber: '4562', title: 'Depreciation and Amortization', category: 'Business' },
  { formNumber: '4797', title: 'Sales of Business Property', category: 'Business' },
  { formNumber: '6251', title: 'Alternative Minimum Tax—Individuals', category: 'Individual' },
  { formNumber: '8959', title: 'Additional Medicare Tax', category: 'Individual' },
  { formNumber: '8960', title: 'Net Investment Income Tax', category: 'Individual' },
  { formNumber: '8889', title: 'Health Savings Accounts', category: 'Individual' },
  { formNumber: '8606', title: 'Nondeductible IRAs', category: 'Individual' },
  { formNumber: '5329', title: 'Additional Taxes on Qualified Plans', category: 'Individual' },
  { formNumber: '2441', title: 'Child and Dependent Care Expenses', category: 'Individual' },
  { formNumber: '8863', title: 'Education Credits', category: 'Individual' },
  { formNumber: '5695', title: 'Residential Energy Credits', category: 'Individual' },
  { formNumber: '8283', title: 'Noncash Charitable Contributions', category: 'Individual' },
  { formNumber: '8949', title: 'Sales and Other Dispositions of Capital Assets', category: 'Individual' },
  { formNumber: '2210', title: 'Underpayment of Estimated Tax by Individuals', category: 'Individual' },
  { formNumber: '8886', title: 'Reportable Transaction Disclosure Statement', category: 'Business' },
  { formNumber: '926', title: 'Return by a U.S. Transferor of Property to a Foreign Corporation', category: 'International' },
  { formNumber: '8621', title: 'Information Return by a Shareholder of a PFIC', category: 'International' },
  { formNumber: '1116', title: 'Foreign Tax Credit', category: 'International' },
  { formNumber: '2555', title: 'Foreign Earned Income', category: 'International' },
  { formNumber: '8936', title: 'Clean Vehicle Credit', category: 'Individual' },
  { formNumber: '720', title: 'Quarterly Federal Excise Tax Return', category: 'Excise' },
  { formNumber: '2290', title: 'Heavy Highway Vehicle Use Tax Return', category: 'Excise' },
  { formNumber: '1041', title: 'U.S. Income Tax Return for Estates and Trusts', category: 'Estates' },
  { formNumber: '706', title: 'U.S. Estate Tax Return', category: 'Estates' },
  { formNumber: '709', title: 'U.S. Gift Tax Return', category: 'Estates' },
  { formNumber: '1042', title: 'Annual Withholding Tax Return for U.S. Source Income of Foreign Persons', category: 'International' },
  { formNumber: '1042-S', title: 'Foreign Person U.S. Source Income Subject to Withholding', category: 'International' },
  { formNumber: '8802', title: 'Application for U.S. Residency Certification', category: 'International' },
  { formNumber: '8854', title: 'Initial and Annual Expatriation Statement', category: 'International' },
  { formNumber: '8862', title: 'Information To Claim Earned Income Credit After Disallowance', category: 'Individual' },
  { formNumber: '8867', title: 'Paid Preparers Earned Income Credit Checklist', category: 'Individual' },
  { formNumber: '8868', title: 'Application for Extension of Time (Exempt Organizations)', category: 'Nonprofit' },
  { formNumber: '1023', title: 'Application for Recognition of Exemption Under Section 501(c)(3)', category: 'Nonprofit' },
  { formNumber: '1024-A', title: 'Application for Recognition of Exemption Under Section 501(c)(4)', category: 'Nonprofit' },
  { formNumber: '8716', title: 'Election To Have a Tax Year Other Than a Required Tax Year', category: 'Partnership' },
  { formNumber: '8082', title: 'Notice of Inconsistent Treatment or Administrative Adjustment Request', category: 'Partnership' },
  { formNumber: '8300', title: 'Report of Cash Payments Over $10,000', category: 'Information' },
  { formNumber: '8308', title: 'Report of a Sale or Exchange of Certain Partnership Interests', category: 'Partnership' },
  { formNumber: '8594', title: 'Asset Acquisition Statement', category: 'Business' },
  { formNumber: '8883', title: 'Asset Allocation Statement Under Section 338', category: 'Business' },
  { formNumber: '8888', title: 'Allocation of Refund', category: 'Individual' },
  { formNumber: '8940', title: 'Request for Miscellaneous Determination', category: 'Nonprofit' },
  { formNumber: '8971', title: 'Information Regarding Beneficiaries Acquiring Property From a Decedent', category: 'Estates' },
  { formNumber: '8990', title: 'Limitation on Business Interest Expense', category: 'Business' },
  { formNumber: '8992', title: 'U.S. Shareholder Calculation of GILTI', category: 'International' },
  { formNumber: '8993', title: 'Section 250 Deduction for Foreign-Derived Intangible Income', category: 'International' },
  { formNumber: '8994', title: 'Employer Credit for Paid Family and Medical Leave', category: 'Employment' },
  { formNumber: '8996', title: 'Qualified Opportunity Fund', category: 'Investment' },
];

export function irsFormKind(formNumber: string): string {
  const slug = formNumber.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `us_irs_form_${slug}`;
}

export function buildIrsPrompt(meta: IrsFormMeta): string {
  return `You are preparing IRS Form ${meta.formNumber} (${meta.title}) — ${meta.category}. Follow official IRS form instructions: taxpayer identification, income/deduction sections, schedules as applicable, computations, signatures, and paid preparer blocks. Use descriptive [BLANK] placeholders for all fields. Apply IRC citations where relevant.`;
}

export function resolveIrsPrompt(formNumber: string): string | null {
  const meta = IRS_FORMS.find((f) => f.formNumber.toLowerCase() === formNumber.toLowerCase());
  if (!meta) return null;
  return buildIrsPrompt(meta);
}

export function resolveIrsPromptByKind(kind: string): string | null {
  if (!kind.startsWith('us_irs_form_')) return null;
  const slug = kind.replace('us_irs_form_', '');
  const meta = IRS_FORMS.find((f) => irsFormKind(f.formNumber) === kind);
  if (meta) return buildIrsPrompt(meta);
  return `You are preparing IRS tax form (${slug.replace(/_/g, ' ')}). Follow official IRS instructions structure with [BLANK] placeholders for all required fields.`;
}

export const IRS_FORM_CATALOG = IRS_FORMS;
