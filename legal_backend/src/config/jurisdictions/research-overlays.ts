/**
 * Structured per-jurisdiction research overlays.
 *
 * Each overlay encodes the source-priority hierarchy, court hierarchy, citation
 * rules, deterministic forbidden patterns, and domain-specific rules used to
 * keep legal research accurate for that jurisdiction. The forbidden patterns are
 * consumed by the deterministic LegalSanityCheck service (block-and-repair); the
 * other fields are injected into the research prompt.
 */

export interface ForbiddenPattern {
  pattern: RegExp;
  message: string;
}

export interface JurisdictionResearchOverlay {
  jurisdiction: string;
  /** Ordered source-reliability hierarchy (most authoritative first). */
  sourcePriority: string[];
  /** Court hierarchy from apex to subordinate. */
  courtHierarchy: string[];
  /** Citation-format rules the model must follow. */
  citationRules: string[];
  /** Deterministic patterns that must never appear in final output. */
  forbiddenPatterns: ForbiddenPattern[];
  /** Free-text rules injected into the prompt for this jurisdiction. */
  domainSpecificRules: string[];
}

/**
 * India overlay. The forbidden patterns below codify the exact accuracy failures
 * Umbrella has produced for NI Act s.138 / BNSS so they can be blocked
 * deterministically rather than relying on prompt prose alone.
 */
