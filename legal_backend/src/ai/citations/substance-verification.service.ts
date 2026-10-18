import { Injectable } from '@nestjs/common';

export interface SubstanceAuthority {
  id: string;
  title: string;
  fullText?: string | null;
  summary?: string | null;
  sourceName?: string;
}

export interface SubstanceCheckResult {
  passed: boolean;
  warnings: string[];
  disclaimer?: string;
  requiresSeedVerification: boolean;
}

const HIGH_COURT_WRIT_PATTERNS = [
  /\bhigh court\b.*\bwrit\b/i,
  /\bwrit of habeas corpus\b/i,
  /\bcourt of session\b.*\bwrit\b/i,
];

const DISTRICT_MAGISTRATE_PATTERNS = [
  /\bdistrict magistrate\b/i,
  /\bsub-?divisional magistrate\b/i,
  /\bmagistrate of the first class\b/i,
  /\bcomplaint on oath\b/i,
];

const BNSS_101_DRIFT: Array<{ requiredInAuthority?: RegExp[]; forbiddenInOutput: RegExp[] }> = [
  {
    requiredInAuthority: DISTRICT_MAGISTRATE_PATTERNS,
    forbiddenInOutput: HIGH_COURT_WRIT_PATTERNS,
  },
];

/**
 * Builds a hard-fact block about the correct predecessor provision to be injected into the
 * LLM grounding prompt, so the model cannot guess the wrong predecessor section number.
 */
function buildPredecessorFactBlock(
  requestedSection: { actId: string; section: string; statuteShortName?: string } | undefined,
  predecessor: {
    predecessorActId: string;
    predecessorSection: string;
    note?: string;
    confusingPredecessorSection?: string;
    confusingBnssSection?: string;
  },
): string {
  if (!requestedSection) return '';
  const newAct = (requestedSection.statuteShortName ?? requestedSection.actId.toUpperCase()).toUpperCase();
  const newSection = requestedSection.section;
  const oldAct = predecessor.predecessorActId.toUpperCase();
  const oldSection = predecessor.predecessorSection;
  const note = predecessor.note ? ` (${predecessor.note})` : '';

  const lines = [
    `PREDECESSOR FACT — authoritative, do not deviate:`,
    `  ${newAct} s.${newSection} is the direct successor to ${oldAct} s.${oldSection}${note}.`,
    `  Judicial precedents under ${oldAct} s.${oldSection} are directly applicable to ${newAct} s.${newSection}.`,
    `  Always cite ${oldAct} s.${oldSection} as the predecessor — do not cite any other section of ${oldAct}.`,
  ];

  if (predecessor.confusingPredecessorSection && predecessor.confusingBnssSection) {
    lines.push(
      `  WARNING: ${oldAct} s.${predecessor.confusingPredecessorSection} is a DIFFERENT provision` +
        ` (its ${newAct} successor is ${newAct} s.${predecessor.confusingBnssSection});` +
        ` do not confuse it with the predecessor of ${newAct} s.${newSection}.`,
    );
  }

  return lines.join('\n');
}

// ─── India NI Act / BNSS hard-accuracy patterns ──────────────────────────────
// These fire on ALL India queries (not just bare-act ones) via checkIndiaNiActAndBnss().

/** BNSS s.465 is "Who may issue a warrant" — NOT an instalment/suspension-of-imprisonment provision.
 *  The correct section for allowing payment of fine in instalments / suspending imprisonment in
 *  default is BNSS s.464. */
