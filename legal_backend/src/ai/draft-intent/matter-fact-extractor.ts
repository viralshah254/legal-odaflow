/** Lightweight fact extraction from pasted narratives for contextual clarifications. */

export interface ExtractedMatterParties {
  petitioner?: string;
  respondent?: string;
  label?: string;
}

export interface CitedStatute {
  actId: string;
  section: string;
  raw: string;
}

export interface ExtractedMatterFacts {
  parties: ExtractedMatterParties;
  proceedingType?: 'dv' | 'maintenance' | 'matrimonial' | 'criminal' | 'civil';
  posture?: 'challenge' | 'apply' | 'defend';
  orderType?: 'interim' | 'final';
  orderAmount?: string;
  hasDvCase: boolean;
  hasMaintenanceContext: boolean;
  hasInterimOrder: boolean;
  hasMarriageValidityChallenge: boolean;
  hasEarningCapacityDefence: boolean;
  hasDowryDenial: boolean;
  /** User alleges stalking / cyberstalking (legal label, not proven facts). */
  hasStalkingAllegation: boolean;
  /** Online / electronic monitoring or messaging signals. */
  hasOnlineConduct: boolean;
  /** Physical following / waiting outside signals. */
  hasPhysicalFollowConduct: boolean;
  /** Threats, sexual remarks, violence, trespass. */
  hasThreatOrViolenceSignals: boolean;
  /** Narrative reports a death (died / killed / deceased / fatal). */
  hasDeathOutcome: boolean;
  /** Self-defence / private defence language or save-himself posture. */
  hasSelfDefenseSignals: boolean;
  /** Death + violence/self-defence — ambiguous complainant vs accused posture. */
  isSelfDefenseHomicideContext: boolean;
  /** Accused / client name extracted from caption, Accused: block, or drafting instructions. */
  accusedName?: string;
  /** Chargesheet filed / submitted language in the narrative. */
  hasChargesheetFiled: boolean;
  /** User seeks discharge (application for discharge / BNSS §250/§262). */
  seeksDischarge: boolean;
  /** Best-effort custody/stage inference from facts (not a user answer). */
  inferredCustodyStage?: 'pre_complaint' | 'investigation' | 'arrest_feared' | 'in_custody_or_chargesheet';
  /** Allegation verb present but concrete acts / frequency / dates missing. */
  isSparseAllegation: boolean;
  /** Explicit statute citations parsed from the narrative (e.g. BNS §78). */
  citedStatutes: CitedStatute[];
  /** Child custody / visitation / education expenses dispute. */
  hasChildCustodyDispute: boolean;
  /** Seeks interim maintenance, pendente lite, or litigation expenses during matrimonial proceedings. */
  seeksInterimMaintenance: boolean;
  /** Seeks return / protection of jewellery, stridhan, or dowry articles. */
  seeksStridhanRecovery: boolean;
  /** Seeks financial disclosure / assets and liabilities statement. */
  seeksFinancialDisclosure: boolean;
  /** Best-effort inference of which party the user represents. */
  inferredRepresentedParty?: 'petitioner' | 'respondent' | 'unknown';
  /** Primary divorce ground inferred from facts (for bundle labels). */
  inferredDivorceGround?: 'cruelty' | 'desertion' | 'adultery' | 'unknown';
  summaryLines: string[];
}

/** Matches "A vs B", "A v. B", "A versus B" — up to 5 name tokens per side (same line). */
const PARTY_NAME = String.raw`[A-Za-z][A-Za-z.']*(?:[ \t]+[A-Za-z][A-Za-z.']*){0,4}`;
const VS_PATTERN = new RegExp(
  String.raw`\b(${PARTY_NAME})\s+(?:vs\.?|v\.?|versus)\s+(${PARTY_NAME})\b`,
  'i',
);

const STATE_PARTY =
  /^(?:the\s+)?(?:state(?:\s+of\s+[A-Za-z\s]+)?|union\s+of\s+india|govt\.?(?:\s+of\s+[A-Za-z\s]+)?|government(?:\s+of\s+[A-Za-z\s]+)?)$/i;

const ACCUSED_BLOCK =
  /\bAccused\s*:\s*\n?\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})(?:\s*[,.]|\s+aged|\s*$)/im;

const ON_BEHALF_OF =
  /\bon\s+behalf\s+of\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b/;

const ACCUSED_STATES =
  /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\s+states\s+that\b/;