const IN_OVERLAY: JurisdictionResearchOverlay = {
  jurisdiction: 'IN',
  sourcePriority: [
    'India Code / Gazette of India (official statutes)',
    'Supreme Court of India / e-SCR (official judgments)',
    'High Court official portals (official judgments)',
    'SCC Online / Manupatra / Taxmann (licensed databases)',
    'Indian Kanoon / Bar & Bench / LiveLaw (discovery only, not final authority where official exists)',
  ],
  courtHierarchy: [
    'Supreme Court of India (binds all courts)',
    'High Court (binds subordinate courts within its territory; coordinate HCs persuasive)',
    'District & Sessions Court',
    'Magistrate / subordinate courts',
    'Tribunals (NCLT, ITAT, DRT, etc. — binding or persuasive per statute)',
  ],
  citationRules: [
    'Cases: "Case Name v Case Name, (Year) Volume SCC Page"; include neutral citation where available.',
    'Statutes: "Negotiable Instruments Act, 1881, s.138".',
    'New criminal codes: "Bharatiya Nyaya Sanhita, 2023, s.__"; "Bharatiya Nagarik Suraksha Sanhita, 2023, s.__"; "Bharatiya Sakshya Adhiniyam, 2023, s.__".',
    'Do not mix old (IPC/CrPC/Evidence Act) and new (BNS/BNSS/BSA) section numbers without explaining applicability by date and procedural posture.',
  ],
  forbiddenPatterns: [
    {
      pattern: /s\.?\s*138[^.]{0,40}(?<!non[-\s])cognizable/i,
      message:
        'NI Act s.138 is generally non-cognizable, bailable, and compoundable. It proceeds by complaint before a Magistrate, not by police FIR/arrest. Do not describe s.138 as cognizable.',
    },
    {
      pattern: /police can arrest without warrant/i,
      message:
        'Do not state "police can arrest without warrant" for NI Act s.138 — arrest risk arises only if court summons/warrants are ignored after cognizance. State arrest powers only where the offence classification supports it.',
    },
    {
      pattern: /(?:BNSS\s+ss?\.?\s*462|[Ss]ection\s+462[^).\n]{0,30}BNSS|ss?\.?\s*462\s+(?:of\s+(?:the\s+)?)?BNSS)[^).\n]{0,60}(?:recovery of fine|levy of fine|attachment|sale of movable|fine.*?recovery|instalment)/i,
      message:
        'Incorrect: BNSS s.461 (titled "Warrant for levy of fine") governs attachment/sale of movables and Collector recovery. BNSS s.462 deals with the effect of such warrant — not with levy/recovery itself. Do not cite BNSS s.462 for fine recovery.',
    },
    {
      pattern: /(?:BNSS\s+ss?\.?\s*465|[Ss]ection\s+465[^).\n]{0,30}BNSS|ss?\.?\s*465\s+(?:of\s+(?:the\s+)?)?BNSS|under\s+[Ss]ection\s+465[^).\n]{0,40}BNSS)[^).\n]{0,80}(?:instalment|installment|time.*?pay|pay.*?fine|suspend.*?imprison|default.*?imprison)/i,
      message:
        'Incorrect: BNSS s.464 governs suspension of default imprisonment and payment of fine in instalments / over time. BNSS s.465 is titled "Who may issue a warrant" — it is not the instalment/suspension provision. Replace s.465 with s.464.',
    },
    {
      pattern: /s\.?\s*147[^.]{0,40}(BNSS|CrPC)[^.]{0,40}compound/i,
      message:
        'Incorrect: NI Act s.147 (Negotiable Instruments Act, 1881) is the compounding provision for NI Act offences — not s.147 of BNSS or CrPC.',
    },
    {
      pattern: /compound[^.]{0,40}s\.?\s*147[^.]{0,15}(BNSS|CrPC)/i,
      message:
        'Incorrect: compounding of NI Act offences is under s.147 of the Negotiable Instruments Act, 1881 — not BNSS/CrPC s.147.',
    },
    {
      pattern: /mere dishonou?r[^.]{0,60}notice[^.]{0,60}non[-\s]?payment[^.]{0,20}=?\s*guilt/i,
      message:
        'Overbroad: conviction under s.138 requires proof of all statutory ingredients (including issuance for a legally enforceable debt/liability) and the accused may rebut the s.139 presumption. Do not collapse dishonour + notice + non-payment into automatic guilt.',
    },
    {
      pattern: /strict liability[^.]{0,60}\bmere\b[^.]{0,40}guilt/i,
      message:
        'Do not collapse statutory ingredients into automatic guilt. s.138 does not require cheating-style mens rea, but all ingredients must still be proved and the s.139 presumption is rebuttable.',
    },
    {
      pattern: /security cheque[^.]{0,60}(complete defence|standalone defence|does not attract s\.?\s*138|not attract s\.?\s*138|outside s\.?\s*138)/i,
      message:
        'Incorrect: a security cheque can attract s.138 if a legally enforceable liability had crystallised by the date of presentation. It is not a standalone/complete defence.',
    },
    {
      pattern: /stop[\s-]?payment[^.]{0,60}(complete defence|standalone defence|clean defence|does not attract s\.?\s*138|not attract s\.?\s*138)/i,
      message:
        'Incorrect: "stop payment" can still fall within s.138. The accused must rebut the s.139 presumption or establish absence of a legally enforceable debt; it is not a clean/standalone defence.',
    },
    {
      pattern: /(individual|personal) insolvency[^.]{0,80}(district court)/i,
      message:
        'Incorrect: individual insolvency under IBC Part III is forum/context dependent (usually the DRT where operational), not the District Court generically. State this with the forum caveat.',
    },
    {
      pattern: /insolvency[^.]{0,60}(automatically|will) (stay|stays|erase|erases)[^.]{0,40}(criminal|s\.?\s*138)/i,
      message:
        'Incorrect: insolvency does not automatically stay or erase s.138 criminal proceedings. Do not state this without authority.',
    },
    {
      pattern: /(cannot avoid payment entirely|no lawful route to avoid liability|cannot (get away|escape) (without paying|liability))/i,
      message:
        'Too absolute: where statutory conditions are met and the s.139 presumption is not rebutted conviction risk is substantial, but genuine factual, procedural, or legal defences can defeat liability. Do not state liability is unavoidable.',
    },
    {
      pattern: /(?:upon\s+compounding|after\s+compounding|on\s+compounding)[^.\n]{0,80}no conviction is recorded\b/i,
      message:
        'Compounding under s.147 NI Act does not automatically mean "no conviction is recorded." Upon the court accepting and recording the compounding under s.147 NI Act, the accused is ordinarily acquitted/discharged in respect of that offence. If post-conviction, the procedural consequences depend on the appellate order. Do not state the outcome as automatic.',
    },
    {
      pattern: /Indus Airways[^.\n]{0,120}(?:security cheque[^.\n]{0,60}(?:cannot|does not)\s+attract|security.*not.*attract.*s\.?\s*138)/i,
      message:
        'Do not read Indus Airways Pvt. Ltd. v Magnum Aviation (2014) 12 SCC 539 as a general rule that security cheques cannot attract s.138. It concerned post-dated cheques as advance payment where the underlying transaction had not matured into a legally enforceable liability. A security cheque can attract s.138 if a legally enforceable liability had crystallised by the date of presentation.',
    },
    {
      pattern: /IBC\s+Part\s+III[^.\n]{0,120}(?:fresh start[^.\n]{0,60}debts can be discharged|immediately available|straightforward remedy)/i,
      message:
        'Do not present IBC Part III personal insolvency as a straightforward or immediately available route for ordinary individuals — operationalisation is partial and forum-dependent. Always caveat with notification status and debtor category. Note: IBC Part III does not automatically stay or extinguish s.138 criminal proceedings.',
    },
    // BNS property offence section mapping
    {
      pattern: /BNS[^.\n]{0,40}s\.?\s*316[^.\n]{0,80}(?:cheating|s\.?\s*420\s+IPC|corresponds?\s+to\s+IPC\s+s\.?\s*420)/i,
      message:
        'Incorrect BNS section mapping: BNS s.316 is Criminal Breach of Trust (corresponding to IPC ss.405–406), NOT cheating. BNS s.318 is Cheating (corresponding to IPC ss.415–420). Correct: "BNS s.318 — cheating; BNS s.316 — criminal breach of trust."',
    },
    {
      pattern: /BNS[^.\n]{0,40}s\.?\s*318[^.\n]{0,80}(?:criminal breach of trust|CBT|corresponds?\s+to\s+IPC\s+s\.?\s*406)/i,
      message:
        'Incorrect BNS section mapping: BNS s.318 is Cheating (corresponding to IPC ss.415–420), NOT criminal breach of trust. BNS s.316 is Criminal Breach of Trust (corresponding to IPC ss.405–406). Correct: "BNS s.318 — cheating; BNS s.316 — criminal breach of trust."',
    },
    // Specific Relief Act / Property — post-2018 s.20 mischaracterisation
    {
      pattern: /s\.?\s*20[^.\n]{0,30}Specific Relief[^.\n]{0,80}hardship/i,
      message:
        'Incorrect: after the Specific Relief (Amendment) Act, 2018, the old s.20 (broad discretionary refusal on grounds of hardship) was substituted. Current s.20 of the Specific Relief Act, 1963 deals with substituted performance — not broad hardship discretion. Do not cite post-2018 s.20 for hardship; instead note that traditional discretionary refusal on hardship grounds has been substantially curtailed and the vendor must rely on statutory bars under ss.11(2), 14 and 16.',
    },
    {
      pattern: /hardship[^.\n]{0,80}s\.?\s*20[^.\n]{0,30}Specific Relief/i,
      message:
        'Incorrect: after the Specific Relief (Amendment) Act, 2018, the old s.20 (broad discretionary refusal on grounds of hardship) was substituted. Current s.20 of the Specific Relief Act, 1963 deals with substituted performance — not broad hardship discretion. Do not cite post-2018 s.20 for hardship.',
    },
    // Declaration of title where only agreement to sell exists
    {
      pattern: /declaration of title[^.\n]{0,30}(?:s\.?\s*34|purchaser)[^.\n]{0,120}(?:agreement to sell|title has not|no sale deed|sale deed.{0,20}not.{0,5}execut|not yet.{0,5}registered)/i,
      message:
        'Do not seek a "declaration of title" where only an agreement to sell exists and no registered sale deed has been executed. Under TPA s.54, an agreement to sell does not by itself create any interest in or charge on the property. The correct relief is a declaration that the agreement to sell is valid and binding and that the purchaser is entitled to execution and registration of the sale deed.',
    },
    // Absolute "specific performance requires written contract"
    {
      pattern: /specific performance requires? (?:a )?written[^.\n]{0,60}(?:contract|agreement)/i,
      message:
        'Do not state as an absolute rule that specific performance requires a written contract. An oral agreement for sale of immovable property can in theory be specifically enforced if clearly proved, though it is much harder evidentially. Prefer: "A written agreement is strongly preferable and usually essential evidentially; an oral agreement is possible but difficult to prove."',
    },
    // Unregistered agreement treated as automatically unenforceable
    {
      pattern: /unregistered agreement[^.\n]{0,80}(?:unenforceable|void|no legal (?:force|value|effect)|cannot be enforced|inadmissible for all purposes)/i,
      message:
        'An unregistered agreement to sell is not automatically unenforceable or void. It may still be admissible as evidence of a contract in a suit for specific performance under the proviso to Registration Act, 1908, s.49. The primary practical risk is usually insufficient stamp duty (Indian Stamp Act, 1899 / relevant State Stamp Act), not outright voidness. After the 2001 amendment, an unregistered document cannot ground a s.53A TPA part-performance defence, but it can still found a specific performance suit.',
    },
    // Registration Act s.49 proviso — unregistered document evidence for SP
    {
      pattern: /unregistered[^.\n]{0,60}(?:agreement|document)[^.\n]{0,80}(?:cannot be used|not admissible|inadmissible)[^.\n]{0,60}(?:specific performance|evidence of contract)/i,
      message:
        'Incorrect: under the proviso to Registration Act, 1908, s.49, an unregistered document affecting immovable property may be received as evidence of a contract in a suit for specific performance. It cannot be used to claim s.53A TPA part-performance protection after the 2001 amendment, but it remains admissible for specific performance purposes, subject to stamp duty compliance.',
    },
    // CPC s.148A caveat is filed in court — not with Sub-Registrar
    {
      pattern: /(?:caveat|CPC\s+s\.?\s*148A)[^.\n]{0,80}(?:Sub.?Registrar|revenue authority|registrar(?!\s+of)|registration office)/i,
      message:
        'Incorrect: a CPC s.148A caveat is filed in the competent civil court — not with the Sub-Registrar or revenue authority. A Sub-Registrar objection/intimation is a state-specific administrative step, not a CPC caveat. These are distinct remedies: (a) CPC s.148A caveat — in court; (b) administrative intimation to Sub-Registrar — state-specific, not a substitute for an injunction.',
    },
    // Specific Relief Act s.19(b) for bona fide third-party transferee — not TPA s.19
    {
      pattern: /(?:third.?party|bona fide purchaser|subsequent transferee)[^.\n]{0,80}TPA[^.\n]{0,20}s\.?\s*19\b/i,
      message:
        'For specific performance against a bona fide subsequent transferee, the correct provision is Specific Relief Act, 1963, s.19(b) — not TPA s.19. SRA s.19(b) bars enforcement against a transferee for value who has paid money in good faith and without notice of the original contract. TPA s.19 is a different provision (restrictions on transfer). Use Specific Relief Act, 1963, s.19(b) for third-party transferee issues in specific performance suits.',
    },
    // RERA scope — only developer/promoter + registered project
    {
      pattern: /RERA[^.\n]{0,120}(?:all property|any property dispute|general property|private sale|resale|individual seller)/i,
      message:
        'RERA (Real Estate (Regulation and Development) Act, 2016) applies only to transactions involving a registered promoter/developer and a registered real estate project. It does not apply to individual sellers, resale transactions, or properties/projects not registered under RERA. Do not present RERA as a general property dispute forum.',
    },
    // TPA s.54 — agreement to sell does not create interest in property
    {
      pattern: /agreement (?:to sell|for sale)[^.\n]{0,60}(?:creates?|transfers?|vests?)[^.\n]{0,40}(?:title|interest|charge|right in property)/i,
      message:
        'Incorrect: under Transfer of Property Act, 1882, s.54, an agreement for sale of immovable property does not by itself create any interest in or charge on the property. Only a registered sale deed (for value ≥ ₹100) transfers title. An agreement to sell gives the purchaser a right to seek specific performance — it does not itself transfer or create any interest.',
    },
  ],
  domainSpecificRules: [
    'Always check whether BNS/BNSS/BSA (2023) or the predecessor IPC/CrPC/Evidence Act applies, based on the date of the offence/cause of action and procedural posture; confirm repeal and transitional provisions.',
    'Do not confuse section numbers between the old and new codes (IPC→BNS, CrPC→BNSS, Evidence Act→BSA). Section numbers frequently differ and reversal is a common error.',
    'Do not cite overruled or doubted cases as good law without a clear warning.',
    'Prefer official India Code / e-SCR sources; treat Indian Kanoon as a discovery source only where official text exists.',
    'SPECIFIC RELIEF ACT — PROPERTY: Post-2018 amendment made specific performance of immovable property contracts ordinarily enforceable (s.10); s.20 now governs substituted performance — the old broad hardship discretion has been substantially curtailed. Section 16 (readiness/willingness) and ss.11(2), 14 remain relevant bars. Do not cite s.20 for hardship.',
    'PROPERTY — REGISTRATION ACT s.49 PROVISO: An unregistered agreement to sell may be received as evidence of a contract in a suit for specific performance under the s.49 proviso. After the 2001 amendment, unregistered documents cannot ground a s.53A TPA part-performance defence. Primary risk is stamp duty compliance, not void/unenforceability.',
    'PROPERTY — CPC CAVEAT vs SUB-REGISTRAR: CPC s.148A caveat = filed in court. A Sub-Registrar objection/intimation = state-specific administrative step, not a substitute for an injunction. Never conflate these two distinct remedies.',
    'PROPERTY — THIRD-PARTY TRANSFEREE: For specific performance against a bona fide subsequent purchaser for value without notice, use Specific Relief Act, 1963, s.19(b) — not TPA s.19.',
    'PROPERTY — TPA s.54: An agreement for sale does not by itself create any interest in or charge on the property. Only a registered sale deed transfers title.',
    'PROPERTY — RERA SCOPE: RERA applies only to registered promoters/developers and registered real estate projects — not to individual sellers, private resales, or unregistered projects.',
    'BNS PROPERTY OFFENCES: BNS s.316 = Criminal Breach of Trust (IPC ss.405–406 equivalent); BNS s.318 = Cheating (IPC ss.415–420 equivalent). Do not reverse these mappings.',
    'LIMITATION: For suits (not appeals), Limitation Act, 1963 s.5 (condonation of delay) is generally not available — there is no general power to condone delay in filing a suit. This applies to specific performance (Art. 54), tort suits, contract suits, etc.',
    'TRIBUNALS vs COURTS: Do not conflate tribunal jurisdiction with civil court jurisdiction. NCLT, DRT, ITAT, RERA authority, Consumer Commission — each has a defined pecuniary/subject-matter jurisdiction. Always confirm the correct forum.',
  ],
};