const BNSS_INSTALMENT_WRONG_SECTION = [
  // BNSS-first forms: "BNSS s.465 instalments" / "Under BNSS s.465"
  /BNSS\s+ss?\.?\s*465[^).\n]{0,60}(?:instalment|installment|time.*?pay|pay.*?fine|suspend.*?imprison|default.*?imprison)/i,
  /under\s+BNSS\s+ss?\.?\s*465[^).\n]{0,60}(?:may allow|allow.*?pay|time.*?fine|fine.*?instalment|instalment)/i,
  // Section-first forms: "Section 465, BNSS" / "s.465 of the BNSS" / "Under Section 465, BNSS"
  /[Ss]ection\s+465[^).\n]{0,30}BNSS[^).\n]{0,60}(?:instalment|installment|time.*?pay|pay.*?fine|suspend|default)/i,
  /under\s+[Ss]ection\s+465[^).\n]{0,40}BNSS/i,
  /ss?\.?\s*465\s+(?:of\s+(?:the\s+)?)?BNSS[^).\n]{0,60}(?:instalment|installment|time.*?pay|pay.*?fine|suspend)/i,
  // Plural ss. forms: "BNSS ss.462, 465" cited for fine+instalment
  /BNSS\s+ss?\.\s*\d{3},\s*465[^).\n]{0,60}(?:instalment|fine.*payment|payment.*fine|recovery.*instalment)/i,
];

/** BNSS s.462 is "Effect of such warrant" — NOT the levy/recovery-of-fine mechanism.
 *  Warrant for levy of fine (attachment, sale of movables, Collector recovery) is BNSS s.461. */
const BNSS_LEVY_WRONG_SECTION = [
  // BNSS-first: "BNSS s.462 recovery/levy"
  /BNSS\s+ss?\.?\s*462[^).\n]{0,60}(?:recovery of fine|levy of fine|attachment|sale of movable|collector.*?arrear|fine.*?recovery)/i,
  // Section-first: "Section 462, BNSS recovery/levy"
  /[Ss]ection\s+462[^).\n]{0,30}BNSS[^).\n]{0,60}(?:recovery|levy|attachment|fine.*?recovery|instalment)/i,
  /ss?\.?\s*462\s+(?:of\s+(?:the\s+)?)?BNSS[^).\n]{0,60}(?:recovery|levy|warrant.*?fine|fine.*?attachment)/i,
  // Plural ss. forms: "BNSS ss.462, 465" cited as "fine recovery and instalment payment"
  /BNSS\s+ss?\.\s*462,\s*\d{3}[^).\n]{0,60}(?:fine recovery|instalment|levy)/i,
];

/** Security cheque is NOT an automatic or standalone defence to NI Act s.138.
 *  A cheque issued as security attracts s.138 if a legally enforceable liability had crystallised
 *  by the date of presentation (see Sripati Singh v State of Jharkhand, 2021 SCC OnLine SC 1002). */
const NI_ACT_SECURITY_CHEQUE_OVERBROAD = [
  /security cheque[^.]*(?:complete defence|standalone defence|not attract.*s\.?\s*138|outside s\.?\s*138|does not attract)/i,
  /(?:complete|standalone|automatic)\s+defence.*security cheque/i,
];

/** "Stop payment" is NOT a clean or complete defence to NI Act s.138.
 *  The accused must rebut the s.139 presumption or establish absence of legally enforceable debt
 *  (see Laxmi Dyechem v State of Gujarat, (2012) 13 SCC 375). */
const NI_ACT_STOP_PAYMENT_OVERBROAD = [
  /stop\s+payment[^.]*(?:complete defence|standalone defence|not attract.*s\.?\s*138|clean defence|defeats?\s+s\.?\s*138)/i,
  /(?:complete|standalone|clean)\s+defence.*stop\s+payment/i,
];

/** "Cannot get away without paying" is too absolute — genuine defences exist. */
const NI_ACT_ABSOLUTE_PAYMENT = [
  /cannot\s+(?:legally\s+)?(?:get away without paying|avoid payment entirely|escape liability entirely)/i,
  /there\s+is\s+no\s+(?:lawful\s+)?route\s+to\s+avoid(?:\s+liability)?/i,
];

/** Presenting IBC Part III as a straightforward, immediately available remedy for ordinary individuals. */
const IBC_PART_III_OVERSIMPLIFIED = [
  /IBC\s+Part\s+III[^.\n]{0,120}(?:fresh start process[^.\n]{0,60}debts can be discharged|immediately available|straightforward remedy|available route)/i,
];

/** "No conviction is recorded" stated as automatic post-compounding — too absolute. */
const COMPOUNDING_AUTOMATIC_ACQUITTAL = [
  /(?:upon\s+compounding|after\s+compounding|on\s+compounding)[^.\n]{0,80}no conviction is recorded\b/i,
  /compounding[^.\n]{0,80}automatically\s+(?:acquit|discharg|erase|removes\s+conviction)/i,
];

