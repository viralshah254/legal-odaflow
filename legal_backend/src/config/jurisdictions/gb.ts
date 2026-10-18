import { DeepJurisdictionProfile } from './types';

export const GB_PROFILE: DeepJurisdictionProfile = {
  code: 'GB',
  name: 'United Kingdom',
  legalSystem: 'common_law',
  languageOfRecord: ['English', 'Welsh (in Wales)'],
  citationStyle: [
    '[<YYYY>] UKSC <n>  — Supreme Court',
    '[<YYYY>] UKHL <n>  — House of Lords (pre-2009)',
    '[<YYYY>] EWCA Civ <n> / EWCA Crim <n>  — Court of Appeal',
    '[<YYYY>] EWHC <n> (<Division>)  — High Court (e.g. (Ch), (QB)/(KB), (Fam))',
    'Scotland: [<YYYY>] CSIH <n> / [<YYYY>] CSOH <n>; [<YYYY>] UKSC for UK-wide appeals',
  ],
  courtHierarchy: [
    { name: 'Supreme Court of the United Kingdom', role: 'apex' },
    { name: 'Court of Appeal (England & Wales)', role: 'appellate' },
    { name: 'High Court of Justice (Chancery, KB, Family Divisions)', role: 'superior' },
    { name: 'Crown Court / County Court', role: 'trial' },
    { name: 'Magistrates Courts', role: 'trial (summary)' },
    { name: 'Tribunals (Employment Tribunal, First-tier & Upper Tribunal)', role: 'tribunal' },
    { name: 'Scotland: Court of Session / Sheriff Courts', role: 'superior/trial (Scotland)' },
  ],
  practiceAreas: [
    { name: 'Common law & equity', keyStatutes: ['case law', 'Senior Courts Act 1981'] },
    { name: 'Employment law', keyStatutes: ['Employment Rights Act 1996', 'Equality Act 2010', 'Trade Union and Labour Relations (Consolidation) Act 1992'] },
    { name: 'Company law', keyStatutes: ['Companies Act 2006', 'Insolvency Act 1986'] },
    { name: 'Housing law', keyStatutes: ['Housing Act 1988', 'Landlord and Tenant Act 1985', 'Renters (Reform) provisions'] },
    { name: 'Data protection & privacy', keyStatutes: ['UK GDPR', 'Data Protection Act 2018'] },
    { name: 'Contract law', keyStatutes: ['common law', 'Consumer Rights Act 2015', 'Sale of Goods Act 1979'] },
    { name: 'Tort', keyStatutes: ['common law', 'Occupiers Liability Acts', 'Defamation Act 2013'] },
    { name: 'Crime', keyStatutes: ['Theft Act 1968', 'Criminal Justice Act 2003', 'Police and Criminal Evidence Act 1984'] },
    { name: 'Family law', keyStatutes: ['Matrimonial Causes Act 1973', 'Children Act 1989', 'Family Law Act 1996'] },
    { name: 'Property & conveyancing', keyStatutes: ['Law of Property Act 1925', 'Land Registration Act 2002'] },
  ],
  adrPathways: [
    { mechanism: 'negotiation', isLegallyBinding: false },
    { mechanism: 'mediation', isLegallyBinding: false, note: 'Encouraged under the Civil Procedure Rules; binding once a settlement agreement is signed.' },
    { mechanism: 'early neutral evaluation', isLegallyBinding: false },
    { mechanism: 'arbitration', isLegallyBinding: true, note: 'Arbitration Act 1996.' },
  ],
  limitationNotes:
    'Governed by the Limitation Act 1980 (England & Wales). Typical periods: 6 years for contract and tort, 3 years for personal injury/defamation, 12 years for actions on a deed. Scotland uses the Prescription and Limitation (Scotland) Act 1973.',
  primaryLegislationStyle: 'UK Public General Acts on legislation.gov.uk; cases via The Incorporated Council of Law Reporting and BAILII neutral citations.',
};