/** Best-effort stub overlays — generic guardrails until fully encoded. */
function stubOverlay(
  code: string,
  courtHierarchy: string[],
  sourcePriority: string[],
  citationRules: string[],
): JurisdictionResearchOverlay {
  return {
    jurisdiction: code,
    sourcePriority,
    courtHierarchy,
    citationRules,
    forbiddenPatterns: [],
    domainSpecificRules: [
      'This jurisdiction is handled best-effort: be explicit about uncertainty and recommend confirmation with a locally licensed practitioner and official sources.',
    ],
  };
}

const KE_OVERLAY: JurisdictionResearchOverlay = {
  ...stubOverlay(
    'KE',
    ['Supreme Court of Kenya', 'Court of Appeal', 'High Court', 'Magistrates Courts', 'Tribunals'],
    ['Kenya Law (official)', 'National Council for Law Reporting (eKLR)', 'Gazette notices', 'Law firm/academic commentary (discovery only)'],
    ['Cases: "Case Name [Year] eKLR"; statutes: "Act Name (Cap. __)" or "Act No. __ of Year, s.__".'],
  ),
  forbiddenPatterns: [
    {
      pattern: /adverse possession[^.\n]{0,80}automatically transfers title/i,
      message:
        'Adverse possession in Kenya requires continuous occupation for the statutory period plus proof of intention to possess — it does not automatically transfer title without court adjudication.',
    },
  ],
  domainSpecificRules: [
    'Land disputes: confirm whether title is under the Land Registration Act 2012 (Torrens-style) or legacy regimes.',
    'Employment: distinguish Employment Act 2007 unfair termination from wrongful contract termination.',
    'Constitutional petitions: Bill of Rights enforcement under Constitution of Kenya 2010 art. 22–23.',
  ],
};

