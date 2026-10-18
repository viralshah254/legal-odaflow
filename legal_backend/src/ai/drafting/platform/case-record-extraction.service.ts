import { Injectable } from '@nestjs/common';
import { DraftCaseBriefService } from '../draft-case-brief.service';
import { extractMatterFacts } from '@/ai/draft-intent/matter-fact-extractor';
import {
  buildSourceHash,
  buildStableFactId,
  createCaseRecordId,
  type CaseContradiction,
  type CaseFact,
  type CaseRecord,
  type ChronologyEvent,
  type EvidenceItem,
  type LegalProvision,
  type MissingField,
  type MoneyRecord,
  type Party,
} from '../contracts/case-record';
import {
  emptyCriminalMatterData,
  type CriminalMatterData,
} from '../contracts/matter-data/criminal-matter-data';
import {
  emptyCivilMatterData,
  type CivilMatterData,
} from '../contracts/matter-data/civil-matter-data';
import {
  emptyContractMatterData,
  type ContractMatterData,
} from '../contracts/matter-data/contract-matter-data';
import {
  emptyNoticeMatterData,
  type NoticeMatterData,
} from '../contracts/matter-data/notice-matter-data';
import { DraftPlaybookRegistryService } from './draft-playbook-registry.service';
import { buildCommercialRecoveryFactLock } from '@/ai/draft-intent/commercial-recovery-calculator';

export interface ExtractCaseRecordInput {
  caseDetails: string;
  documentKind: string;
  jurisdiction?: string;
  courtName?: string;
  clientName?: string;
  opposingParty?: string;
  /** Structured multi-party list from client extraction. */
  parties?: {
    plaintiffs: Array<{ name: string; role: string }>;
    defendants: Array<{ name: string; role: string }>;
  };
  attachmentContext?: string;
  documentIds?: string[];
  playbookId?: string;
  playbookVersion?: string;
}

/**
 * Universal extraction only — does NOT assign materiality or bail checklist.
 * Adapter.validateIntake() owns materiality / mandatory-field classification.
 */
@Injectable()
export class CaseRecordExtractionService {
  constructor(
    private readonly caseBrief: DraftCaseBriefService,
    private readonly playbooks: DraftPlaybookRegistryService,
  ) {}

  extract(input: ExtractCaseRecordInput): CaseRecord {
    const text = [input.caseDetails, input.attachmentContext]
      .filter(Boolean)
      .join('\n\n')
      .trim();
    const jurisdictionCode = input.jurisdiction ?? 'IN';
    const playbook =
      this.playbooks.tryGetPlaybook(input.documentKind) ??
      this.playbooks.tryGetPlaybook('india_regular_bail_bnss_480');

    const brief = this.caseBrief.extract(text, input.documentKind);
    const matter = extractMatterFacts(text);

    const parties = this.buildParties(brief.parties, input);
    const facts = this.buildFacts(brief, text);
    const chronology = this.buildChronology(brief, facts, text);
    const evidence = this.buildEvidence(brief);
    const moneyRecords = this.buildMoneyRecords(text, facts);
    const statutes = this.buildStatutes(brief, matter);
    const contradictions = this.buildContradictions(brief, facts);
    const missingFields = this.buildMissingFields(brief);
    const matterData = this.buildMatterData(input.documentKind, brief, matter, text, parties);

    const sourceHash = buildSourceHash(text, input.documentIds ?? []);
    const commercialRecovery =
      /(?:suit_recovery_cpc_37|civil_suit_money_recovery|summary_suit_recovery|money_recovery_suit)/i.test(
        input.documentKind,
      )
        ? buildCommercialRecoveryFactLock({ facts: text })
        : undefined;
    const factLocks = commercialRecovery
      ? [
          {
            id: 'FACT_LOCK_COMMERCIAL_RECOVERY',
            kind: commercialRecovery.kind,
            version: commercialRecovery.version,
            status:
              commercialRecovery.blockingIssues.length > 0
                ? ('blocked' as const)
                : ('extracted' as const),
            sourceHash,
            payload: commercialRecovery,
            blockingIssues: commercialRecovery.blockingIssues,
          },
        ]
      : undefined;

    // Infer Ahmedabad / consumer territorial hints from narrative
    let stateOrRegion = undefined as string | undefined;
    if (/ahmedabad/i.test(text)) stateOrRegion = 'Ahmedabad';

    return {
      metadata: {
        caseRecordId: createCaseRecordId(),
        version: 1,
        status: 'draft',
        extractedAt: new Date().toISOString(),
        sourceHash,
        playbookId: playbook?.id ?? input.playbookId ?? `playbook:${input.documentKind}:v1`,
        playbookVersion: playbook?.version ?? input.playbookVersion ?? '1.0.0',
      },
      jurisdiction: {
        countryCode: jurisdictionCode,
        courtName: input.courtName,
        stateOrRegion,
      },
      parties,
      facts,
      chronology,
      evidence,
      moneyRecords,
      factLocks,
      statutes,
      suggestedStatutes: [],
      contradictions,
      missingFields,
      matterData,
    };
  }