/** Strip trailing caption noise (e.g. "Mehta\nJurisdiction"). */
function cleanPartyName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\b(?:Jurisdiction|Date|Parties|Background|Incident)\b.*$/i, '')
    .trim();
}

/**
 * Deterministic accused / client name for self-defence intake labels.
 * Priority: Accused: block → on behalf of → State v. X caption → "X states that".
 */
export function extractAccusedName(text: string): string | undefined {
  const accusedBlock = text.match(ACCUSED_BLOCK);
  if (accusedBlock?.[1]) {
    const name = cleanPartyName(accusedBlock[1]);
    if (name) return name;
  }

  const behalf = text.match(ON_BEHALF_OF);
  if (behalf?.[1]) {
    const name = cleanPartyName(behalf[1]);
    if (name) return name;
  }

  const vsMatch = text.match(VS_PATTERN);
  if (vsMatch) {
    const left = cleanPartyName(vsMatch[1]);
    const right = cleanPartyName(vsMatch[2]);
    if (STATE_PARTY.test(left) && right) return right;
    if (STATE_PARTY.test(right) && left) return left;
  }

  const states = text.match(ACCUSED_STATES);
  if (states?.[1]) {
    const name = cleanPartyName(states[1]);
    // Avoid matching generic openers like "Defence states that"
    if (name && !/^(?:defence|defense|prosecution|he|she|they|it)$/i.test(name)) {
      return name;
    }
  }

  return undefined;
}

const MONTHLY_PAYMENT =
  /\b(?:pay|paid|payment of|ordered to pay)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)\s*(?:per month|monthly|p\.?m\.?)\b/i;

const INTERIM_ORDER =
  /\binterim\s+order\b|\bpendente\s+lite\b|\btemporary\s+(?:maintenance|order)\b/i;

const STALKING_ALLEGATION =
  /\bstalk(?:s|ing|ed)?\b|\bcyber\s*-?\s*stalk(?:s|ing|ed)?\b|\bharass(?:es|ing|ed|ment)?\b.{0,40}\b(?:follow|message|call)/i;

const ONLINE_CONDUCT =
  /\b(?:whatsapp|instagram|facebook|twitter|x\.com|social\s+media|email|e-mail|sms|text\s+message|monitor(?:ed|ing)?\s+(?:her|his|their)?\s*(?:online|internet|email|social)|fake\s+account|digital\s+(?:surveillance|impersonation)|online\s+(?:threat|harass|message)|cyber)\b/i;

const PHYSICAL_FOLLOW =
  /\b(?:follow(?:ed|ing)?\s+(?:her|him|them)|wait(?:ed|ing)?\s+outside|outside\s+(?:her|his|their)\s+(?:home|college|workplace|office)|physically\s+follow)\b/i;

const THREAT_VIOLENCE =
  /\b(?:threat(?:s|en(?:ed|ing)?)?|sexual\s+remark|obscene\s+(?:message|call)|touch(?:ed|ing)|intimidation|trespass|violence|assault|presently\s+unsafe|immediate\s+danger|stab(?:bed|bing)?|attempt(?:ed)?\s+(?:to\s+)?(?:kill|murder|stab)|tried\s+to\s+stab)\b/i;

const DEATH_OUTCOME =
  /\b(?:died|dead|death|killed|killing|deceased|fatal(?:ly)?|passed\s+away|succumbed|homicide|murder(?:ed)?)\b/i;

/** Fatal fall from height without an explicit "died" word (common in balcony narratives). */
const IMPLIED_DEATH =
  /\b(?:fell\s+off.{0,40}(?:balcony|terrace|ledge|building|roof|floor)|fell\s+from.{0,40}(?:balcony|terrace|height|building|roof)|fatal\s+fall|fell\s+to\s+(?:her|his|their)\s+death)\b/i;

const SELF_DEFENSE =
  /\b(?:self[-\s]?defen[cs]e|private\s+defen[cs]e|right\s+of\s+private\s+defen[cs]e|defending\s+(?:himself|herself|themselves|myself)|trying\s+to\s+save\s+(?:himself|herself|themselves|myself|his\s+life|her\s+life)|save\s+(?:himself|herself|themselves|myself)|in\s+order\s+to\s+save)\b/i;

const CHARGESHEET_FILED =
  /\bchargesheet\s+(?:filed|submitted|served)|charge[\s-]?sheet\s+(?:filed|submitted)|charges?\s+have\s+been\s+framed|after\s+(?:the\s+)?chargesheet\b/i;