const US_OVERLAY: JurisdictionResearchOverlay = {
  ...stubOverlay(
    'US',
    ['U.S. Supreme Court', 'U.S. Courts of Appeals (Circuit)', 'U.S. District Courts', 'State supreme/appellate/trial courts'],
    ['Official reporters (U.S., F.3d, etc.)', 'Westlaw / LexisNexis / Bloomberg Law', 'CourtListener / Legal Information Institute (discovery)'],
    ['Cases: "Party v Party, Volume Reporter Page (Court Year)"; statutes: "Title U.S.C. § __"; distinguish federal vs state law.'],
  ),
  forbiddenPatterns: [
    {
      pattern: /at[- ]will employment[^.\n]{0,60}never (?:sue|challenge|claim)/i,
      message:
        'At-will employment is not absolute — federal/state anti-discrimination, retaliation, whistleblower, and contract exceptions may apply.',
    },
  ],
  domainSpecificRules: [
    'Always specify federal vs state law and the controlling circuit/state.',
    'EEOC charge-filing deadlines apply before Title VII suits.',
    'Bankruptcy: distinguish automatic stay (11 U.S.C. § 362) from discharge (§ 727/1141).',
  ],
};

const GB_OVERLAY: JurisdictionResearchOverlay = {
  ...stubOverlay(
    'GB',
    ['UK Supreme Court', 'Court of Appeal', 'High Court', 'Crown/County Courts', 'Tribunals'],
    ['legislation.gov.uk (official)', 'The National Archives / official judgments', 'Westlaw UK / LexisNexis', 'BAILII (discovery)'],
    ['Cases: "[Year] UKSC/EWCA/EWHC Number"; statutes: "Act Name Year, s.__".'],
  ),
  forbiddenPatterns: [
    {
      pattern: /tenancy deposit[^.\n]{0,60}criminal prosecution/i,
      message:
        'Failure to protect a tenancy deposit under the Housing Act 2004 typically gives civil remedies (penalty up to 3× deposit), not criminal prosecution of the landlord.',
    },
  ],
  domainSpecificRules: [
    'Distinguish England & Wales law from Scotland and Northern Ireland where relevant.',
    'UK GDPR / DPA 2018 govern personal data — do not cite EU GDPR alone post-Brexit without noting UK regime.',
    'Unfair dismissal: ERA 1996 s.98 reasonableness test and qualifying period.',
  ],
};