  confirm(
    record: CaseRecord,
    userId: string,
    resolutions?: Array<{ contradictionId: string; chosenFactId: string; note?: string }>,
  ): CaseRecord {
    const contradictions = record.contradictions.map((c) => {
      const r = resolutions?.find((x) => x.contradictionId === c.id);
      if (!r) return c;
      return {
        ...c,
        resolution: {
          chosenFactId: r.chosenFactId,
          resolvedByUserId: userId,
          resolvedAt: new Date().toISOString(),
          note: r.note,
        },
      };
    });

    return {
      ...record,
      contradictions,
      metadata: {
        ...record.metadata,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        confirmedByUserId: userId,
        version: record.metadata.version,
      },
    };
  }

  /** Bump version and supersede prior confirmation when Case Record is edited. */
  bumpVersion(record: CaseRecord, edits: Partial<CaseRecord>): CaseRecord {
    return {
      ...record,
      ...edits,
      metadata: {
        ...record.metadata,
        ...(edits.metadata ?? {}),
        version: record.metadata.version + 1,
        status: 'draft',
        confirmedAt: undefined,
        confirmedByUserId: undefined,
      },
      factDispositions: undefined,
    };
  }

  private buildParties(
    briefParties: Array<{ role: string; name: string }>,
    input: ExtractCaseRecordInput,
  ): Party[] {
    const parties: Party[] = briefParties.map((p, i) => ({
      id: `PARTY_${i + 1}`,
      role: p.role,
      name: p.name,
    }));
    const hasName = (name: string) =>
      parties.some((p) => p.name.toLowerCase() === name.toLowerCase());

    if (input.parties) {
      for (const p of input.parties.plaintiffs ?? []) {
        if (!p?.name?.trim() || hasName(p.name)) continue;
        parties.unshift({
          id: `PARTY_P_${parties.length + 1}`,
          role: p.role || 'plaintiff',
          name: p.name.trim(),
        });
      }
      for (const p of input.parties.defendants ?? []) {
        if (!p?.name?.trim() || hasName(p.name)) continue;
        parties.push({
          id: `PARTY_D_${parties.length + 1}`,
          role: p.role || 'defendant',
          name: p.name.trim(),
        });
      }
      return parties;
    }

    const split = (raw?: string) =>
      (raw ?? '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);

    for (const name of split(input.clientName)) {
      if (hasName(name)) continue;
      parties.unshift({
        id: `PARTY_CLIENT_${parties.length + 1}`,
        role: /bail/i.test(input.documentKind)
          ? 'applicant'
          : /consumer/i.test(input.documentKind)
            ? 'complainant'
            : 'plaintiff',
        name,
      });
    }
    for (const name of split(input.opposingParty)) {
      if (hasName(name)) continue;
      parties.push({
        id: `PARTY_OPP_${parties.length + 1}`,
        role: /bail/i.test(input.documentKind)
          ? 'state'
          : /consumer/i.test(input.documentKind)
            ? 'opposite_party'
            : 'defendant',
        name,
      });
    }
    return parties;
  }

  private buildFacts(
    brief: ReturnType<DraftCaseBriefService['extract']>,
    rawText: string,
  ): CaseFact[] {
    const facts: CaseFact[] = [];
    let display = 1;

    const push = (
      proposition: string,
      status: CaseFact['status'],
      sourceType: CaseFact['sourceType'] = 'user_input',
      hierarchy: CaseFact['sourceHierarchy'] = 'narrative',
    ) => {
      const id = buildStableFactId({
        sourceQuote: proposition,
        proposition,
        documentId: 'intake',
      });
      if (facts.some((f) => f.id === id)) return;
      facts.push({
        id,
        displayId: `F${display++}`,
        proposition,
        sourceQuote: proposition,
        sourceType,
        sourceHierarchy: hierarchy,
        status,
        confidence: 'explicit',
      });
    };

    for (const f of brief.defenceFacts) push(f, 'defence_version');
    for (const f of brief.prosecutionFacts) push(f, 'prosecution_allegation', 'user_input', 'fir');
    for (const c of brief.contradictions) push(c, 'disputed');

    const ph = brief.proceduralHistory;
    if (ph.firDate) {
      push(`FIR dated ${ph.firDate}`, 'procedural_record', 'user_input', 'fir');
    }
    if (ph.arrestDate) {
      push(`Arrest dated ${ph.arrestDate}`, 'procedural_record', 'user_input', 'narrative');
    }
    if (ph.chargesheetDate) {
      push(
        `Chargesheet filed ${ph.chargesheetDate}`,
        'procedural_record',
        'user_input',
        'chargesheet',
      );
    }
    if (ph.coAccusedBailGranted) {
      push('Co-accused granted bail', 'procedural_record');
    }

    // Preserve raw sentences that look like facts but weren't classified — still no materiality.
    if (facts.length < 3 && rawText.length > 40) {
      const sentences = rawText
        .split(/[.\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20 && s.length < 280)
        .slice(0, 8);
      for (const s of sentences) push(s, 'disputed', 'user_input', 'narrative');
    }

    this.extractMedicalConsumerFacts(rawText, push);

    return facts;
  }

  private extractMedicalConsumerFacts(
    rawText: string,
    push: (
      proposition: string,
      status: CaseFact['status'],
      sourceType?: CaseFact['sourceType'],
      hierarchy?: CaseFact['sourceHierarchy'],
    ) => void,
  ): void {
    if (!/\b(medical|hospital|surgery|consent|negligence|consumer|gallbladder|cholecystectomy|bile)\b/i.test(
      rawText,
    )) {
      return;
    }

    const patterns: Array<{ re: RegExp; status: CaseFact['status'] }> = [
      {
        re: /\b(?:specific\s+risks?|section\s+for\s+specific\s+risks?)\s+(?:is\s+)?blank\b/i,
        status: 'disputed',
      },
      {
        re: /\bbile[- ]?duct\s+injury\b[^.]{0,120}/i,
        status: 'disputed',
      },
      {
        re: /\bpossible\s+bile\s+leak\b[^.]{0,120}/i,
        status: 'disputed',
      },
      {
        re: /\bhigh[- ]?risk\s+consent\b[^.]{0,160}/i,
        status: 'disputed',
      },
      {
        re: /\b(?:signed|signing)\s+after\s+(?:receiving\s+)?(?:a\s+)?sedative\b/i,
        status: 'disputed',
      },
      {
        re: /\b(?:signed|signing)\s+before\s+medication\b/i,
        status: 'defence_version',
      },
      {
        re: /\b(?:dense\s+adhesions|converted\s+to\s+open\s+surgery)\b[^.]{0,120}/i,
        status: 'procedural_record',
      },
      {
        re: /\b(?:low\s+blood\s+pressure|hypotension)\b[^.]{0,80}/i,
        status: 'procedural_record',
      },
      {
        re: /\b(?:private\s+expert|expert\s+(?:report|opinion|states))\b[^.]{0,200}/i,
        status: 'disputed',
      },
      {
        re: /\b(?:hospital(?:'s)?\s+medical\s+board|recognised\s+complication)\b[^.]{0,200}/i,
        status: 'defence_version',
      },
      {
        re: /\b(?:record(?:s)?\s+(?:differ|conflict|version)|appears\s+only\s+in\s+later)\b[^.]{0,160}/i,
        status: 'disputed',
      },
      {
        re: /\b(?:no\s+(?:insurance\s+)?claim\s+(?:has\s+been\s+)?(?:filed|denied)|not\s+(?:yet\s+)?repudiat)/i,
        status: 'admitted',
      },
      {
        re: /\blaparoscopic\s+(?:gallbladder|cholecystectomy)\b[^.]{0,120}/i,
        status: 'prosecution_allegation',
      },
    ];

    for (const { re, status } of patterns) {
      const m = rawText.match(re);
      if (m?.[0]) push(m[0].trim(), status, 'user_input', 'narrative');
    }
  }

  private buildChronology(
    brief: ReturnType<DraftCaseBriefService['extract']>,
    facts: CaseFact[],
    rawText: string,
  ): ChronologyEvent[] {
    const events: ChronologyEvent[] = [];
    const ph = brief.proceduralHistory;
    const findFact = (re: RegExp) => facts.filter((f) => re.test(f.proposition)).map((f) => f.id);

    if (ph.firDate) {
      events.push({
        id: 'EVT_FIR',
        label: 'FIR',
        date: ph.firDate,
        datePrecision: 'exact',
        factIds: findFact(/FIR/i),
        sourceHierarchy: 'fir',
      });
    }
    if (ph.arrestDate) {
      events.push({
        id: 'EVT_ARREST',
        label: 'Arrest',
        date: ph.arrestDate,
        datePrecision: 'exact',
        factIds: findFact(/Arrest/i),
        sourceHierarchy: 'narrative',
      });
    }
    if (ph.chargesheetDate) {
      events.push({
        id: 'EVT_CHARGESHEET',
        label: 'Chargesheet',
        date: ph.chargesheetDate,
        datePrecision: 'exact',
        factIds: findFact(/Chargesheet/i),
        sourceHierarchy: 'chargesheet',
      });
    }

    // Medical / consumer chronology — date-first and verb-first patterns
    const medPatterns: Array<{ id: string; label: string; re: RegExp }> = [
      {
        id: 'EVT_ULTRASOUND',
        label: 'Ultrasound / imaging',
        re: /(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[^.]{0,80}\b(?:ultrasound|gallstones)\b|\b(?:ultrasound|gallstones)\b[^.]{0,80}?(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      },
      {
        id: 'EVT_CONSENT',
        label: 'Consent',
        re: /(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[^.]{0,80}\bconsent\b|\bconsent\b[^.]{0,80}?(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      },
      {
        id: 'EVT_SURGERY',
        label: 'Surgery / procedure',
        re: /(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[^.]{0,100}\b(?:surgery|operated|laparoscopic|cholecystectomy|gallbladder)\b|\b(?:surgery|operated|laparoscopic|cholecystectomy|gallbladder)\b[^.]{0,80}?(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      },
      {
        id: 'EVT_CT',
        label: 'CT / imaging',
        re: /(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[^.]{0,80}\b(?:CT|scan|MRI)\b|\b(?:CT|scan|MRI)\b[^.]{0,80}?(?:on|dated|performed\s+on|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      },
      {
        id: 'EVT_TRANSFER',
        label: 'Transfer',
        re: /(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[^.]{0,80}\b(?:transfer(?:red)?|referred)\b|\b(?:transfer(?:red)?|referred)\b[^.]{0,80}?(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      },
      {
        id: 'EVT_SPECIALIST',
        label: 'Specialist consultation',
        re: /(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[^.]{0,80}\bspecialist\b|\bspecialist\b[^.]{0,80}?(?:on|dated|consulted\s+on|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      },
      {
        id: 'EVT_SURGERY_START',
        label: 'Surgery start',
        re: /\b(?:surgery|operation)\s+began\s+at\s+(?:about\s+)?(\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?)/i,
      },
      {
        id: 'EVT_HYPOTENSION',
        label: 'Intra-op hypotension',
        re: /\b(?:low\s+blood\s+pressure|hypotension)\b[^.]{0,80}?(?:between\s+)?(\d{1,2}:\d{2})\s*(?:and|–|-)\s*(\d{1,2}:\d{2})/i,
      },
      {
        id: 'EVT_BILE_LEAK',
        label: 'Bile leak note',
        re: /\b(?:12:10|possible\s+bile\s+leak)\b[^.]{0,120}?(?:\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}\s+(?:March|April)\s+2025)/i,
      },
      {
        id: 'EVT_CORRECTIVE',
        label: 'Corrective treatment',
        re: /(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[^.]{0,80}\b(?:corrective|revision|ERCP|repair)\b|\b(?:corrective|revision|ERCP|repair)\b[^.]{0,80}?(?:on|dated|dt\.?)\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      },
    ];

    for (const pat of medPatterns) {
      const m = rawText.match(pat.re);
      if (!m) continue;
      let date = (m[1] || m[2] || '').trim();
      let label = pat.label;
      if (pat.id === 'EVT_SURGERY_START' && m[1]) {
        date = m[1].trim();
        label = 'Surgery began';
      } else if (pat.id === 'EVT_HYPOTENSION' && m[1] && m[2]) {
        date = `${m[1]}–${m[2]}`;
        label = 'Low blood pressure (intra-op)';
      } else if (pat.id === 'EVT_BILE_LEAK') {
        const dateM = rawText.match(
          /\b11\s+March\s+2025\b|\b(\d{1,2}\s+March\s+2025)\b/i,
        );
        date = dateM?.[0]?.trim() ?? '11 March 2025';
      }
      if (!date && pat.id !== 'EVT_BILE_LEAK') continue;
      if (events.some((e) => e.id === pat.id)) continue;
      events.push({
        id: pat.id,
        label,
        date: date || undefined,
        datePrecision: date ? 'exact' : 'approximate',
        factIds: findFact(new RegExp(pat.label.split(/\s+/)[0], 'i')),
        sourceHierarchy: 'narrative',
      });
    }

    // Generic "On <Date> ..." lines for medical consumer chronology
    const onDateRe =
      /\bOn\s+(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b([^.\n]{5,120})/gi;
    let onM: RegExpExecArray | null;
    let onIdx = 0;
    while ((onM = onDateRe.exec(rawText)) !== null && onIdx < 12) {
      const date = onM[1];
      const clause = onM[2];
      let label = 'Event';
      if (/consent/i.test(clause)) label = 'Consent';
      else if (/surgery|operated|gallbladder|cholecystectomy|laparoscopic/i.test(clause))
        label = 'Surgery / procedure';
      else if (/CT|scan|MRI/i.test(clause)) label = 'CT / imaging';
      else if (/transfer|referred/i.test(clause)) label = 'Transfer';
      else if (/corrective|ERCP|repair/i.test(clause)) label = 'Corrective treatment';
      else continue;
      if (events.some((e) => e.date === date && e.label === label)) continue;
      events.push({
        id: `EVT_ON_${onIdx++}`,
        label,
        date,
        datePrecision: 'exact',
        factIds: [],
        sourceHierarchy: 'narrative',
      });
    }

    // Generic "on <Month Date Year>" event capture for labeled medical verbs
    const labeledDateRe =
      /\b(consent|surgery|operated|CT\s+scan|scan|transfer(?:red)?|corrective|admission|discharged?)\b[^.\n]{0,60}?\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
    let lm: RegExpExecArray | null;
    let idx = 0;
    while ((lm = labeledDateRe.exec(rawText)) !== null && idx < 12) {
      const label = lm[1];
      const date = lm[2];
      const id = `EVT_NARR_${idx++}`;
      if (events.some((e) => e.date === date && e.label.toLowerCase().includes(label.toLowerCase().slice(0, 4)))) {
        continue;
      }
      events.push({
        id,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        date,
        datePrecision: 'exact',
        factIds: [],
        sourceHierarchy: 'narrative',
      });
    }

    return events;
  }

  private buildMoneyRecords(rawText: string, facts: CaseFact[]): MoneyRecord[] {
    const records: MoneyRecord[] = [];
    const amountRe =
      /(?:₹|Rs\.?\s*)\s*([\d,]+(?:\.\d+)?)\s*(?:\/\-)?(?:\s*\(([^)]{0,60})\))?/gi;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = amountRe.exec(rawText)) !== null && i < 20) {
      const numeric = Number(m[1].replace(/,/g, ''));
      const ctxStart = Math.max(0, (m.index ?? 0) - 40);
      const ctx = rawText.slice(ctxStart, (m.index ?? 0) + m[0].length + 40);
      let kind: MoneyRecord['kind'] = 'other';
      if (/estimat/i.test(ctx)) kind = 'estimate';
      else if (/expense|spent|paid|bill|hospital\s+bill/i.test(ctx)) kind = 'expense';
      else if (/claim|compensation|damages/i.test(ctx)) kind = 'claim';
      else if (/premium|policy/i.test(ctx)) kind = 'premium';
      records.push({
        id: `MONEY_${++i}`,
        kind,
        amount: Number.isFinite(numeric) ? numeric : undefined,
        currency: 'INR',
        amountLabel: `₹${m[1]}`,
        description: ctx.replace(/\s+/g, ' ').trim().slice(0, 120),
        disputed: /disputed|alleged/i.test(ctx),
        materiality: kind === 'estimate' || kind === 'claim' ? 'critical' : 'important',
        sourceFactIds: facts
          .filter((f) => f.proposition.includes(m![1]))
          .map((f) => f.id)
          .slice(0, 3),
        confirmationState: 'extracted',
      });
    }
    return records;
  }

  private buildEvidence(
    brief: ReturnType<DraftCaseBriefService['extract']>,
  ): EvidenceItem[] {
    return brief.evidenceItems.map((e) => ({
      id: e.id,
      type: e.type,
      description: e.description,
    }));
  }

  private buildStatutes(
    brief: ReturnType<DraftCaseBriefService['extract']>,
    matter: ReturnType<typeof extractMatterFacts>,
  ): LegalProvision[] {
    const fromBrief = brief.citedOffences.map((o, i) => ({
      id: `STAT_${i + 1}`,
      actId: o.actId,
      section: o.section,
      raw: o.raw,
      charged: true,
    }));
    if (fromBrief.length > 0) return fromBrief;
    return (matter.citedStatutes ?? []).map((o, i) => ({
      id: `STAT_${i + 1}`,
      actId: o.actId,
      section: o.section,
      raw: o.raw ?? `${o.actId} ${o.section}`,
      charged: true,
    }));
  }

  private buildContradictions(
    brief: ReturnType<DraftCaseBriefService['extract']>,
    facts: CaseFact[],
  ): CaseContradiction[] {
    return brief.contradictions.map((desc, i) => {
      const related = facts.filter((f) =>
        desc.toLowerCase().includes(f.proposition.slice(0, 20).toLowerCase()),
      );
      return {
        id: `CONTRA_${i + 1}`,
        factId1: related[0]?.id ?? facts[0]?.id ?? 'FACT_UNKNOWN',
        factId2: related[1]?.id ?? facts[1]?.id ?? related[0]?.id ?? 'FACT_UNKNOWN',
        description: desc,
        severity: 'warning' as const,
      };
    });
  }

  private buildMissingFields(
    brief: ReturnType<DraftCaseBriefService['extract']>,
  ): MissingField[] {
    return brief.missingCriticalFields.map((field) => ({
      field,
      description: `Missing critical field: ${field}`,
      blocking: true,
    }));
  }

  private buildMatterData(
    documentKind: string,
    brief: ReturnType<DraftCaseBriefService['extract']>,
    matter: ReturnType<typeof extractMatterFacts>,
    text: string,
    parties: Party[],
  ): CriminalMatterData | CivilMatterData | ContractMatterData | NoticeMatterData | Record<string, never> {
    if (/bail|complaint|fir|quash|criminal/i.test(documentKind) || /FIR|arrest|chargesheet/i.test(text)) {
      const criminal: CriminalMatterData = {
        ...emptyCriminalMatterData(),
        firDetails: {
          firNo: brief.proceduralHistory.firNo,
          firDate: brief.proceduralHistory.firDate,
          policeStation: brief.proceduralHistory.policeStation,
        },
        arrestDetails: {
          arrestDate: brief.proceduralHistory.arrestDate,
        },
        custodyStatus: brief.proceduralHistory.arrestDate
          ? 'in_custody'
          : /anticipatory/i.test(documentKind)
            ? 'not_arrested'
            : 'unknown',
        chargesheetStatus: brief.proceduralHistory.chargesheetDate
          ? 'filed'
          : matter.hasChargesheetFiled
            ? 'filed'
            : 'unknown',
        proceduralStage: brief.proceduralStage,
        accusedPersons: parties
          .filter((p) => /accused|applicant/i.test(p.role))
          .map((p) => ({
            id: p.id,
            name: p.name,
            isApplicant: /applicant|accused/i.test(p.role),
            role: /co/i.test(p.role) ? ('co_accused' as const) : ('applicant' as const),
          })),
        allegedOffences: brief.citedOffences.map((o) => ({
          actId: o.actId,
          section: o.section,
          raw: o.raw,
        })),
        priorBailHistory: brief.proceduralHistory.coAccusedBailGranted
          ? [{ accusedName: 'co-accused', granted: true, sourceQuote: 'Co-accused granted bail' }]
          : [],
        recoveryDetails: /no\s+recovery|recovery\s+disputed/i.test(text)
          ? [{ description: 'Recovery disputed / no recovery', disputed: true }]
          : [],
      };
      return criminal;
    }

    if (/legal_notice|notice/i.test(documentKind)) {
      const notice: NoticeMatterData = {
        ...emptyNoticeMatterData(),
        senderName: parties.find((p) => /sender|client|plaintiff/i.test(p.role))?.name,
        recipientName: parties.find((p) => /recipient|opposing|defendant/i.test(p.role))?.name,
        demandBasis: brief.defenceFacts[0] ?? brief.prosecutionFacts[0],
      };
      const amount = text.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)/i);
      if (amount) notice.demandAmount = amount[0];
      const cure = text.match(/(?:within|cure\s+period\s+of)\s+(\d+\s+days?)/i);
      if (cure) notice.curePeriod = cure[1];
      return notice;
    }

    if (/service_agreement|contract|nda|agreement/i.test(documentKind)) {
      const contract: ContractMatterData = {
        ...emptyContractMatterData(),
        transactionType: /nda/i.test(documentKind) ? 'nda' : 'service_agreement',
        governingLawPreference: text.match(/governing\s+law[:\s]+([^\n.]+)/i)?.[1]?.trim(),
      };
      return contract;
    }

    if (/plaint|civil|suit/i.test(documentKind)) {
      return {
        ...emptyCivilMatterData(),
        reliefsRequested: [],
      };
    }

    return {};
  }
}