/** BNSS acronym wrongly expanded as Bharatiya Nyaya Sanhita (that is BNS). */
const BNSS_MEANS_NYAYA_SANHITA = [
  /\bBNSS\b[^.\n]{0,120}Bharatiya\s+Nyaya\s+Sanhita/i,
  /Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita[^.\n]{0,40}means[^.\n]{0,40}Nyaya/i,
  /"BNSS"\s+means\s+the\s+Bharatiya\s+Nyaya\s+Sanhita/i,
];

/** BNS acronym wrongly expanded as Bharatiya Nagarik Suraksha Sanhita (that is BNSS). */
const BNS_MEANS_SURAKSHA_SANHITA = [
  /\bBNS\b[^.\n]{0,120}Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita/i,
  /"BNS"\s+means\s+the\s+Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita/i,
];

/** Security cheque used as if it cannot attract s.138 — the Indus Airways caveat is often misread. */
const NI_ACT_SECURITY_CHEQUE_INDUS_OVERBROAD = [
  /security[^.\n]{0,30}not\s+(?:for payment|for discharge)[^.\n]{0,60}(?:cannot attract|does not attract|outside)\s+s\.?\s*138/i,
  /Indus Airways[^.\n]{0,120}(?:security cheque|does not attract s\.?\s*138|security.*not.*attract)/i,
];

// ─────────────────────────────────────────────────────────────────────────────

/** Patterns that indicate the output has confused the predecessor of BNSS s.101 with CrPC s.97
 *  (search for wrongfully confined persons) instead of the correct CrPC s.98
 *  (restoration of abducted females). */
const BNSS_101_PREDECESSOR_DRIFT = [
  /\bsection\s+97\s+crpc\b/i,
  /\bcrpc\s+s\.?\s*97\b/i,
  /\bs\.?\s*97\s+crpc\b/i,
  /\bsuccessor\s+to\s+section\s+97\b/i,
  /\bin\s+pari\s+materia\s+with\s+section\s+97\s+crpc\b/i,
  /\bpredecessor\s+provision.*?section\s+97\b/i,
];