const UG_OVERLAY: JurisdictionResearchOverlay = {
  ...stubOverlay(
    'UG',
    [
      'Supreme Court of Uganda',
      'Court of Appeal of Uganda',
      'High Court of Uganda',
      'Magistrates Courts',
      'Specialised tribunals (e.g. PPDA appeals where applicable)',
    ],
    [
      'ULII (Uganda Legal Information Institute) — primary discovery',
      'Official Uganda Gazette / legislation portals',
      'AfricanLII / EACLI mirrors',
      'BAILII and other common-law materials (persuasive only)',
      'Secondary protocols (SCL Delay Protocol, ASCE guidance) — analytical only',
    ],
    [
      'Prefer ULII neutral citations / case names with court and year when available.',
      'Statutes: "Act Name, Year, s.__" (confirm Cap consolidation on ULII).',
      'UK/commonwealth authorities are persuasive in this common-law system, not binding unless received.',
    ],
  ),
  domainSpecificRules: [
    'Uganda is common-law: stare decisis and persuasive reception of UK/commonwealth doctrine matter alongside local statute.',
    'Do not treat SCL Delay and Disruption Protocol, ASCE delay-analysis guidance, or FIDIC commentary as Ugandan primary law — label them analytical / secondary unless a retrieved local authority adopts them.',
    'For construction/EOT disputes, identify the governing contract form (often FIDIC or bespoke), notice machinery, and whether arbitration or court is the forum.',
    'Prefer ULII retrieval for Ugandan judgments and Acts; state coverage gaps honestly when ULII hits are thin.',
    'Recommend confirmation against official ULII / Gazette text before filing or client advice — this jurisdiction is best-effort until the ULII connector and statute ingest are complete.',
  ],
};

