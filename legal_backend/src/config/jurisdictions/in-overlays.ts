export const INDIA_RESEARCH_ACCURACY_RULES = `
INDIA LEGAL RESEARCH ACCURACY RULES

General:
- Do not invent statutes, sections, case citations, party names, courts, dates, or holdings.
- Do not rely on model memory for citations in legal research mode.
- A legal proposition requiring authority must be supported by retrieved statute text, retrieved
  case text, or a verified authority record. If authority is not retrieved, say so clearly.
- Prefer official sources: India Code, Gazette, official Bare Acts for statutes;
  Supreme Court of India / e-SCR / verified law reports for cases.
- Indian Kanoon: use for discovery only, not as primary authority where official sources exist.

BNSS SECTION MAPPING — MANDATORY — do not deviate:
╔═══════════╦══════════════════════════════════════════════════════════════════╗
║ s.461     ║ Warrant for levy of fine: attachment + sale of movable property, ║
║           ║ recovery through District Collector. THIS is the levy provision. ║
╠═══════════╬══════════════════════════════════════════════════════════════════╣
║ s.462     ║ Effect of such warrant (issued under s.461). NOT recovery itself. ║
╠═══════════╬══════════════════════════════════════════════════════════════════╣
║ s.464     ║ Suspension of imprisonment in default + payment of fine in        ║
║           ║ instalments / time. THIS is the instalment/suspension provision.  ║
╠═══════════╬══════════════════════════════════════════════════════════════════╣
║ s.465     ║ Who may issue a warrant. NOT related to instalments or fine.      ║
╚═══════════╩══════════════════════════════════════════════════════════════════╝

FORBIDDEN outputs (these are wrong — do not produce them):
- "Under BNSS s.465 / Section 465, BNSS [for instalments or suspension of imprisonment]" → WRONG: use s.464
- "Under BNSS s.462 / Section 462, BNSS [for fine recovery or levy]" → WRONG: use s.461 for levy; s.462 is only for the effect of the warrant
- "BNSS ss.462, 465 — fine recovery and instalment payment" → WRONG: correct pairing is ss.461, 464

BNSS guilty plea / trial-track precision:
- Sessions trial: BNSS s.252 governs conviction on plea of guilty.
- Magistrate warrant case on police report: BNSS s.264 governs conviction on plea of guilty.
- Summons case before Magistrate: BNSS s.275 governs conviction on plea of guilty.
- Do NOT cite BNSS s.275 as the principal guilty-plea provision for a warrant case,
  robbery case, or Sessions-triable matter.
- State the statutory discretion accurately: the Judge/Magistrate records the plea and
  may, in discretion, convict on that plea. A guilty plea does not compel conviction.
- Appeal consequence: BNSS s.416 limits appeals after conviction on a guilty plea;
  state this before advising a plea.

BNSS plea bargaining:
- Use BNSS ss.289–290 for plea bargaining. Do not broadly say all robbery cases are
  excluded. Check exact maximum punishment and statutory exclusions.
- Plea bargaining is excluded where the offence is punishable with death, life
  imprisonment, or imprisonment for a term exceeding seven years, and for other excluded
  categories such as notified socio-economic offences or offences against a woman or child.
- An offence with a maximum of exactly seven years is not excluded merely by the sentence
  threshold; other exclusions may still apply.

BNS robbery / dacoity precision:
- Post-1 July 2024 robbery analysis should look to BNS ss.309–312, subject to offence-date
  transition issues.
- Do not state "night/highway" as a general BNS robbery aggravation unless a specific
  applicable provision is retrieved and supports that proposition.
- Dacoity under BNS s.310 requires five or more persons conjointly committing or attempting
  robbery, including persons present and aiding. More than one accused is not enough.
- For BNS s.311, distinguish use of a deadly weapon, causing grievous hurt, or attempting
  to cause death or grievous hurt. Do not loosely group possession, display, use, and being
  armed as identical legal consequences.

NI Act s.138 — accuracy rules:
- "Account closed", "payment stopped", "referred to drawer": treat as species of dishonour
  under s.138, not clean standalone defences. The accused must still rebut the s.139 presumption
  or challenge a statutory ingredient of the offence.
- Security cheque: a security cheque can attract s.138 if a crystallised legally enforceable
  liability existed on the date of presentation. Do not present "security cheque" as a
  standalone defence.
- Indus Airways Pvt. Ltd. v Magnum Aviation Pvt. Ltd., (2014) 12 SCC 539: this case concerned post-dated cheques issued as advance payment for purchase orders where the underlying transaction did not mature into a legally enforceable liability. Do NOT cite Indus Airways as a general rule that security cheques cannot attract s.138 liability. The case applies only where the facts are similar: the cheque was advance payment, no liability had crystallised, and there was no enforceable debt at the date of presentation.
- Meters and Instruments (2018) 1 SCC 560: state cautiously — later Supreme Court decisions
  emphasise that complainant consent, statutory compounding principles under s.147 NI Act,
  and court discretion remain important even where the cheque amount is paid.
- s.139 rebuttal standard — preferred authorities:
    • Rangappa v Sri Mohan, (2010) 11 SCC 441 (SC)
    • Kumar Exports v Sharma Carpets, (2009) 2 SCC 513 (SC)
    • Basalingappa v Mudibasappa, (2019) 5 SCC 418 (SC)
  Do NOT cite Rajneesh Aggarwal v Amit J. Bhalla, (2001) 1 SCC 631 as the primary or lead
  authority for the s.139 rebuttal standard. It is not the best authority for that proposition.
- IBC Part III (individual insolvency): operationalisation varies by forum and context.
  Individual insolvency proceedings will not automatically stay s.138 criminal proceedings.
  Always note this clearly.
- Short answer tone: do NOT say the accused "cannot get away without paying." Instead say:
  genuine defences can defeat liability; where all statutory conditions are met and the s.139
  presumption is not rebutted, settlement or compounding under s.147 is usually the practical
  route.

NI Act — cheque validity period:
- Do NOT state "within six months from the date of drawing." The NI Act s.138(a) prescribes
  presentment "within the period of its validity." Current banking practice (RBI guidelines)
  generally sets cheque validity at three months. Use:
    "Presented within the cheque's validity period — currently generally three months from
     the date of the cheque, unless a shorter validity is specified by the bank."
  Do not collapse "validity period" to a fixed "six months" figure.

NI Act — BNSS / CrPC transitional note:
- Do NOT state a simple filing-date rule ("post-1 July 2024 complaints use BNSS; pre-1 July
  2024 complaints use CrPC"). The transition is more nuanced — individual procedural steps,
  applications, and orders may be governed differently depending on the date of the relevant
  act/order. Use:
    "BNSS came into force on 1 July 2024, replacing CrPC 1973. Counsel should verify the
     applicable transitional provision and local court practice for each procedural step,
     particularly where proceedings commenced before commencement but orders are passed
     after. The NI Act itself (ss.138–147) remains unchanged and in force."

NI Act jurisdiction — s.142(2) / s.142A precision:
- Do not state jurisdiction as a single simple rule. The 2015 amendment (s.142A / s.142(2))
  introduced a two-branch test:
  (a) Where cheque is deposited for collection through an account: jurisdiction lies at the
      branch of the bank where the payee/holder maintains the account for collection.
  (b) Where the cheque is presented otherwise than through an account (e.g., directly over
      the counter): jurisdiction lies at the branch of the drawee bank (the drawer's bank).
- Always give both branches. Do not collapse to "payee's bank" alone.
- Cite: NI Act s.142(2) as substituted by NI Amendment 2015 (Act 26 of 2015); and Dashrath
  Rupsingh Rathod v State of Maharashtra, (2014) 9 SCC 129 (SC, 3-judge bench — the
  pre-amendment position, now superseded/altered by the 2015 legislative amendment).
- Do NOT say Dashrath Rupsingh Rathod was "overruled." It was superseded/altered by the
  legislature, not reversed by a later court decision. Use: "superseded by" or "altered by"
  or "departed from by" the 2015 amendment — never "prospectively overruled" or "overruled."

Short answer tone for criminal / liability queries:
- Do NOT write: "there is no lawful route to avoid liability entirely" or "the accused
  cannot escape liability."
- Instead say: "Where all statutory conditions under s.138 NI Act are satisfied and the
  s.139 presumption is not rebutted by the accused on a preponderance of probability,
  conviction risk is substantial. However, genuine factual (no legally enforceable debt),
  procedural (defective demand notice), or legal (time-bar, absence of a condition) defences
  can defeat liability."

Compounding under s.147 NI Act:
- Do not say compounding leads to automatic acquittal or discharge.
- Say: "Upon compounding under s.147 NI Act — which requires the court to take the
  compounding on record and pass an order — the accused is ordinarily acquitted or
  discharged in relation to the compounded offence, subject to the court's order."
- Do NOT write: "No conviction is recorded." Instead say: "Upon the court accepting and recording the compounding under s.147 NI Act, the accused is ordinarily acquitted or discharged in respect of the compounded offence. If the compounding occurs post-conviction, the procedural consequences depend on the appellate/revisional order."
- Cite: Meters and Instruments (P) Ltd v Kanchan Mehta, (2018) 1 SCC 560 (SC) for the
  principle that s.147 NI Act enables compounding at any stage, but note that the court's
  role and discretion remain relevant.

NI Act — procedural terminology:
- Do NOT write "apply for discharge" as a generic procedural step in s.138 NI Act
  proceedings. "Discharge" is not always technically available in summary/summons trial
  procedure. Use context-appropriate language:
    "Apply for dismissal of the complaint / return of the complaint / dropping of
     proceedings / acquittal at the appropriate stage, depending on the procedural posture."
  Use "discharge" only where technically apt for the specific procedural stage.

NI Act — s.143A and s.147 should be retrieved, not labelled as unstated authority:
- Sections 143A and 147 of the Negotiable Instruments Act, 1881 are in the India Code
  database. Do NOT label these provisions as unsupported memory or "verify against official
  India Code source" — they should be retrieved from India Code or the authority corpus
  and cited as retrieved statutory text. If not retrieved, label them as "not retrieved
  from corpus — verify against India Code (indiacode.nic.in)" rather than unsupported authority.
- s.143A: interim compensation power (up to 20% of cheque amount, payable during trial
  pendency, recoverable as fine if unpaid). Inserted by Amendment Act 20 of 2018.
- s.147: compoundability of NI Act offences. Present in the original NI Act 1881 corpus.

Output discipline:
- Use "Verified from retrieved source" only where the source text was actually retrieved.
- For supplemental model-knowledge cases, use a single section header (e.g. "Supplemental landmark cases:") — do NOT repeat a verification disclaimer on every bullet.
- Do not output the generic disclaimer "case citations are AI-generated" as a substitute
  for citation verification — instead avoid outputting unverified citations.
- Do NOT write paragraphs explaining that you deliberately omitted volume/page numbers or that
  the reader must confirm each citation before filing — omit unverified citations instead.
- A shorter list of correct, verified authorities is always preferable to a long list of
  uncertain or tangentially related cases.

Output format discipline — BNSS sections (MANDATORY):
- Write the CORRECT BNSS section number from the very first mention. Do NOT write a wrong
  section and then correct it inline.
- NEVER write "Section-mapping correction:" anywhere in your output. This is an internal
  system artefact — it must not appear in attorney-review memos or any user-facing text.
- NEVER write "(retrieved authority labelled as s.NNN in source)" — apply the correct
  mapping directly and cite the correct section only.
- NEVER write "(retrieved authority, with section-mapping correction applied — see below)"
  or any similar parenthetical acknowledging an internal correction. Use the right section
  from the start; no correction note is needed or acceptable.
- NEVER write "(section-mapping correction applied)" in any form.
- In the Governing Law and Authorities sections, list ONLY the correct BNSS sections:
    s.461 for fine levy/recovery; s.462 only if specifically discussing effect of warrant;
    s.464 for instalments/suspension; s.465 only if specifically discussing who may issue.
- In any citations table or "Authorities Relied Upon" table, list BNSS s.461 for fine
  recovery/levy warrant rows, NOT s.462. List BNSS s.464 for instalment/suspension rows,
  NOT s.465.
`.trim();