const SEEKS_DISCHARGE =
  /\b(?:application\s+for\s+discharge|discharge\s+application|seeks?\s+discharge|bnss\s*§?\s*250|bnss\s*§?\s*262)\b/i;

const CONCRETE_ACT =
  /\b(?:follow(?:ed|ing)|wait(?:ed|ing)\s+outside|call(?:ed|ing)|messag(?:e|ed|ing)|whatsapp|instagram|monitor(?:ed|ing)|screenshot|cctv|witness|told\s+(?:him|her)\s+to\s+stop|disinterest|repeated(?:ly)?)\b/i;

const DATE_OR_FREQUENCY =
  /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d+\s+times?|repeated(?:ly)?|daily|weekly|for\s+\d+\s+(?:days?|weeks?|months?))\b/i;

const CHILD_CUSTODY =
  /\b(?:child(?:ren)?|daughter|son|minor|custody|visitation|supervised\s+access|video\s+call|school\s+fees?|education\s+expenses?|guardianship|interim\s+custody)\b/i;

const LITIGATION_EXPENSES =
  /\b(?:litigation\s+expenses?|proceeding\s+expenses?|legal\s+expenses?|costs?\s+of\s+(?:the\s+)?(?:petition|proceedings?)|pendente\s+lite)\b/i;

const STRIDHAN_RECOVERY =
  /\b(?:stridhan|streedhan|jewell?ery|jewelry|dowry\s+articles?|personal\s+articles?|return\s+of\s+(?:gold|ornaments?|gifts?))\b/i;

const FINANCIAL_DISCLOSURE =
  /\b(?:assets?\s+and\s+liabilit|financial\s+disclosure|income\s+affidavit|form\s+e|bank\s+statements?|property\s+disclosure)\b/i;

const PETITIONER_POSTURE =
  /\b(?:petitioner|on\s+behalf\s+of\s+(?:ms\.?|mrs\.?|mr\.?)?\s*[A-Za-z]+|wife\s+(?:seeks?|wants?|files?)|husband\s+seeks?\s+permission\s+to\s+divorce|seeks?\s+(?:a\s+)?decree\s+of\s+divorce|file(?:s|d)?\s+(?:a\s+)?(?:divorce\s+)?petition|petition\s+for\s+divorce)\b/i;

const RESPONDENT_POSTURE =
  /\b(?:written\s+statement|defend(?:ing|s)?\s+(?:the\s+)?(?:petition|divorce)|respondent|contest(?:s|ing)?\s+the\s+petition|denies?\s+cruelty|reply\s+to\s+(?:the\s+)?petition)\b/i;

const CRUELTY_GROUND =
  /\b(?:cruelty|mental\s+cruelty|verbal\s+abuse|physical\s+abuse|13\s*\(\s*1\s*\)\s*\(\s*ia\s*\)|section\s+13\s*\(\s*1\s*\)\s*\(\s*ia\s*\))\b/i;

const DESERTION_GROUND =
  /\b(?:desertion|withdrawn?\s+from\s+society|living\s+separately|13\s*\(\s*1\s*\)\s*\(\s*ib\s*\))\b/i;

const ADULTERY_GROUND =
  /\b(?:adultery|extramarital|affair|13\s*\(\s*1\s*\)\s*\(\s*i\s*\))\b/i;