const CA_OVERLAY = stubOverlay(
  'CA',
  ['Supreme Court of Canada', 'Provincial Courts of Appeal', 'Superior Courts', 'Provincial/Territorial Courts'],
  ['Justice Laws Website (official)', 'SCC official judgments', 'Westlaw/LexisNexis Canada', 'CanLII (discovery)'],
  ['Cases: "Party v Party, Year SCC Number" with neutral citation; statutes: "Act Name, RSC/Year, c __, s __".'],
);

const AU_OVERLAY = stubOverlay(
  'AU',
  ['High Court of Australia', 'State/Federal appellate courts', 'Supreme/Federal Courts', 'Lower courts/tribunals'],
  ['Federal Register of Legislation (official)', 'Official court judgments', 'Westlaw AU / LexisNexis', 'AustLII (discovery)'],
  ['Cases: "Party v Party [Year] HCA Number"; statutes: "Act Name Year (Cth/State), s __".'],
);

const RESEARCH_OVERLAYS: Record<string, JurisdictionResearchOverlay> = {
  IN: IN_OVERLAY,
  KE: KE_OVERLAY,
  US: US_OVERLAY,
  GB: GB_OVERLAY,
  UK: GB_OVERLAY,
  UG: UG_OVERLAY,
  CA: CA_OVERLAY,
  AU: AU_OVERLAY,
};

