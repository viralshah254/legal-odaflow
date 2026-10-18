import type { MatterNature } from '../matter-intelligence.types';

export interface GoldenFixtureExpectation {
  practiceArea: string;
  subPracticeArea?: string;
  nature: MatterNature;
  documentKind?: string;
}

export interface GoldenFixture {
  id: string;
  label: string;
  facts: string;
  expected: GoldenFixtureExpectation;
}

/** Arjun Patel wrongful termination — labour dispute, not contract drafting. */
export const ARJUN_WRONGFUL_TERMINATION_FACTS = `
Arjun Patel, aged 42, was employed as Senior Operations Manager at TechFlow Solutions Pvt Ltd
since March 2019 on a monthly salary of ₹1,85,000. On 15 January 2025 he was terminated
without notice or domestic inquiry. The termination letter dated 15 January 2025 cited
"loss of confidence" but no show-cause notice was issued and no inquiry was held.
Arjun believes he qualifies as a workman under the Industrial Disputes Act. He seeks
reinstatement with continuity of service and back wages from the date of illegal termination.
The employer violated principles of natural justice and retrenched him without compliance
with ID Act requirements.
`.trim();

export const NEHA_SHARMA_MAINTENANCE_FACTS = `
Mrs. Neha Sharma married Mr. Rohit Sharma on 15 February 2021 according to Hindu rites. After one year of marriage, disputes arose. Neha alleges that Rohit and his family demanded additional dowry and subjected her to mental cruelty. She left the matrimonial home on 10 June 2023 and has been living with her parents in Ahmedabad.
Neha has no independent source of income. Rohit is employed as a software engineer earning approximately ₹1,20,000 per month.
Neha filed a petition seeking interim maintenance before the Family Court under the applicable matrimonial law. She requested ₹30,000 per month for her maintenance during the pendency of the proceedings.
Rohit opposed the application, alleging that Neha is well-qualified and capable of earning.
The Family Court dismissed Neha's application, observing only:
"The applicant is educated and capable of maintaining herself. No case for grant of interim maintenance is made out."
Feeling aggrieved, Neha wishes to challenge the order before the higher court.
Assignment: Draft a Criminal Revision Petition challenging the order rejecting interim maintenance
`.trim();

/** Kavita Shah — agreement to sell breach; must not route to rent or ATS drafting. */
export const KAVITA_SPECIFIC_PERFORMANCE_FACTS = `
Mrs. Kavita Shah agreed to purchase a residential plot from Mr. Rakesh Mehta for ₹45 lakhs.
An Agreement to Sell was executed on 10 March 2024.
Kavita paid ₹20 lakhs as advance.
Before execution of the sale deed, Rakesh sold the property to a third party.
Kavita wants:
* Specific performance
* Injunction
* Alternatively damages
`.trim();

export const GOLDEN_FIXTURES: GoldenFixture[] = [
  {
    id: 'arjun-employment',
    label: 'Arjun Patel wrongful termination',
    facts: ARJUN_WRONGFUL_TERMINATION_FACTS,
    expected: {
      practiceArea: 'employment_labour',
      subPracticeArea: 'wrongful_termination',
      nature: 'dispute',
      documentKind: 'wrongful_termination_petition',
    },
  },
  {
    id: 'maintenance-revision',
    label: 'Maintenance order revision',
    facts: `
My client received an interim maintenance order under BNSS Section 144 on 10 March 2024
directing ₹12,000 per month. Husband's income has increased substantially since the affidavits
were filed. We wish to file a revision petition challenging the quantum as inadequate and
seek enhancement to ₹35,000 per month. The impugned order is attached.
    `.trim(),
    expected: {
      practiceArea: 'family_matrimonial',
      subPracticeArea: 'maintenance',
      nature: 'dispute',
      documentKind: 'maintenance_order_revision',
    },
  },
  {
    id: 'bail-application',
    label: 'Anticipatory bail after FIR',
    facts: `
FIR No. 245/2025 was registered at Sector 18 Police Station, Noida under IPC/BNS sections
for cheating. My client apprehends arrest. He has cooperated with investigation and seeks
anticipatory bail before the Sessions Court. Copy of FIR and charge sheet summary attached.
    `.trim(),
    expected: {
      practiceArea: 'litigation_disputes',
      subPracticeArea: 'criminal_fir_bail',
      nature: 'dispute',
      documentKind: 'bail_application',
    },
  },
  {
    id: 'consumer-complaint',
    label: 'Defective product consumer complaint',
    facts: `
Purchased a laptop from TechMart on 5 December 2024 for ₹78,000. Within two weeks the device
developed a motherboard defect. Seller refused refund despite repeated complaints and
deficiency in service. Consumer wants to file a consumer complaint before the District
Consumer Disputes Redressal Commission seeking refund and compensation.
    `.trim(),
    expected: {
      practiceArea: 'consumer',
      subPracticeArea: 'defective_product',
      nature: 'dispute',
      documentKind: 'consumer_complaint',
    },
  },
  {
    id: 'neha-sharma-maintenance',
    label: 'Neha Sharma Family Court interim maintenance revision',
    facts: NEHA_SHARMA_MAINTENANCE_FACTS,
    expected: {
      practiceArea: 'family_matrimonial',
      subPracticeArea: 'maintenance',
      nature: 'dispute',
      documentKind: 'maintenance_order_revision',
    },
  },
  {
    id: 'kavita-specific-performance',
    label: 'Kavita Shah agreement to sell / specific performance',
    facts: KAVITA_SPECIFIC_PERFORMANCE_FACTS,
    expected: {
      practiceArea: 'real_estate_property',
      subPracticeArea: 'specific_performance',
      nature: 'dispute',
      documentKind: 'civil_plaint',
    },
  },
  {
    id: 'nda-drafting',
    label: 'Mutual NDA for vendor onboarding',
    facts: `
Our startup is onboarding a software development vendor and needs to draft a mutual
non-disclosure agreement before sharing product roadmaps and source code. Please prepare
an NDA defining confidential information, term, and permitted disclosures.
    `.trim(),
    expected: {
      practiceArea: 'corporate_commercial',
      subPracticeArea: 'nda',
      nature: 'transaction',
      documentKind: 'nda',
    },
  },
];

export const DRAFT_EMPLOYMENT_CONTRACT_QUERY =
  'Please draft an employment contract and offer letter for our new hire joining next month.';

export const WRONGFULLY_TERMINATED_QUERY =
  'I was wrongfully terminated without notice and want to challenge the dismissal.';
