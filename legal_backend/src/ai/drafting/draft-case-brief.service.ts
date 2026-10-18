import { Injectable } from '@nestjs/common';
import {
  extractAccusedName,
  extractMatterFacts,
} from '@/ai/draft-intent/matter-fact-extractor';
import type {
  BriefEvidenceItem,
  BriefParty,
  DraftCaseBrief,
  ProceduralStage,
} from './draft-case-brief.types';

const DATE_RE =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/gi;

const FIR_DATE_RE =
  /\bFIR\b[\s\S]{0,60}?(?:dated|on|dt\.?)\s*[:=]?\s*([^\n.;,]{4,40})/i;
const ARREST_DATE_RE =
  /\b(?:arrest(?:ed)?|taken\s+into\s+custody)\b[\s\S]{0,40}?(?:(?:on|dated|dt\.?)\s*[:=]?\s*)?([^\n.;,]{4,40})/i;
const CHARGESHEET_DATE_RE =
  /\b(?:chargesheet|charge[\s-]?sheet)\b[\s\S]{0,60}?(?:filed|submitted|on|dated)\s*[:=]?\s*([^\n.;,]{4,40})/i;
const FIR_NO_RE =
  /\bFIR\s*(?:No\.?|Number|#)?\s*[:=]?\s*([A-Za-z0-9\/\-]+)/i;
const PS_RE =
  /\b(?:P\.?S\.?|Police\s+Station)\s*[:=]?\s*([A-Za-z][A-Za-z\s.]{2,40})/i;

const DEFENCE_MARKERS =
  /\b(?:defence|defense|accused\s+states|applicant\s+states|it\s+is\s+submitted|contrary\s+to|falsely|no\s+CCTV|parity|co-accused|forensic|Wi-?Fi|CDR|shopkeeper|intimidation|alibi|innocent)\b/i;

const PROSECUTION_MARKERS =
  /\b(?:allegation|alleged|FIR\s+states|prosecution|complainant\s+alleges|according\s+to\s+the\s+complaint)\b/i;

const WEAK_PHRASE_CONSTRAINTS = [
  'Do not invent cooperation with investigation unless stated in intake',
  'Do not use "benefit of doubt" as a standalone ground',
  'Do not use "person of means" / class-based arguments',
  'Do not write "acknowledges serious nature of the offence" as a concession',
  'Criminal bail: use Applicant–Accused, not Petitioner',
  'Post-chargesheet: do not say "investigation ongoing"; cite Section 193 BNSS for chargesheet (not Section 173)',
];

@Injectable()
export class DraftCaseBriefService {
  extract(caseDetails: string, kind?: string): DraftCaseBrief {
    const text = (caseDetails ?? '').trim();
    const matter = extractMatterFacts(text);
    const accused = extractAccusedName(text) ?? matter.accusedName;

    const parties = this.extractParties(text, accused);
    const firDate = this.pickDate(text, FIR_DATE_RE) ?? undefined;
    const arrestDate = this.pickDate(text, ARREST_DATE_RE) ?? undefined;
    const chargesheetDate = this.pickDate(text, CHARGESHEET_DATE_RE) ?? undefined;
    const firNo = text.match(FIR_NO_RE)?.[1]?.trim();
    const policeStation = text.match(PS_RE)?.[1]?.trim()?.replace(/\s+/g, ' ');

    const proceduralStage = this.resolveStage(text, matter.hasChargesheetFiled, !!arrestDate);
    const { defenceFacts, prosecutionFacts } = this.splitFacts(text);
    const contradictions = this.extractContradictions(text);
    const evidenceItems = this.extractEvidence(text);
    const requiredGrounds = [
      ...defenceFacts.map((f, i) => `Ground on defence fact ${i + 1}: ${f}`),
      ...contradictions.map((c, i) => `Ground on contradiction ${i + 1}: ${c}`),
    ];

    const draftingConstraints = [...WEAK_PHRASE_CONSTRAINTS];
    if (/bail/i.test(kind ?? '') || /bail/i.test(text)) {
      draftingConstraints.push(
        'Each ground must cite a verified authority from the registry',
        'Fact-anchor every ground to intake — no generic bail template filler',
      );
    }
    if (proceduralStage === 'post_chargesheet' || matter.hasChargesheetFiled) {
      draftingConstraints.push(
        'Chargesheet already filed — use post-chargesheet language; BNSS §193 for police report / chargesheet',
      );
    }

    const missingCriticalFields: string[] = [];
    const isBail = /bail/i.test(kind ?? '') || /bail/i.test(text);
    if (isBail) {
      if (!firDate) missingCriticalFields.push('firDate');
      if (!parties.some((p) => p.role === 'applicant' || p.role === 'accused')) {
        missingCriticalFields.push('applicantName');
      }
      if (proceduralStage === 'unknown') missingCriticalFields.push('proceduralStage');
    }

    return {
      parties,
      proceduralHistory: {
        firDate,
        firNo,
        policeStation,
        arrestDate,
        chargesheetDate,
        coAccusedBailGranted: /\b(?:co[- ]?accused|other\s+accused).{0,40}\b(?:granted|enlarged\s+on)\s+bail\b/i.test(
          text,
        ),
      },
      proceduralStage,
      prosecutionFacts,
      defenceFacts,
      evidenceItems,
      contradictions,
      citedOffences: matter.citedStatutes.map((s) => ({
        actId: s.actId,
        section: s.section,
        raw: s.raw,
      })),
      requiredGrounds,
      draftingConstraints,
      blanks: {
        firNo: !firNo,
        policeStation: !policeStation,
        firDate: !firDate,
      },
      intakeIncomplete: missingCriticalFields.length > 0,
      missingCriticalFields,
      rawSummary: text.slice(0, 2000),
      extractedAt: new Date().toISOString(),
    };
  }

  buildPromptBlock(brief: DraftCaseBrief): string {
    const lines: string[] = [
      'CASE BRIEF (source of truth — draft only from this; do not invent facts):',
      `Procedural stage: ${brief.proceduralStage}`,
      `Parties: ${brief.parties.map((p) => `${p.role}=${p.name}`).join('; ') || '[BLANK: parties]'}`,
      `FIR date: ${brief.proceduralHistory.firDate ?? '[BLANK: FIR date]'}`,
      `FIR No: ${brief.proceduralHistory.firNo ?? '[BLANK: FIR No]'}`,
      `Police Station: ${brief.proceduralHistory.policeStation ?? '[BLANK: police station]'}`,
      `Arrest date: ${brief.proceduralHistory.arrestDate ?? '[BLANK: arrest date]'}`,
      `Chargesheet date: ${brief.proceduralHistory.chargesheetDate ?? 'not stated'}`,
      `Co-accused bail granted: ${brief.proceduralHistory.coAccusedBailGranted ? 'yes' : 'not stated'}`,
    ];

    if (brief.prosecutionFacts.length) {
      lines.push('Prosecution / allegation facts:');
      brief.prosecutionFacts.forEach((f, i) => lines.push(`  P${i + 1}. ${f}`));
    }
    if (brief.defenceFacts.length) {
      lines.push('Defence facts (EACH must appear as a numbered ground):');
      brief.defenceFacts.forEach((f, i) => lines.push(`  D${i + 1}. ${f}`));
    }
    if (brief.contradictions.length) {
      lines.push('Contradictions / weaknesses:');
      brief.contradictions.forEach((c, i) => lines.push(`  C${i + 1}. ${c}`));
    }
    if (brief.evidenceItems.length) {
      lines.push('Evidence items:');
      brief.evidenceItems.forEach((e) => lines.push(`  ${e.id}: ${e.type} — ${e.description}`));
    }
    if (brief.citedOffences.length) {
      lines.push(
        `Cited offences: ${brief.citedOffences.map((o) => o.raw || `${o.actId} §${o.section}`).join(', ')}`,
      );
    }
    lines.push('Drafting constraints:');
    brief.draftingConstraints.forEach((c) => lines.push(`  - ${c}`));
    return lines.join('\n');
  }

  /** Fact-pattern search queries for India Kanoon / corpus retrieval. */
  buildRetrievalQueries(brief: DraftCaseBrief, documentKind: string): string[] {
    const queries = new Set<string>();
    const kind = documentKind || 'court draft';
    queries.add(`${kind} India Supreme Court High Court`);

    if (/bail/i.test(kind) || brief.proceduralStage !== 'pre_fir') {
      queries.add('bail is the rule jail exception Satender Kumar Antil');
      queries.add('bail factors Prasanta Kumar Sarkar nature gravity flight risk');
    }
    if (brief.proceduralHistory.coAccusedBailGranted) {
      queries.add('bail parity co-accused granted bail Supreme Court');
    }
    const hay = [
      ...brief.defenceFacts,
      ...brief.contradictions,
      ...brief.evidenceItems.map((e) => e.description),
    ].join(' ');
    if (/CCTV|camera|forensic|electronic|Wi-?Fi|IP\s+address|CDR/i.test(hay)) {
      queries.add('bail electronic evidence forensic imaging insufficient India');
      queries.add('bail Wi-Fi IP address CDR insufficient evidence India');
    }
    if (/parity|co-accused/i.test(hay)) {
      queries.add('bail parity principle co-accused India Supreme Court');
    }
    // Medical / consumer negligence retrieval
    if (
      /medical|negligence|hospital|consent|surgery|gallbladder|bile|consumer/i.test(kind) ||
      /medical|negligence|hospital|consent|surgery|gallbladder|bile/i.test(hay)
    ) {
      queries.add('Spring Meadows Hospital medical negligence deficiency service Supreme Court');
      queries.add('medical negligence informed consent bile duct injury consumer forum India');
      queries.add('consumer protection medical negligence hospital vicarious liability Supreme Court');
      queries.add('recognised complication medical negligence standard of care India');
    }
    for (const fact of brief.defenceFacts.slice(0, 3)) {
      queries.add(`${kind} ${fact.slice(0, 80)}`);
    }
    return [...queries].slice(0, 6);
  }

  private extractParties(text: string, accused?: string): BriefParty[] {
    const parties: BriefParty[] = [];
    if (accused) {
      parties.push({ role: 'applicant', name: accused });
      parties.push({ role: 'accused', name: accused });
    }
    const vs =
      text.match(
        /\b([A-Z][A-Za-z.']+(?:\s+[A-Z][A-Za-z.']+){0,4})\s+(?:vs\.?|v\.?|versus)\s+([A-Z][A-Za-z.']+(?:\s+[A-Z][A-Za-z.']+){0,4})\b/,
      ) ?? null;
    if (vs) {
      const left = vs[1].trim();
      const right = vs[2].trim();
      if (/state|union of india|govt/i.test(left)) {
        parties.push({ role: 'state', name: left });
        if (!accused) parties.push({ role: 'applicant', name: right });
      } else if (/state|union of india|govt/i.test(right)) {
        parties.push({ role: 'state', name: right });
        if (!accused) parties.push({ role: 'applicant', name: left });
      } else {
        parties.push({ role: 'complainant', name: left });
        if (!accused) parties.push({ role: 'accused', name: right });
      }
    }
    const coAccused = [
      ...text.matchAll(
        /\bco[- ]?accused\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\b/g,
      ),
    ];
    for (const m of coAccused) {
      parties.push({ role: 'co_accused', name: m[1] });
    }

    // Labeled civil/consumer parties: Complainant / Opposite Party No. N:
    const labeledNameStop =
      '(?=\\s*[,.]|\\s+aged|\\s+residing|\\s+r/o|\\s+son\\s+of|\\s+daughter\\s+of|\\s+s/o|\\s+d/o|\\s+w/o|\\s+consultant|\\s+of\\s+|\\s*$|\\n)';
    const labeledName =
      String.raw`(?:Dr\.?\s+)?[A-Z][A-Za-z.']*(?:\s+[A-Z][A-Za-z.']*){0,7}`;
    const complainantRe = new RegExp(
      String.raw`\bComplainant(?:\s+No\.?\s*\d+)?\s*:\s*(${labeledName})${labeledNameStop}`,
      'gm',
    );
    const oppositeRe = new RegExp(
      String.raw`\bOpposite\s+Part(?:y|ies)(?:\s+No\.?\s*\d+)?\s*:\s*(${labeledName})${labeledNameStop}`,
      'gm',
    );
    for (const m of text.matchAll(complainantRe)) {
      const name = m[1].trim().replace(/[.,;:]+$/g, '');
      if (name) parties.push({ role: 'complainant', name });
    }
    for (const m of text.matchAll(oppositeRe)) {
      const name = m[1].trim().replace(/[.,;:]+$/g, '');
      if (name) parties.push({ role: 'respondent', name });
    }

    // Dedupe by role+name
    const seen = new Set<string>();
    return parties.filter((p) => {
      const k = `${p.role}:${p.name.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private resolveStage(
    text: string,
    hasChargesheet: boolean,
    hasArrest: boolean,
  ): ProceduralStage {
    if (hasChargesheet || /\bchargesheet\s+(?:filed|submitted)\b/i.test(text)) {
      return 'post_chargesheet';
    }
    if (/\btrial\s+(?:commenced|begun|pending)\b|\bcharges?\s+framed\b/i.test(text)) {
      return 'trial';
    }
    if (hasArrest || /\barrest(?:ed)?\b/i.test(text)) return 'investigation';
    if (/\bFIR\b/i.test(text)) return 'investigation';
    if (/\banticipatory\b|\barrest\s+feared\b/i.test(text)) return 'pre_fir';
    return 'unknown';
  }

  private splitFacts(text: string): {
    defenceFacts: string[];
    prosecutionFacts: string[];
  } {
    const bullets = text
      .split(/\n+/)
      .map((l) => l.replace(/^[\s*\-•\d.)]+/, '').trim())
      .filter((l) => l.length > 25 && l.length < 400);

    const defenceFacts: string[] = [];
    const prosecutionFacts: string[] = [];

    for (const line of bullets) {
      if (DEFENCE_MARKERS.test(line) || /no\s+(?:CCTV|evidence|recovery)|falsely|parity|forensic|Wi-?Fi/i.test(line)) {
        defenceFacts.push(line);
      } else if (PROSECUTION_MARKERS.test(line)) {
        prosecutionFacts.push(line);
      }
    }

    // Keyword-driven defence facts when narrative is prose (not bullets)
    const keywordFacts: Array<{ re: RegExp; label: string }> = [
      { re: /\bCCTV\b/i, label: 'CCTV / video evidence issues as stated in intake' },
      { re: /\bforensic\b/i, label: 'Forensic / imaging timeline issues as stated in intake' },
      { re: /\bparity\b|\bco[- ]?accused.{0,40}bail\b/i, label: 'Parity with co-accused granted bail' },
      { re: /\bWi-?Fi\b|\bIP\s+address\b/i, label: 'Wi-Fi / IP address evidence insufficiency' },
      { re: /\bCDR\b|\bcall\s+detail/i, label: 'CDR / call detail record issues' },
      { re: /\bshopkeeper\b/i, label: 'Shopkeeper / independent witness issues' },
      { re: /\bintimidation\b/i, label: 'Intimidation / pressure related facts' },
      { re: /\bcash\b|\brecovery\b/i, label: 'Cash / recovery related defence facts' },
    ];
    for (const kf of keywordFacts) {
      if (kf.re.test(text) && !defenceFacts.some((f) => kf.re.test(f))) {
        const sentence = text.split(/[.\n]/).find((s) => kf.re.test(s));
        defenceFacts.push((sentence ?? kf.label).trim().slice(0, 280));
      }
    }

    if (prosecutionFacts.length === 0) {
      const first = bullets.find((b) => /FIR|alleg|complain|offence|accused/i.test(b));
      if (first) prosecutionFacts.push(first);
    }

    return {
      defenceFacts: [...new Set(defenceFacts)].slice(0, 20),
      prosecutionFacts: [...new Set(prosecutionFacts)].slice(0, 12),
    };
  }

  private extractContradictions(text: string): string[] {
    const out: string[] = [];
    if (/CCTV/i.test(text) && /no\s+CCTV|CCTV\s+(?:not|never|absent)/i.test(text)) {
      out.push('CCTV claimed vs absence / non-production of CCTV');
    }
    if (/forensic/i.test(text) && /before\s+forensic|prior\s+to\s+forensic|imaging/i.test(text)) {
      out.push('Forensic imaging timeline inconsistency as stated in intake');
    }
    if (/Wi-?Fi|IP\s+address/i.test(text) && /insufficient|alone|only\s+evidence/i.test(text)) {
      out.push('Wi-Fi / IP-only evidence insufficient as per defence narrative');
    }
    // Medical / consent contradictions
    if (
      /sedative/i.test(text) &&
      /signed\s+(?:after|before)\s+(?:receiving|medication|pre-?medication)/i.test(text)
    ) {
      out.push('Consent timing dispute: sedative given before vs after consent signature');
    }
    if (/high[- ]risk\s+consent/i.test(text) && /den(?:y|ies)\s+signing|did\s+not\s+sign/i.test(text)) {
      out.push('High-Risk Consent initials disputed — patient denies signing');
    }
    if (
      /(?:first\s+PDF|earlier\s+(?:copy|records?))/i.test(text) &&
      /(?:later\s+(?:hospital\s+)?records?|does\s+not\s+appear\s+in)/i.test(text)
    ) {
      out.push('Record version conflict: note appears in later records but not first PDF copy');
    }
    return out;
  }

  private extractEvidence(text: string): BriefEvidenceItem[] {
    const items: BriefEvidenceItem[] = [];
    const add = (type: string, re: RegExp) => {
      if (!re.test(text)) return;
      const sentence = text.split(/[.\n]/).find((s) => re.test(s));
      items.push({
        id: `ev_${type}`,
        type,
        description: (sentence ?? type).trim().slice(0, 200),
      });
    };
    add('cctv', /\bCCTV\b/i);
    add('forensic', /\bforensic\b/i);
    add('wifi_ip', /\bWi-?Fi\b|\bIP\s+address\b/i);
    add('cdr', /\bCDR\b|\bcall\s+detail/i);
    add('cash', /\bcash\b|\brecovery\b/i);
    add('consent_form', /\bconsent\s+form\b/i);
    add('anaesthesia_chart', /\banaesthesia\s+chart\b/i);
    add('ct_scan', /\bCT\s+scan\b/i);
    add('expert_report', /\b(?:private\s+expert|expert\s+(?:report|opinion))\b/i);
    add('medical_board', /\bmedical\s+board\b/i);
    return items;
  }

  private pickDate(text: string, contextRe: RegExp): string | null {
    const m = text.match(contextRe);
    if (m?.[1]) {
      const raw = m[1].trim();
      const embedded = raw.match(DATE_RE);
      if (embedded) return embedded[0];
      if (raw.length <= 40) return raw;
    }
    return null;
  }
}