@Injectable()
export class SubstanceVerificationService {
  checkBareActSubstance(params: {
    query: string;
    outputMarkdown: string;
    authorities: SubstanceAuthority[];
    isBareActQuery: boolean;
  }): SubstanceCheckResult {
    const warnings: string[] = [];
    let passed = true;

    if (!params.isBareActQuery || params.authorities.length === 0) {
      return { passed: true, warnings: [], requiresSeedVerification: false };
    }

    const normalizedQuery = params.query.toLowerCase();
    const primaryAuthority = params.authorities[0];
    const authorityText = [primaryAuthority.fullText, primaryAuthority.summary]
      .filter(Boolean)
      .join('\n');

    if (/101\s+bnss|bnss\s+101|section\s+101.*bnss/i.test(normalizedQuery)) {
      for (const rule of BNSS_101_DRIFT) {
        const authorityMatches = rule.requiredInAuthority?.some((pattern) =>
          pattern.test(authorityText),
        );
        const outputDrift = rule.forbiddenInOutput.some((pattern) =>
          pattern.test(params.outputMarkdown),
        );
        if (authorityMatches && outputDrift) {
          passed = false;
          warnings.push(
            'Substance drift detected: retrieved BNSS s.101 text refers to District Magistrate / complaint on oath, but the answer mentions High Court writ procedure. Correct to match the statutory provision.',
          );
        }
      }

      // Predecessor-section drift: output says CrPC s.97 is the predecessor of BNSS s.101,
      // but the correct predecessor is CrPC s.98 (restoration of abducted females).
      // CrPC s.97 (wrongfully confined persons) maps to BNSS s.100, not s.101.
      const predecessorDrift = BNSS_101_PREDECESSOR_DRIFT.some((p) =>
        p.test(params.outputMarkdown),
      );
      if (predecessorDrift) {
        passed = false;
        warnings.push(
          'Predecessor drift detected: BNSS s.101 is the successor to CrPC s.98 ' +
            '(Power to compel restoration of abducted females), NOT CrPC s.97 ' +
            '(Search for persons wrongfully confined — that maps to BNSS s.100). ' +
            'Correct the predecessor reference to CrPC s.98.',
        );
      }
    }

    if (/article\s*21|art\.?\s*21/i.test(normalizedQuery)) {
      if (/131st|constitutional amendment bill/i.test(params.outputMarkdown)) {
        passed = false;
        warnings.push('Art 21 query must not cite the 131st Constitutional Amendment Bill as current law.');
      }
    }

    if (/article\s*330a|330\s*a/i.test(normalizedQuery)) {
      if (/131st|constitutional amendment bill/i.test(params.outputMarkdown)) {
        passed = false;
        warnings.push('Art 330A query must not cite stale amendment bill text as current law.');
      }
    }

    if (/crpc\s*125|section\s*125.*crpc/i.test(normalizedQuery)) {
      if (/high court writ only/i.test(params.outputMarkdown)) {
        passed = false;
        warnings.push('Maintenance under erstwhile CrPC s.125 should reflect BNSS/BNSS remap — verify forum and procedure.');
      }
    }

    if (/bns\s*\d+|section\s*\d+.*bns/i.test(normalizedQuery)) {
      if (/ipc\s*302|indian penal code\s*302/i.test(params.outputMarkdown) && !/bns|bharatiya nyaya/i.test(authorityText)) {
        passed = false;
        warnings.push('BNS query answered with IPC-only punishment text without retrieved BNS authority.');
      }
    }

    const requiresSeedVerification =
      !!primaryAuthority.sourceName &&
      !/prs india|ncrb|legislative department|india code|bare act pdf/i.test(
        primaryAuthority.sourceName,
      );

    let disclaimer: string | undefined;
    if (requiresSeedVerification) {
      disclaimer =
        'Verify this provision against the official India Code / PRS / NCRB primary source before relying on it in court.';
    }

    if (params.isBareActQuery && !authorityText.trim()) {
      passed = false;
      warnings.push(
        'Insufficient statutory text retrieved for this bare-act query — confirm against primary sources.',
      );
    }

    // SECTION_EXISTENCE_DENIAL — generic: output denies a section exists while
    // the authority corpus actually contains text for it.
    if (params.isBareActQuery && authorityText.trim()) {
      const deniesSectionExists =
        /(?:does not exist|no such section|doesn['']?t exist|not (?:a )?(?:section|provision) (?:in|of)|there is no\b.*\bsection|no\b.*\bsection\b.*\d)/i.test(
          params.outputMarkdown,
        );
      if (deniesSectionExists) {
        passed = false;
        warnings.push(
          'The answer appears to deny a section exists while authority text was retrieved. Confirm whether the section is in the corpus before making existence claims.',
        );
      }
    }

    // SECTION_SUBSTITUTION — generic: a different section number is cited than what
    // was requested, without suggestion framing.
    if (params.isBareActQuery) {
      const querySection = params.query.match(/\b(\d+[A-Za-z]?)\b/)?.[1];
      if (querySection) {
        const altSectionPattern = new RegExp(
          `\\b(?:section|s\\.)\\s*(\\d+[A-Za-z]?)\\b`,
          'gi',
        );
        const citedSections = new Set<string>();
        for (const m of params.outputMarkdown.matchAll(altSectionPattern)) {
          citedSections.add(m[1].replace(/^0+/, '').toUpperCase());
        }
        const normalized = querySection.replace(/^0+/, '').toUpperCase();
        const suggestionContext =
          /(?:perhaps you meant|did you mean|suggest|alternative(?:ly)?)/i.test(
            params.outputMarkdown,
          );
        const hasOtherSection = [...citedSections].some((s) => s !== normalized);
        const hasSameSection = citedSections.has(normalized);
        if (hasOtherSection && !hasSameSection && !suggestionContext) {
          passed = false;
          warnings.push(
            `Section substitution detected: the query references s.${normalized} but the answer only cites different section(s): ${[...citedSections].join(', ')}. Ensure the answer addresses the requested section.`,
          );
        }
      }
    }

    return { passed, warnings, disclaimer, requiresSeedVerification };
  }

