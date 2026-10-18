import { DeepJurisdictionProfile } from './types';

export const KE_PROFILE: DeepJurisdictionProfile = {
  code: 'KE',
  name: 'Kenya',
  legalSystem: 'mixed',
  languageOfRecord: ['English', 'Kiswahili'],
  citationStyle: [
    '[<YYYY>] eKLR  — Kenya Law Reports neutral citation',
    '[<YYYY>] KESC <n> (KLR)  — Supreme Court',
    '[<YYYY>] KECA <n> (KLR)  — Court of Appeal',
    '[<YYYY>] KEHC <n> (KLR)  — High Court',
    'Petition / Civil Case / Cause No. <n> of <YYYY>',
  ],
  courtHierarchy: [
    { name: 'Supreme Court of Kenya', role: 'apex' },
    { name: 'Court of Appeal', role: 'appellate' },
    { name: 'High Court', role: 'superior' },
    { name: 'Environment and Land Court (ELC)', role: 'superior (specialised)' },
    { name: 'Employment and Labour Relations Court (ELRC)', role: 'superior (specialised)' },
    { name: "Magistrates' Courts", role: 'trial (subordinate)' },
    { name: "Kadhis' Courts", role: 'specialised (Islamic personal status)' },
    { name: 'Tribunals (Rent, Business Premises, Tax Appeals, etc.)', role: 'tribunal' },
  ],
  practiceAreas: [
    { name: 'Constitutional law', keyStatutes: ['Constitution of Kenya 2010'] },
    { name: 'Land law', keyStatutes: ['Land Act 2012', 'Land Registration Act 2012', 'Environment and Land Court Act 2011'] },
    { name: 'Employment & labour', keyStatutes: ['Employment Act 2007', 'Labour Relations Act 2007', 'Work Injury Benefits Act 2007'] },
    { name: 'Criminal law', keyStatutes: ['Penal Code (Cap 63)', 'Criminal Procedure Code (Cap 75)'] },
    { name: 'Company & commercial', keyStatutes: ['Companies Act 2015', 'Insolvency Act 2015'] },
    { name: 'Family & succession', keyStatutes: ['Marriage Act 2014', 'Law of Succession Act (Cap 160)', 'Children Act 2022'] },
    { name: 'Taxation', keyStatutes: ['Income Tax Act (Cap 470)', 'Value Added Tax Act 2013', 'Tax Procedures Act 2015'] },
    { name: 'Tribunals', keyStatutes: ['Business Premises Rent Tribunal', 'Rent Restriction Tribunal', 'Tax Appeals Tribunal Act 2013'] },
    { name: 'Contract & tort', keyStatutes: ['common law', 'Law of Contract Act (Cap 23)'] },
  ],
  adrPathways: [
    { mechanism: 'negotiation', isLegallyBinding: false },
    { mechanism: 'mediation', isLegallyBinding: false, note: 'Court-Annexed Mediation under the Judiciary; binding once recorded as a settlement.' },
    { mechanism: 'traditional dispute resolution', isLegallyBinding: false, note: 'Recognised under Article 159(2)(c) of the Constitution where it does not offend the Bill of Rights.' },
    { mechanism: 'arbitration', isLegallyBinding: true, note: 'Arbitration Act 1995 (as amended).' },
  ],
  limitationNotes:
    'Governed by the Limitation of Actions Act (Cap 22). Typical periods: 6 years for contract, 3 years for tort, 12 years for recovery of land. Constitutional petitions are generally not time-barred.',
  primaryLegislationStyle: 'Laws of Kenya (Cap references) and the Kenya Gazette; cases via Kenya Law (kenyalaw.org) eKLR neutral citations.',
};