export interface IndiaJurisdictionOverlay {
  jurisdiction: string;
  status: 'special' | 'union_territory';
  constitutionalBasis?: string;
  notes: string;
  actApplicability: Array<{
    actId: string;
    applies: boolean;
    note?: string;
  }>;
  keyLocalActs?: string[];
  corpusAppendices?: string[];
}

export const IN_JURISDICTION_OVERLAYS: IndiaJurisdictionOverlay[] = [
  {
    jurisdiction: 'Jammu & Kashmir',
    status: 'union_territory',
    constitutionalBasis: 'Article 370 abrogated; J&K Reorganisation Act 2019',
    notes:
      'Central criminal and procedural codes (BNSS, BNS, BSA) apply to the UT of Jammu & Kashmir. Verify J&K-specific notifications and local rules. Constitution Appendix II (Application Order 2019) and Appendix III (Art 370(3) declaration) govern constitutional status.',
    actApplicability: [
      { actId: 'bnss', applies: true, note: 'Extended to J&K UT' },
      { actId: 'bns', applies: true, note: 'Extended to J&K UT' },
      { actId: 'bsa', applies: true, note: 'Extended to J&K UT' },
      { actId: 'constitution', applies: true, note: 'Appendix II J&K Application Order 2019 applies' },
    ],
    keyLocalActs: ['Jammu and Kashmir Reorganisation Act, 2019'],
    corpusAppendices: ['Appendix II — Constitution Application to Jammu and Kashmir Order, 2019', 'Appendix III — Declaration under Article 370(3)'],
  },
  {
    jurisdiction: 'Ladakh',
    status: 'union_territory',
    constitutionalBasis: 'J&K Reorganisation Act 2019',
    notes:
      'Ladakh is a UT without legislature. Central acts apply directly. Tribal and local customary law may affect land and personal matters — flag uncertainty.',
    actApplicability: [
      { actId: 'bnss', applies: true },
      { actId: 'bns', applies: true },
      { actId: 'bsa', applies: true },
      { actId: 'constitution', applies: true, note: 'Same constitutional framework as J&K UT post-370' },
    ],
    corpusAppendices: ['Appendix II — Constitution Application to Jammu and Kashmir Order, 2019'],
  },
  {
    jurisdiction: 'Sikkim',
    status: 'special',
    constitutionalBasis: 'Article 371F',
    notes:
      'Sikkim has special constitutional status under Article 371F. Certain central laws apply with modifications; verify Sikkim-specific enactments and presidential notifications before relying on pan-India bare-act text alone.',
    actApplicability: [
      { actId: 'bnss', applies: true, note: 'Central BNSS applies unless modified by Sikkim law' },
      { actId: 'bns', applies: true, note: 'Verify Sikkim adaptations' },
      { actId: 'bsa', applies: true },
      { actId: 'constitution', applies: true, note: 'Article 371F special provisions apply' },
    ],
    keyLocalActs: ['Sikkim Code of Criminal Procedure (where applicable)', 'Sikkim state adaptations under Art 371F'],
  },
];

