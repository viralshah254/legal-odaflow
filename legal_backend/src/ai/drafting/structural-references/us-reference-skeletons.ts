/**
 * Curated structural reference skeletons for US filings.
 * Use [BLANK] for missing facts; never invent statutes or incidents.
 */

export interface UsDraftSkeleton {
  kind: string;
  causeTitleVehicle: string;
  mandatorySections: string[];
  referenceText: string;
}

export const US_REFERENCE_SKELETONS: UsDraftSkeleton[] = [
  {
    kind: 'us_state_criminal_complaint',
    causeTitleVehicle: 'CRIMINAL COMPLAINT',
    mandatorySections: ['State penal code (from grounding)', 'probable cause'],
    referenceText: `IN THE [BLANK: court name] OF [BLANK: county], [BLANK: state]
CRIMINAL COMPLAINT

Complainant: [BLANK: complainant name]
Defendant: [BLANK: defendant name]

I. JURISDICTION AND VENUE
This Court has jurisdiction under [BLANK: state statute / rule from grounding].

II. PROBABLE CAUSE / FACTS
1. On or about [BLANK: date], at [BLANK: location], Defendant [BLANK: conduct from intake only].
2. [BLANK: additional material facts — do not invent evidence]

III. OFFENSE(S) CHARGED
Count 1: Violation of [BLANK: state penal code section from grounding] ([BLANK: short title]).

IV. PRAYER
Wherefore, Complainant requests that process issue and Defendant be dealt with according to law.

[BLANK: signature / verification]`,
  },
  {
    kind: 'us_state_restraining_order',
    causeTitleVehicle: 'APPLICATION FOR RESTRAINING / PROTECTIVE ORDER',
    mandatorySections: ['relationship', 'abuse/harassment facts', 'relief'],
    referenceText: `IN THE [BLANK: court name] OF [BLANK: county], [BLANK: state]
APPLICATION FOR RESTRAINING / PROTECTIVE ORDER

Protected Person: [BLANK: name]
Respondent: [BLANK: name]

I. RELATIONSHIP
[BLANK: relationship from intake]

II. FACTS
1. On or about [BLANK: date], Respondent [BLANK: conduct from intake only].
2. [BLANK: further incidents — use BLANK if unknown; do not invent]

III. RELIEF REQUESTED
(a) Stay-away / no-contact order;
(b) [BLANK: other statutory relief];
(c) Such other relief as the Court deems just.

[BLANK: verification / signature]`,
  },
  {
    kind: 'us_state_bail_motion',
    causeTitleVehicle: 'MOTION FOR BAIL / BOND',
    mandatorySections: ['bail factors', 'proposed conditions'],
    referenceText: `IN THE [BLANK: court name]
MOTION FOR BAIL / PRETRIAL RELEASE

Defendant: [BLANK: name]
Case No.: [BLANK]

I. CUSTODIAL STATUS
Arrested on [BLANK: date]; currently detained at [BLANK: facility].

II. BAIL FACTORS
[BLANK: flight risk / danger / ties — from intake only]

III. PROPOSED CONDITIONS
[BLANK: conditions]

IV. PRAYER
Release on bond subject to conditions.

[BLANK: counsel signature]`,
  },
  {
    kind: 'us_federal_criminal_complaint',
    causeTitleVehicle: 'FEDERAL CRIMINAL COMPLAINT',
    mandatorySections: ['Fed. R. Crim. P. 3', '18 U.S.C. (from grounding)'],
    referenceText: `UNITED STATES DISTRICT COURT
FOR THE [BLANK: district]

UNITED STATES OF AMERICA
v.
[BLANK: defendant]

CRIMINAL COMPLAINT
(Fed. R. Crim. P. 3)

I. PROBABLE CAUSE
On or about [BLANK: date], in [BLANK: district], Defendant [BLANK: conduct from intake].

II. OFFENSE
Violation of [BLANK: 18 U.S.C. section from grounding only — do not invent].

III. AFFIANT
[BLANK: agent name / title]

[BLANK: signature / jurat]`,
  },
  {
    kind: 'us_state_civil_complaint',
    causeTitleVehicle: 'CIVIL COMPLAINT',
    mandatorySections: ['jurisdiction', 'counts', 'prayer'],
    referenceText: `IN THE [BLANK: court name] OF [BLANK: county], [BLANK: state]
CIVIL COMPLAINT

Plaintiff: [BLANK]
Defendant: [BLANK]

I. PARTIES AND JURISDICTION
[BLANK]

II. FACTS
1. [BLANK: material facts from intake only]

III. CAUSES OF ACTION
Count I — [BLANK: claim]
[BLANK]

IV. PRAYER FOR RELIEF
[BLANK]

[BLANK: signature / verification]`,
  },
  {
    kind: 'us_state_domestic_violence_petition',
    causeTitleVehicle: 'PETITION FOR PROTECTIVE ORDER',
    mandatorySections: ['relationship', 'abuse facts', 'relief'],
    referenceText: `IN THE [BLANK: court name]
PETITION FOR DOMESTIC VIOLENCE PROTECTIVE ORDER

Petitioner: [BLANK]
Respondent: [BLANK]

I. RELATIONSHIP
[BLANK]

II. INCIDENTS OF ABUSE
1. On or about [BLANK: date], Respondent [BLANK: facts from intake].

III. RELIEF
[BLANK: statutory reliefs]

[BLANK: verification]`,
  },
];

export function getUsSkeletonForKind(kind: string): UsDraftSkeleton | null {
  return US_REFERENCE_SKELETONS.find((s) => s.kind === kind) ?? null;
}
