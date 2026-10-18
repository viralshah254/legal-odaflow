import type { CitationEvalOutput } from './citation-eval-metrics';

export const UPI_REGRESSION_QUERY =
  'An unauthorised UPI transaction was followed by a loan-app recovery demand and adverse CIBIL reporting. Assess bank, lender and app responsibility, forums, electronic evidence, and urgent relief in India.';

export const UPI_GOLDEN_RESEARCH_OUTPUT = `
## Legal framework and responsibility
The bank and RBI regulated entity (RE)/lender must be analysed separately from the lending service provider (LSP), loan app, payment intermediary, and recovery agent. The analysis must trace KYC and onboarding consent, the key fact statement, creation of the loan account, disbursal and repayment funds flow, beneficiary and account statements, and device and transaction records. It must also examine grievance handling and recovery-agent identity and conduct.

## Required complaints and forums
First lodge a written complaint with the bank and regulated lender through their grievance/nodal-officer process, seeking investigation, records, reversal, and a final response. If the covered regulated entity rejects the complaint, gives an unsatisfactory response, or does not respond within the Scheme period, assess eligibility, exclusions, limitation, filing through RBI CMS, and relief under the RBI Integrated Ombudsman Scheme.

A Consumer Commission complaint should separately plead deficiency in service and unfair trade practice under the Consumer Protection Act, 2019, with consumer status, territorial and pecuniary jurisdiction, limitation, evidence, and relief. Promptly report the fraud through 1930/National Cyber Crime Reporting Portal and the cybercrime police station; reporting does not guarantee an FIR or recovery.

Because loan liability, recovery, and adverse credit reporting are disputed, assess a civil suit for declaration of non-liability and temporary/permanent injunction, including jurisdiction, limitation, prima facie case, balance of convenience, and irreparable harm.

## Evidence and authorities
Electronic UPI, device, account, and platform records require proof under the Bharatiya Sakshya Adhiniyam, 2023. Consumer deficiency and unfair-practice remedies arise under the Consumer Protection Act, 2019.
`.trim();

export const UPI_CITATION_EVAL_OUTPUT: CitationEvalOutput = {
  inputQuery: UPI_REGRESSION_QUERY,
  outputMarkdown: UPI_GOLDEN_RESEARCH_OUTPUT,
  citations: [
    {
      quotedText: 'Electronic records are admissible subject to the statutory conditions.',
      paragraphRef: 's. 63',
      authority: {
        title: 'Bharatiya Sakshya Adhiniyam, 2023',
        citation: 'BSA s. 63',
        authorityType: 'STATUTE',
        summary: 'Electronic records are admissible subject to the statutory conditions.',
        topics: ['electronic evidence', 'UPI records'],
      },
    },
    {
      quotedText: 'A consumer may institute a complaint before the competent Commission.',
      paragraphRef: 's. 35',
      authority: {
        title: 'Consumer Protection Act, 2019',
        citation: 'CPA 2019 s. 35',
        authorityType: 'STATUTE',
        summary: 'A consumer may institute a complaint before the competent Commission.',
        topics: ['consumer complaint', 'deficiency in banking service'],
      },
    },
  ],
};

export const UPI_OFF_POINT_AUTHORITIES = [
  {
    title: 'Prevention of Money Laundering Act, 2002',
    citation: 'PMLA s. 11',
    fullText: 'Power regarding records in money-laundering proceedings.',
  },
  {
    title: 'Code of Civil Procedure, 1908',
    citation: 'CPC s. 35',
    fullText: 'Costs of civil litigation.',
  },
  {
    title: 'Real Estate (Regulation and Development) Act, 2016',
    citation: 'RERA s. 40',
    fullText: 'Recovery of interest, penalty and compensation from promoters.',
  },
];