  /**
   * Hard post-generation accuracy check for India-specific NI Act / BNSS patterns.
   * Must be called unconditionally for all IN-jurisdiction queries — it is NOT gated on
   * isBareActQuery because the errors it catches appear in practice-area memos too.
   */
  checkIndiaNiActAndBnss(outputMarkdown: string): SubstanceCheckResult {
    const warnings: string[] = [];
    let passed = true;

    for (const p of BNSS_INSTALMENT_WRONG_SECTION) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'BNSS section error: s.465 is "Who may issue a warrant" — not the instalment/suspension ' +
            'provision. Use BNSS s.464 for suspension of default imprisonment and payment of fine ' +
            'in instalments or over time.',
        );
        break;
      }
    }

    for (const p of BNSS_LEVY_WRONG_SECTION) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'BNSS section error: s.462 is "Effect of such warrant" — not the levy/recovery mechanism. ' +
            'Use BNSS s.461 for warrant for levy of fine (attachment, sale of movables, Collector ' +
            'recovery of arrears).',
        );
        break;
      }
    }

    for (const p of NI_ACT_SECURITY_CHEQUE_OVERBROAD) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Overbroad NI Act statement: a security cheque is NOT automatically outside NI Act s.138. ' +
            'It attracts s.138 if a legally enforceable liability had crystallised by the date of ' +
            'presentation. See Sripati Singh v State of Jharkhand, 2021 SCC OnLine SC 1002.',
        );
        break;
      }
    }

    for (const p of NI_ACT_STOP_PAYMENT_OVERBROAD) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Overbroad NI Act statement: "stop payment" is NOT a clean or complete defence to s.138. ' +
            'The accused must rebut the s.139 presumption or establish absence of legally enforceable ' +
            'debt. See Laxmi Dyechem v State of Gujarat, (2012) 13 SCC 375.',
        );
        break;
      }
    }

    for (const p of NI_ACT_ABSOLUTE_PAYMENT) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Avoid absolute "cannot get away without paying" language. Genuine procedural, substantive, or factual defences can defeat s.138 liability. Use calibrated phrasing instead.',
        );
        break;
      }
    }

    for (const p of IBC_PART_III_OVERSIMPLIFIED) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Do not present IBC Part III as a straightforward or immediately available remedy for ordinary individuals — operationalisation is partial; always verify forum and notification status.',
        );
        break;
      }
    }

    for (const p of COMPOUNDING_AUTOMATIC_ACQUITTAL) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Compounding under s.147 NI Act does not automatically mean no conviction is recorded — the court must accept the compounding and pass an order; post-conviction consequences depend on the appellate/revisional order.',
        );
        break;
      }
    }

    for (const p of NI_ACT_SECURITY_CHEQUE_INDUS_OVERBROAD) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Indus Airways Pvt. Ltd. (2014) 12 SCC 539 does not mean every security cheque avoids s.138. It concerned post-dated cheques as advance payment where the underlying transaction did not mature into a legally enforceable liability. Do not apply it as a general rule that security cheques cannot attract s.138.',
        );
        break;
      }
    }

    for (const p of BNSS_MEANS_NYAYA_SANHITA) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Acronym error: BNSS = Bharatiya Nagarik Suraksha Sanhita, 2023 (procedural code). BNS = Bharatiya Nyaya Sanhita, 2023 (substantive penal code).',
        );
        break;
      }
    }

    for (const p of BNS_MEANS_SURAKSHA_SANHITA) {
      if (p.test(outputMarkdown)) {
        passed = false;
        warnings.push(
          'Acronym error: BNS = Bharatiya Nyaya Sanhita, 2023. BNSS = Bharatiya Nagarik Suraksha Sanhita, 2023.',
        );
        break;
      }
    }

    return { passed, warnings, requiresSeedVerification: false };
  }

  buildBareActGroundingInstruction(
    isBareActQuery: boolean,
    hasFullText: boolean,
    sectionGap?: { statute: string; section: string },
    exactSectionFound?: boolean,
    requestedSection?: { actId: string; section: string; statuteShortName?: string },
    predecessorFact?: {
      predecessorActId: string;
      predecessorSection: string;
      note?: string;
      /** Another section of the SAME predecessor act that is commonly confused with the predecessor */
      confusingPredecessorSection?: string;
      /** BNSS section that the confusing predecessor maps to */
      confusingBnssSection?: string;
    },
  ): string {
    if (!isBareActQuery) return '';

    const hardRule =
      'HARD RULE: Never claim a statute section "does not exist" or "is not in the Act" unless ' +
      'an exact database lookup has confirmed its absence. Never substitute a different section ' +
      'number in your answer unless the user explicitly asked for suggestions.';

    // Build an authoritative predecessor fact block when remap data is available.
    const predecessorBlock = predecessorFact
      ? buildPredecessorFactBlock(requestedSection, predecessorFact)
      : '';

    if (exactSectionFound && requestedSection) {
      return [
        'BARE-ACT GROUNDING MODE (exact authority pinned):',
        `Answer ONLY about ${requestedSection.statuteShortName ?? requestedSection.actId.toUpperCase()} Section ${requestedSection.section}. Do not mention or substitute a different section number.`,
        '1. Begin with an "Applicable provision" block quoting the retrieved statutory fullText verbatim.',
        '2. Only then provide analysis. Do not add writ/remedy language absent from the provision.',
        predecessorBlock,
        hardRule,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (sectionGap || exactSectionFound === false) {
      const statuteLabel = sectionGap
        ? `${sectionGap.statute} s.${sectionGap.section}`
        : 'the requested section';
      return [
        'BARE-ACT SUPPLEMENTAL MODE:',
        `${statuteLabel} was not retrieved from corpus.`,
        'Do NOT invent the section text or section number from model memory.',
        '1. Say the exact section text was not retrieved from the corpus.',
        '2. Use only retrieved related provisions as context.',
        '3. Mark any non-retrieved statute proposition as unverified and needing lawyer review.',
        '4. Prefer retrieving/re-ingesting the official bare act over filling gaps from memory.',
        predecessorBlock,
        hardRule,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (!hasFullText) {
      return [predecessorBlock, hardRule].filter(Boolean).join('\n');
    }
    return [
      'BARE-ACT GROUNDING MODE:',
      '1. Begin with an "Applicable provision" block quoting the retrieved statutory fullText verbatim (or the closest contiguous excerpt if very long).',
      '2. Only then provide analysis — do not substitute writ/remedy language that is not in the quoted provision.',
      '3. If the retrieved text does not cover the asked section, mark the point unverified rather than supplying section text from memory.',
      predecessorBlock,
      hardRule,
    ]
      .filter(Boolean)
      .join('\n');
  }
}

// ─── Deterministic BNSS text normalizer ───────────────────────────────────────
//
// Called BEFORE the verification pipeline so the sanity checker never sees
// wrong sections, preventing unnecessary regeneration passes.
//
// Correct BNSS mapping (verified against India Code / Gazette):
//   s.461 — Warrant for levy of fine (attachment, sale of movables, Collector)
//   s.462 — Effect of such warrant (issued under s.461)
//   s.464 — Suspension of default imprisonment; instalment/time payment of fine
//   s.465 — Who may issue a warrant (NOT instalment; NOT fine recovery)
//
// Also strips AI-generated "Section-mapping correction:" prose that leaks into
// user-facing memos when the model self-corrects inline.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministically repair known BNSS section citation errors in AI-generated
 * legal memo text and strip internal correction-note artefacts.
 *
 * Safe to call multiple times (idempotent after first pass).
 */
export function normalizeBnssText(text: string): string {
  let out = text;

  // 1. Strip "Section-mapping correction: ..." paragraphs (single- and multi-line).
  //    These are internal artefacts where the model self-corrects inline instead
  //    of using the right section from the start.
  out = out.replace(
    /Section-mapping correction:\s*[^\n]+(?:\n(?![\n#>|*-])[ \t]*[^\n]+)*/g,
    '',
  );

  // 2. Strip "(retrieved authority labelled as s.NNN in source)" qualifiers.
  out = out.replace(/\(retrieved authority[^)]*labelled[^)]*s\.\d+[^)]*source[^)]*\)/gi, '');

  // 3. Strip "(retrieved authority, with section-mapping correction applied…)" qualifiers.
  out = out.replace(/\(retrieved authority[^)]*section-mapping[^)]*\)/gi, '');

  // 4. Strip trailing "*(retrieved authority, with section-mapping correction applied — see below)*"
  out = out.replace(/\*?\(retrieved authority[^)]*section-mapping[^)]*\)\*?/gi, '');

  // 5. Fix "BNSS ss.462, 465" (wrong pair) → "BNSS ss.461, 464" (correct pair).
  out = out.replace(/\bBNSS\s+ss?\.?\s*462\s*,\s*465\b/gi, 'BNSS ss.461, 464');

  // 6. Fix "BNSS ss.462, 464" → "BNSS ss.461, 464"
  //    (s.461 is levy; s.464 is instalments — s.462 is the effect provision only)
  out = out.replace(/\bBNSS\s+ss?\.?\s*462\s*,\s*464\b/gi, 'BNSS ss.461, 464');

  // 7. Fix "Retrieved statutory authorities (BNSS ss.462, 464…)" references.
  out = out.replace(/BNSS\s+ss\.462,\s*464/gi, 'BNSS ss.461, 464');

  // 8. Fix s.462 used as the fine-recovery/levy provision → s.461.
  //    Context words: fine recovery, levy, attachment, Collector, movable property.
  out = out.replace(
    /\bBNSS\s+ss?\.?\s*462\b([^.;\n]{0,60}(?:fine\s+recovery|levy|attachment|Collector|movable\s+property))/gi,
    (m, tail) => m.replace(/462/, '461') + '',
  );
  out = out.replace(
    /\bBNSS\s+ss?\.?\s*462\s*\(\s*[Ff]ine\s+[Rr]ecovery/g,
    'BNSS s.461 (Warrant for levy of fine',
  );
  // Table row: "BNSS s.462 (fine recovery — levy warrant)"
  out = out.replace(
    /BNSS\s+s\.462\s*\([Ff]ine\s+[Rr]ecovery[^)]*\)/gi,
    'BNSS s.461 (warrant for levy of fine)',
  );
  // Plain "BNSS s.462" remaining in a levy/recovery heading line
  out = out.replace(
    /((?:fine recovery|levy warrant|levy of fine|Collector warrant)[^\n]{0,60})\bBNSS\s+ss?\.?\s*462\b/gi,
    (m) => m.replace(/462/, '461'),
  );

  // 9. Fix s.465 used as the instalment/suspension provision → s.464.
  //    Context words: instalment, installment, suspension, time to pay, default imprisonment.
  out = out.replace(
    /\bBNSS\s+ss?\.?\s*465\b([^.;\n]{0,60}(?:instalment|installment|suspension|time\s+to\s+pay|pay.*?fine|default\s+imprison))/gi,
    (m, tail) => m.replace(/465/, '464') + '',
  );
  out = out.replace(
    /\bBNSS\s+ss?\.?\s*465\s*\(\s*[Ii]nstalment/g,
    'BNSS s.464 (Suspension',
  );
  // "Section 465, BNSS" in instalment context
  out = out.replace(
    /[Ss]ection\s+465[^.;\n]{0,60}(?:instalment|installment|suspension|time\s+to\s+pay|default\s+imprison)/g,
    (m) => m.replace(/465/, '464'),
  );
  // "under BNSS s.465" / "under Section 465 BNSS" for instalments
  out = out.replace(
    /(instalment|installment|suspension|time\s+to\s+pay|default\s+imprison)[^\n]{0,60}\bBNSS\s+ss?\.?\s*465\b/gi,
    (m) => m.replace(/465/, '464'),
  );

  // 10. Fix authorities table entry:
  //     "BNSS s.462 (fine recovery — levy warrant)" in | table | rows
  out = out.replace(
    /\|\s*BNSS\s+s\.462\s*\([^|]*?\)\s*\|/gi,
    (m) => m.replace(/462/, '461'),
  );

  // 11. Clean up orphaned blank lines left by removed correction paragraphs.
  out = out.replace(/\n{3,}/g, '\n\n');

  return out;
}