export function inferRepresentedParty(text: string): 'petitioner' | 'respondent' | 'unknown' {
  const firstExplicitRole = text.match(
    /\b(?:ms\.?|mrs\.?|mr\.?)\s+[^(\n]+\((petitioner|respondent)\)/i,
  )?.[1]?.toLowerCase();
  if (firstExplicitRole === 'petitioner' || firstExplicitRole === 'respondent') {
    return firstExplicitRole;
  }

  const petitionerScore =
    (PETITIONER_POSTURE.test(text) ? 2 : 0) +
    (/\b(?:wife|husband)\s+seeks?\s+divorce\b/i.test(text) ? 1 : 0) +
    (/\bpetition\s+for\s+divorce\b/i.test(text) ? 1 : 0);
  const respondentScore =
    (RESPONDENT_POSTURE.test(text) ? 2 : 0) +
    (/\bdefend\b/i.test(text) && /\bpetition\b/i.test(text) ? 1 : 0);

  if (petitionerScore > respondentScore && petitionerScore >= 1) return 'petitioner';
  if (respondentScore > petitionerScore && respondentScore >= 1) return 'respondent';
  return 'unknown';
}

export function inferDivorceGround(text: string): 'cruelty' | 'desertion' | 'adultery' | 'unknown' {
  if (CRUELTY_GROUND.test(text)) return 'cruelty';
  if (DESERTION_GROUND.test(text)) return 'desertion';
  if (ADULTERY_GROUND.test(text)) return 'adultery';
  return 'unknown';
}

export function hasMaintenanceLanguage(text: string): boolean {
  return (
    /\bmaintenance\b|\balimony\b/i.test(text) ||
    INTERIM_ORDER.test(text) ||
    MONTHLY_PAYMENT.test(text) ||
    /\binterim\s+order\b.{0,80}\b(?:pay|payment)\b/i.test(text)
  );
}

export function hasDvLanguage(text: string): boolean {
  return (
    /\bdomestic\s+violence\b|\bpwdva\b|\bdv\s+case\b|\bdv\s+act\b|\bprotection\s+of\s+women\b/i.test(
      text,
    )
  );
}

export function parseCitedStatutes(text: string): CitedStatute[] {
  const found: CitedStatute[] = [];
  const seen = new Set<string>();

  const patterns: Array<{ re: RegExp; actId: string; sectionGroup: number }> = [
    { re: /\b(?:section|sec\.?|s\.?|§)\s*(\d+[A-Za-z]?)\s*(?:of\s+)?(?:the\s+)?bns\b/gi, actId: 'bns', sectionGroup: 1 },
    { re: /\bbns\s*(?:section|sec\.?|s\.?|§)?\s*(\d+[A-Za-z]?)\b/gi, actId: 'bns', sectionGroup: 1 },
    { re: /\b(?:section|sec\.?|s\.?|§)\s*(\d+[A-Za-z]?)\s*(?:of\s+)?(?:the\s+)?bnss\b/gi, actId: 'bnss', sectionGroup: 1 },
    { re: /\bbnss\s*(?:section|sec\.?|s\.?|§)?\s*(\d+[A-Za-z]?)\b/gi, actId: 'bnss', sectionGroup: 1 },
    { re: /\b(?:section|sec\.?|s\.?|§)\s*(\d+[A-Za-z]?)\s*(?:of\s+)?(?:the\s+)?ipc\b/gi, actId: 'ipc', sectionGroup: 1 },
  ];

  for (const { re, actId, sectionGroup } of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const section = m[sectionGroup]?.trim();
      if (!section) continue;
      const key = `${actId}:${section.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ actId, section, raw: m[0].trim() });
    }
  }

  return found;
}

export function hasBns78Citation(cited: CitedStatute[]): boolean {
  return cited.some((c) => c.actId === 'bns' && /^78$/i.test(c.section));
}

export function extractMatterFacts(text: string): ExtractedMatterFacts {
  const trimmed = text.trim();
  const parties: ExtractedMatterParties = {};

  const vsMatch = trimmed.match(VS_PATTERN);
  if (vsMatch) {
    parties.petitioner = cleanPartyName(vsMatch[1]);
    parties.respondent = cleanPartyName(vsMatch[2]);
    parties.label = `${parties.petitioner} vs ${parties.respondent}`;
  }

  const accusedName = extractAccusedName(trimmed);

  const hasDvCase = hasDvLanguage(trimmed);
  const hasInterimOrder = INTERIM_ORDER.test(trimmed);
  const hasMaintenanceContext = hasMaintenanceLanguage(trimmed);
  const amountMatch = trimmed.match(MONTHLY_PAYMENT);

  const hasStalkingAllegation = STALKING_ALLEGATION.test(trimmed);
  const hasOnlineConduct = ONLINE_CONDUCT.test(trimmed);
  const hasPhysicalFollowConduct = PHYSICAL_FOLLOW.test(trimmed);
  const hasThreatOrViolenceSignals = THREAT_VIOLENCE.test(trimmed);
  const hasDeathOutcome = DEATH_OUTCOME.test(trimmed) || IMPLIED_DEATH.test(trimmed);
  const hasSelfDefenseSignals = SELF_DEFENSE.test(trimmed);
  const isSelfDefenseHomicideContext =
    hasDeathOutcome &&
    (hasSelfDefenseSignals ||
      (hasThreatOrViolenceSignals &&
        /\b(?:stab|attack|assault|kill|murder|balcony|fell\s+off)\b/i.test(trimmed)));
  const hasChargesheetFiled = CHARGESHEET_FILED.test(trimmed);
  const seeksDischarge = SEEKS_DISCHARGE.test(trimmed);
  let inferredCustodyStage: ExtractedMatterFacts['inferredCustodyStage'];
  if (hasChargesheetFiled || seeksDischarge) {
    inferredCustodyStage = 'in_custody_or_chargesheet';
  } else if (/\barrest\s+feared|notice\s+of\s+appearance|anticipatory\s+bail\b/i.test(trimmed)) {
    inferredCustodyStage = 'arrest_feared';
  } else if (/\binvestigation\s+ongoing|fir\s+(?:already\s+)?registered|under\s+investigation\b/i.test(trimmed)) {
    inferredCustodyStage = 'investigation';
  } else if (
    isSelfDefenseHomicideContext &&
    !/\bfir\b|\bchargesheet\b|\barrest\b/i.test(trimmed)
  ) {
    inferredCustodyStage = 'pre_complaint';
  }
  const citedStatutes = parseCitedStatutes(trimmed);
  const citesBns78 = hasBns78Citation(citedStatutes);

  const isSparseAllegation =
    (hasStalkingAllegation || citesBns78) &&
    !CONCRETE_ACT.test(trimmed) &&
    !DATE_OR_FREQUENCY.test(trimmed);

  let proceedingType: ExtractedMatterFacts['proceedingType'];
  if (hasDvCase) proceedingType = 'dv';
  else if (hasMaintenanceContext) proceedingType = 'maintenance';
  else if (/\bmatrimon|\bmarriage\b|\bdivorce\b/i.test(trimmed)) proceedingType = 'matrimonial';
  else if (
    isSelfDefenseHomicideContext ||
    hasStalkingAllegation ||
    citesBns78 ||
    /\bcriminal\b|\bfir\b|\bbail\b|\bcomplaint\s+against\b/i.test(trimmed)
  ) {
    proceedingType = 'criminal';
  } else if (/\bcivil\b|\bplaint\b|\bsuit\b/i.test(trimmed)) proceedingType = 'civil';

  let posture: ExtractedMatterFacts['posture'];
  if (isSelfDefenseHomicideContext && hasSelfDefenseSignals) {
    // Death + self-defence is usually an accused/defence posture until the user clarifies.
    posture = 'defend';
  } else if (/\bchallenge\b|\bchalleng|\bset\s+aside\b|\bimpugn\b|\bquash\b|\brevision\b/i.test(trimmed)) {
    posture = 'challenge';
  } else if (/\bdefend\b|\bdeny\b|\bdenies\b|\bcontest\b|\bdispute\b/i.test(trimmed)) {
    posture = 'defend';
  } else if (/\bfile\b|\bapply\b|\bseek\b|\bpetition\s+for\b|\bcomplaint\b/i.test(trimmed)) {
    posture = 'apply';
  }

  let orderType: ExtractedMatterFacts['orderType'];
  if (hasInterimOrder) orderType = 'interim';
  else if (/\bfinal\s+order\b|\bdisposed\s+on\s+merits\b/i.test(trimmed)) orderType = 'final';

  const hasMarriageValidityChallenge =
    /\bno\s+marriage\b|\bmarriage\s+did\s+not\b|\bwithout\s+hindu\s+ritual|\bnot\s+per\s+hindu\s+ritual|\bmarriage\s+never\b|\bnullity\b/i.test(
      trimmed,
    );
  const hasEarningCapacityDefence =
    /\beducated\b|\bearning\s+capacity\b|\bsitting\s+idle\b|\bemployed\b|\bself[-\s]?sufficient\b/i.test(
      trimmed,
    );
  const hasDowryDenial =
    /\bno\s+dowry\b|\bdowry\s+demand\s+never\b|\bnever\s+demand(ed)?\s+dowry\b/i.test(trimmed);

  const hasChildCustodyDispute = CHILD_CUSTODY.test(trimmed);
  const seeksInterimMaintenance =
    hasMaintenanceLanguage(trimmed) ||
    LITIGATION_EXPENSES.test(trimmed) ||
    /\binterim\s+maintenance\b/i.test(trimmed);
  const seeksStridhanRecovery = STRIDHAN_RECOVERY.test(trimmed);
  const seeksFinancialDisclosure =
    FINANCIAL_DISCLOSURE.test(trimmed) ||
    (seeksInterimMaintenance && /\b(?:income|salary|employed|assets?)\b/i.test(trimmed));
  const inferredRepresentedParty = inferRepresentedParty(trimmed);
  const inferredDivorceGround = inferDivorceGround(trimmed);

  const summaryLines: string[] = [];
  if (parties.label) summaryLines.push(`Parties: ${parties.label}`);
  if (accusedName) summaryLines.push(`Accused / client: ${accusedName}`);
  if (hasDvCase) summaryLines.push('Proceeding: Domestic Violence case');
  if (hasInterimOrder && amountMatch) {
    summaryLines.push(`Interim order: ₹${amountMatch[1].replace(/,/g, '')}/month`);
  } else if (hasInterimOrder) {
    summaryLines.push('Interim order in place');
  } else if (hasMaintenanceContext) {
    summaryLines.push('Maintenance / financial order context');
  }
  if (hasStalkingAllegation) {
    summaryLines.push(
      isSparseAllegation
        ? 'Allegation: stalking (facts incomplete — need conduct details)'
        : 'Allegation: stalking / harassment',
    );
  }
  if (citesBns78) summaryLines.push('Cited statute: BNS §78 (stalking)');
  else if (citedStatutes.length > 0) {
    summaryLines.push(`Cited: ${citedStatutes.map((c) => c.raw).join(', ')}`);
  }
  if (hasOnlineConduct) summaryLines.push('Conduct medium: online / electronic signals');
  if (hasPhysicalFollowConduct) summaryLines.push('Conduct medium: physical following signals');
  if (hasThreatOrViolenceSignals) summaryLines.push('Aggravating: threats / violence signals');
  if (isSelfDefenseHomicideContext) {
    summaryLines.push(
      'CRITICAL: death reported with self-defence / attack narrative — posture ambiguous (complainant vs accused). Do not assume FIR filing.',
    );
  }
  if (hasChargesheetFiled) summaryLines.push('Procedural: chargesheet filed');
  if (seeksDischarge) summaryLines.push('Relief sought: discharge');
  if (posture === 'challenge') summaryLines.push('Posture: challenging an existing order');
  else if (posture === 'defend') summaryLines.push('Posture: defending against allegations');
  if (hasMarriageValidityChallenge) summaryLines.push('Issue: marriage validity / Hindu rituals');
  if (hasEarningCapacityDefence) summaryLines.push('Issue: respondent earning capacity');
  if (hasDowryDenial) summaryLines.push('Issue: denial of dowry demand');
  if (hasChildCustodyDispute) summaryLines.push('Issue: child custody / visitation / child expenses');
  if (seeksInterimMaintenance) summaryLines.push('Relief: interim maintenance / litigation expenses');
  if (seeksStridhanRecovery) summaryLines.push('Relief: return / protection of jewellery or stridhan');
  if (seeksFinancialDisclosure) summaryLines.push('Relief: financial disclosure / assets statement');
  if (inferredRepresentedParty !== 'unknown') {
    summaryLines.push(`Represented party: ${inferredRepresentedParty}`);
  }
  if (inferredDivorceGround !== 'unknown') {
    summaryLines.push(`Divorce ground signal: ${inferredDivorceGround}`);
  }

  return {
    parties,
    proceedingType,
    posture,
    orderType,
    orderAmount: amountMatch?.[1]?.replace(/,/g, ''),
    hasDvCase,
    hasMaintenanceContext,
    hasInterimOrder,
    hasMarriageValidityChallenge,
    hasEarningCapacityDefence,
    hasDowryDenial,
    hasStalkingAllegation,
    hasOnlineConduct,
    hasPhysicalFollowConduct,
    hasThreatOrViolenceSignals,
    hasDeathOutcome,
    hasSelfDefenseSignals,
    isSelfDefenseHomicideContext,
    accusedName,
    hasChargesheetFiled,
    seeksDischarge,
    inferredCustodyStage,
    isSparseAllegation,
    citedStatutes,
    hasChildCustodyDispute,
    seeksInterimMaintenance,
    seeksStridhanRecovery,
    seeksFinancialDisclosure,
    inferredRepresentedParty,
    inferredDivorceGround,
    summaryLines,
  };
}

export function isFamilyDisputeContext(
  practiceArea: string | undefined,
  extracted: ExtractedMatterFacts,
): boolean {
  if (practiceArea === 'family_matrimonial') return true;
  return (
    extracted.hasDvCase ||
    extracted.hasMaintenanceContext ||
    extracted.proceedingType === 'matrimonial'
  );
}

export function isStalkingComplaintContext(
  profile: { practiceArea?: string; subPracticeArea?: string } | undefined,
  extracted: ExtractedMatterFacts,
): boolean {
  if (extracted.hasStalkingAllegation || hasBns78Citation(extracted.citedStatutes)) return true;
  return (
    profile?.practiceArea === 'litigation_disputes' &&
    profile?.subPracticeArea === 'criminal_complaint_filing'
  );
}

/** Death + self-defence / violent attack — must clarify complainant vs accused before drafting. */
export function isSelfDefenseHomicideContext(extracted: ExtractedMatterFacts): boolean {
  return extracted.isSelfDefenseHomicideContext;
}

/**
 * Override MI profile when deterministic extraction shows criminal self-defence homicide.
 * Prevents wife/marriage language from locking the UI into maintenance / Family Court.
 */
export function applyExtractedProfileOverride<
  T extends {
    practiceArea: string;
    subPracticeArea?: string;
    forum?: string;
    curatedKinds: string[];
    issues: string[];
    documentTypes: string[];
    documentKind?: string;
    confidence: number;
    fieldConfidence?: {
      practiceArea: number;
      subPracticeArea: number;
      nature: number;
      forum: number;
    };
  },
>(profile: T, extracted: ExtractedMatterFacts, query?: string): T {
  if (!extracted.isSelfDefenseHomicideContext) return profile;

  const wantsDischarge =
    extracted.seeksDischarge ||
    Boolean(query && SEEKS_DISCHARGE.test(query));

  const curatedKinds = [
    ...(wantsDischarge || extracted.hasChargesheetFiled
      ? ['india_discharge_application_bnss_250', 'india_reply_to_chargesheet']
      : ['india_reply_to_chargesheet', 'india_discharge_application_bnss_250']),
    'india_regular_bail_bnss_480',
    'india_anticipatory_bail_bnss_482',
  ].filter((k, i, arr) => arr.indexOf(k) === i);

  const issues = [
    'Criminal defence — not matrimonial maintenance',
    ...(profile.issues ?? []).filter(
      (i) => !/maintenance|matrimonial|family court|alimony/i.test(i),
    ),
  ];

  const prev = profile.fieldConfidence;
  return {
    ...profile,
    practiceArea: 'litigation_disputes',
    subPracticeArea: 'criminal_fir_bail',
    forum: 'sessions_court',
    curatedKinds,
    documentTypes: [
      wantsDischarge || extracted.hasChargesheetFiled
        ? 'discharge_application'
        : 'defense_memo',
      'bail_application',
      'defense_memo',
    ],
    documentKind:
      wantsDischarge || extracted.hasChargesheetFiled
        ? 'discharge_application'
        : profile.documentKind === 'maintenance_application' ||
            profile.documentKind === 'maintenance_order_revision'
          ? 'defense_memo'
          : profile.documentKind,
    issues,
    confidence: Math.min(profile.confidence, 0.55),
    fieldConfidence: {
      practiceArea: Math.min(prev?.practiceArea ?? 0.55, 0.7),
      subPracticeArea: Math.min(prev?.subPracticeArea ?? 0.55, 0.55),
      nature: Math.min(prev?.nature ?? 0.55, 0.7),
      forum: Math.min(prev?.forum ?? 0.55, 0.55),
    },
  };
}

const SUPPLEMENTAL_MAX = 2000;

/** Merge base narrative with user-added action context for re-analysis. */
export function buildEffectiveQuery(base: string, supplemental?: string): string {
  const trimmedBase = base.trim();
  const trimmedSupplemental = supplemental?.trim();
  if (!trimmedSupplemental) return trimmedBase;
  return `${trimmedBase}\n\nADDITIONAL CONTEXT (user-provided):\n${trimmedSupplemental.slice(0, SUPPLEMENTAL_MAX)}`;
}

/** Build supplemental block from per-action notes (frontend/backend shared shape). */
export function buildSupplementalFromActionNotes(
  actionNotes: Record<string, string>,
): string {
  const lines = Object.entries(actionNotes)
    .filter(([, value]) => value.trim())
    .map(([action, value]) => `Regarding "${action}": ${value.trim()}`);
  return lines.join('\n').slice(0, SUPPLEMENTAL_MAX);
}