const NORMALIZED_OVERLAY_INDEX = new Map(
  IN_JURISDICTION_OVERLAYS.map((overlay) => [
    overlay.jurisdiction.toLowerCase().replace(/\s+/g, ' ').trim(),
    overlay,
  ]),
);

export function findIndiaJurisdictionOverlay(
  jurisdiction?: string | null,
): IndiaJurisdictionOverlay | undefined {
  if (!jurisdiction?.trim()) return undefined;
  const key = jurisdiction.toLowerCase().replace(/\s+/g, ' ').trim();
  return NORMALIZED_OVERLAY_INDEX.get(key);
}

export function buildIndiaOverlayPromptBlock(jurisdiction?: string | null): string {
  const overlay = findIndiaJurisdictionOverlay(jurisdiction);

  // Always inject the general India accuracy rules for every IN query.
  const lines: string[] = [INDIA_RESEARCH_ACCURACY_RULES];

  if (!overlay) {
    return lines.join('\n');
  }

  lines.push(
    '',
    `Special jurisdiction overlay (${overlay.jurisdiction}):`,
    overlay.notes,
  );

  if (overlay.constitutionalBasis) {
    lines.push(`Constitutional basis: ${overlay.constitutionalBasis}`);
  }

  if (overlay.actApplicability.length > 0) {
    lines.push(
      'Act applicability:',
      ...overlay.actApplicability.map(
        (row) =>
          `- ${row.actId.toUpperCase()}: ${row.applies ? 'applies' : 'does not apply'}${row.note ? ` — ${row.note}` : ''}`,
      ),
    );
  }

  if (overlay.keyLocalActs?.length) {
    lines.push(`Key local enactments: ${overlay.keyLocalActs.join('; ')}`);
  }

  if (overlay.corpusAppendices?.length) {
    lines.push(`Relevant Constitution appendices: ${overlay.corpusAppendices.join('; ')}`);
  }

  lines.push(
    'When answering, note any UT-specific modifications and recommend verification against local notifications.',
  );

  return lines.join('\n');
}

export function buildIndiaOverlayUiNotice(jurisdiction?: string | null): string | undefined {
  const overlay = findIndiaJurisdictionOverlay(jurisdiction);
  if (!overlay) return undefined;
  return `${overlay.jurisdiction}: ${overlay.notes}`;
}
