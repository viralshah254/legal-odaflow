/** Fixtures for bail-first platform accuracy evals */

export const ROHAN_CASE_DETAILS = `Rohan Mehta v. State. FIR No. 42/2026 dated 17 February 2026, PS Cyber Crime.
Accused Rohan Mehta arrested 19 February 2026. Chargesheet filed 15 April 2026.
Co-accused granted bail. Defence: no CCTV produced; forensic imaging after seizure;
Wi-Fi / IP address alone insufficient; CDR issues; shopkeeper statement; intimidation;
cash recovery disputed. Seek regular bail under BNSS §480/§483.`;

export const ROHAN_GOOD_DRAFT = `IN THE SESSIONS COURT
Applicant–Accused: Rohan Mehta
FIR dated 17 February 2026. Arrested 19 February 2026. Chargesheet filed under BNSS §193 on 15 April 2026.
GROUNDS FOR BAIL:
A) Bail is the rule — Satender Kumar Antil v. CBI (2022) 10 SCC 51.
B) CCTV not produced as stated in defence — Prasanta Kumar Sarkar v. Ashis Chatterjee (2010) 14 SCC 496.
C) Forensic imaging timeline — Sanjay Chandra v. CBI (2012) 1 SCC 40.
D) Parity with co-accused granted bail — Satender Kumar Antil v. CBI (2022) 10 SCC 51.
E) Wi-Fi / IP insufficiency — Arnesh Kumar v. State of Bihar (2014) 8 SCC 273.
PRAYER: Enlarge Applicant–Accused on bail.
VERIFICATION.`;

export const ROHAN_BAD_DRAFTS = [
  {
    id: 'wrong-fir-date',
    draft: `Applicant–Accused Rohan Mehta. FIR dated 19 February 2026. Chargesheet filed. PRAYER: bail.`,
    expectBlocker: /FIR|chronology|date/i,
  },
  {
    id: 'investigation-pending',
    draft: `Applicant–Accused Rohan Mehta. FIR dated 17 February 2026. Investigation is still ongoing. Chargesheet filed 15 April 2026. PRAYER: bail.`,
    expectBlocker: /investigation|post_chargesheet|pending/i,
  },
  {
    id: 'curated-leak',
    draft: `Applicant–Accused Rohan Mehta. FIR dated 17 February 2026. Cite curated__prasanta_kumar_sarkar. PRAYER: bail.`,
    expectBlocker: /leak|curated|token/i,
  },
  {
    id: 'invented-cctv',
    draft: `Applicant–Accused Rohan Mehta. FIR dated 17 February 2026. CCTV clearly shows the accused at the scene. PRAYER: bail. VERIFICATION.`,
    expectBlocker: /CCTV|invent|entailment|fact/i,
  },
];

export type BailAdversarialFixture = {
  id: string;
  caseDetails: string;
  badDraft: string;
  forbid: RegExp[];
};

/** 20 adversarial bail fixtures */
export const BAIL_ADVERSARIAL_FIXTURES: BailAdversarialFixture[] = Array.from(
  { length: 20 },
  (_, i) => {
    const day = 10 + (i % 15);
    const arrestDay = day + 2;
    const csDay = day + 40;
    const caseDetails = `Accused TestAccused${i} v. State. FIR dated ${day} March 2026, PS Test.
Arrested ${arrestDay} March 2026. Chargesheet filed ${csDay > 31 ? `${csDay - 31} May 2026` : `${csDay} March 2026`}.
Defence: no recovery; parity with co-accused; digital attribution weak.
Seek regular bail BNSS 480.`;
    const badDraft =
      i % 4 === 0
        ? `Petitioner TestAccused${i}. FIR dated ${arrestDay} March 2026. Investigation pending. PRAYER: anticipatory bail.`
        : i % 4 === 1
          ? `Applicant–Accused TestAccused${i}. FIR dated ${day} March 2026. Cite [SOURCE_${i}]. PRAYER: bail.`
          : i % 4 === 2
            ? `Applicant–Accused TestAccused${i}. FIR dated ${day} March 2026. Investigation is still ongoing. PRAYER: bail.`
            : `Applicant–Accused TestAccused${i}. FIR dated ${day + 1} March 2026. Benefit of doubt. PRAYER: bail.`;
    return {
      id: `adv-bail-${i + 1}`,
      caseDetails,
      badDraft,
      forbid: [
        /investigation\s+(?:is\s+)?(?:still\s+)?ongoing/i,
        /\[SOURCE_\d+\]/i,
        /curated__/i,
        /benefit\s+of\s+doubt/i,
      ],
    };
  },
);

export function generateBailRegressionCases(n: number): Array<{ id: string; caseDetails: string }> {
  return Array.from({ length: n }, (_, i) => ({
    id: `gen-bail-${i + 1}`,
    caseDetails: `Accused GenPerson${i} v. State of Gujarat. FIR No. ${100 + i}/2026 dated ${(i % 27) + 1} January 2026, PS Cyber.
Arrested ${(i % 27) + 2} January 2026. Chargesheet filed 15 March 2026.
Co-accused granted bail. Defence fact ${i}: no CCTV; forensic delay; CDR incomplete.
Seek regular bail under BNSS §480.`,
  }));
}