export function getResearchOverlay(
  countryCode?: string | null,
): JurisdictionResearchOverlay | undefined {
  if (!countryCode?.trim()) return undefined;
  return RESEARCH_OVERLAYS[countryCode.trim().toUpperCase()];
}

/**
 * Builds the prompt block for a jurisdiction overlay (source priority, court
 * hierarchy, citation rules, domain-specific rules). Forbidden patterns are
 * enforced deterministically post-generation and are not dumped into the prompt
 * verbatim, but a short summary is included so the model self-corrects.
 */
export function buildResearchOverlayPromptBlock(
  countryCode?: string | null,
): string {
  const overlay = getResearchOverlay(countryCode);
  if (!overlay) return '';

  const lines: string[] = [
    `JURISDICTION RESEARCH OVERLAY — ${overlay.jurisdiction}`,
    '',
    'Source priority (prefer higher tiers):',
    ...overlay.sourcePriority.map((s, i) => `  ${i + 1}. ${s}`),
    '',
    'Court hierarchy (for binding vs persuasive analysis):',
    ...overlay.courtHierarchy.map((c) => `  - ${c}`),
    '',
    'Citation rules:',
    ...overlay.citationRules.map((c) => `  - ${c}`),
  ];

  if (overlay.domainSpecificRules.length > 0) {
    lines.push('', 'Jurisdiction rules:', ...overlay.domainSpecificRules.map((r) => `  - ${r}`));
  }

  if (overlay.forbiddenPatterns.length > 0) {
    lines.push(
      '',
      'Accuracy guardrails (these errors will be rejected — do not produce them):',
      ...overlay.forbiddenPatterns.slice(0, 20).map((f) => `  - ${f.message}`),
    );
  }

  return lines.join('\n');
}

/**
 * Stripped-down overlay block that includes only source priority and court
 * hierarchy — omitting forbidden-pattern messages which are already covered
 * by jurisdiction-specific accuracy rules (e.g. INDIA_RESEARCH_ACCURACY_RULES).
 * Use this when a full jurisdiction accuracy block has already been injected.
 */
export function buildResearchOverlaySourceBlock(
  countryCode?: string | null,
): string {
  const overlay = getResearchOverlay(countryCode);
  if (!overlay) return '';

  const lines: string[] = [
    `JURISDICTION — ${overlay.jurisdiction}`,
    '',
    'Source priority (prefer higher tiers):',
    ...overlay.sourcePriority.map((s, i) => `  ${i + 1}. ${s}`),
    '',
    'Court hierarchy (for binding vs persuasive analysis):',
    ...overlay.courtHierarchy.map((c) => `  - ${c}`),
    '',
    'Citation rules:',
    ...overlay.citationRules.map((c) => `  - ${c}`),
  ];

  return lines.join('\n');
}
