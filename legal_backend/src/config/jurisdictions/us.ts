import { DeepJurisdictionProfile } from './types';

export const US_PROFILE: DeepJurisdictionProfile = {
  code: 'US',
  name: 'United States',
  legalSystem: 'common_law',
  languageOfRecord: ['English'],
  citationStyle: [
    '<vol> U.S. <page> (<YYYY>)  — e.g. 410 U.S. 113 (1973)',
    '<vol> S. Ct. <page> (<YYYY>)',
    '<vol> F.3d <page> (<Circuit> <YYYY>)  — e.g. 901 F.3d 1, (9th Cir. 2018)',
    '<vol> F. Supp. 3d <page> (<District> <YYYY>)',
    'State reporters, e.g. <vol> N.E.2d <page> (<State> <YYYY>)',
  ],
  courtHierarchy: [
    { name: 'Supreme Court of the United States', role: 'apex' },
    { name: 'U.S. Courts of Appeals (Circuit Courts)', role: 'appellate' },
    { name: 'U.S. District Courts', role: 'trial' },
    { name: 'State Supreme Courts', role: 'apex (state)' },
    { name: 'State Appellate Courts', role: 'appellate (state)' },
    { name: 'State Trial Courts (Superior/District/Circuit)', role: 'trial (state)' },
  ],
  practiceAreas: [
    { name: 'Federal statutes & regulation', keyStatutes: ['U.S. Code (U.S.C.)', 'Code of Federal Regulations (C.F.R.)'] },
    { name: 'State-specific law', keyStatutes: ['State codes & statutes', 'State constitutions'] },
    { name: 'Employment law', keyStatutes: ['Title VII (Civil Rights Act 1964)', 'FLSA', 'ADA', 'FMLA', 'state labor codes'] },
    { name: 'Contract law', keyStatutes: ['Uniform Commercial Code (UCC)', 'Restatement (Second) of Contracts', 'common law'] },
    { name: 'Civil litigation', keyStatutes: ['Federal Rules of Civil Procedure', 'state rules of civil procedure'] },
    { name: 'Criminal law', keyStatutes: ['18 U.S.C.', 'state penal codes', 'Federal Rules of Criminal Procedure'] },
    { name: 'Family law', keyStatutes: ['state family/domestic relations codes'] },
    { name: 'Intellectual property', keyStatutes: ['Patent Act (35 U.S.C.)', 'Copyright Act (17 U.S.C.)', 'Lanham Act'] },
    { name: 'Corporate & securities', keyStatutes: ['Delaware General Corporation Law', 'Securities Act 1933', 'Securities Exchange Act 1934'] },
    { name: 'Bankruptcy', keyStatutes: ['Bankruptcy Code (11 U.S.C.)'] },
    { name: 'Immigration', keyStatutes: ['Immigration and Nationality Act (INA)'] },
    { name: 'Real estate & property', keyStatutes: ['state property law', 'recording statutes'] },
  ],
  adrPathways: [
    { mechanism: 'negotiation', isLegallyBinding: false },
    { mechanism: 'mediation', isLegallyBinding: false, note: 'Binding only if parties sign a settlement agreement.' },
    { mechanism: 'arbitration', isLegallyBinding: true, note: 'Enforceable under the Federal Arbitration Act (FAA).' },
  ],
  limitationNotes:
    'Statutes of limitations vary by state and claim type (commonly 1-6 years). Federal claims have their own limitation periods. Always confirm the applicable state statute and any tolling/discovery rules.',
  primaryLegislationStyle: 'U.S. Code (U.S.C.), C.F.R., and state codes; cases via official and regional reporters.',
};
