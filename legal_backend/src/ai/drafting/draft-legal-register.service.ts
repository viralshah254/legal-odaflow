import { Injectable } from '@nestjs/common';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';
import { DraftArchetypeRouterService } from './archetypes/draft-archetype-router.service';
import {
  archetypeToRegister,
  kindToArchetype,
  type DraftRegister,
} from './archetypes/draft-archetype.types';

export interface LegalRegisterGateInput {
  draft: string;
  kind: string;
  caseDetails: string;
  countryCode: string;
  offenceDate?: string;
  recommendedKind?: string;
  register?: DraftRegister;
}

const VERIFIER = 'draft-legal-register-v1';
const CURRENT_CODE_START = Date.UTC(2024, 6, 1); // 1 July 2024

@Injectable()
export class DraftLegalRegisterService {
  constructor(private readonly archetypeRouter: DraftArchetypeRouterService) {}

  evaluate(input: LegalRegisterGateInput): VerificationFinding[] {
    const country = input.countryCode.toUpperCase();
    const register =
      input.register ??
      this.archetypeRouter.resolveRegisterForKind(input.recommendedKind ?? input.kind);
    const findings: VerificationFinding[] = [];

    if (country === 'IN') {
      findings.push(...this.indiaRegisterFindings(input, register));
      findings.push(...this.indiaCodeFamilyFindings(input));
      findings.push(...this.indiaBailabilityFindings(input, register));
      findings.push(...this.indiaWrongVehicleFindings(input));
    } else if (country === 'US') {
      findings.push(...this.usRegisterFindings(input, register));
      findings.push(...this.usWrongVehicleFindings(input));
    }

    return findings;
  }

  private indiaRegisterFindings(
    input: LegalRegisterGateInput,
    register: DraftRegister,
  ): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const draft = input.draft;

    if (register === 'police_complaint') {
      if (/\bHon'?ble\s+Police\s+Station\b/i.test(draft)) {
        findings.push(
          this.blocker(
            'register:honble_police',
            'Police complaints must address the Station House Officer — do not use "Hon\'ble Police Station".',
            'QUALIFY',
          ),
        );
      }
      if (/\bMOST\s+RESPECTFULLY\s+SHOWETH\b/i.test(draft)) {
        findings.push(
          this.blocker(
            'register:court_showeth_on_fir',
            'Court-style "MOST RESPECTFULLY SHOWETH" is incorrect for a police-station FIR complaint.',
            'REMOVE',
          ),
        );
      }
      if (/\bRespondent\b/i.test(draft) && !/\bState\b/i.test(draft)) {
        findings.push(
          this.blocker(
            'register:respondent_on_fir',
            'Police FIR complaints should not use court "Respondent" party designators.',
            'QUALIFY',
          ),
        );
      }
      if (/\bgrant\s+reliefs?\b/i.test(draft)) {
        findings.push(
          this.blocker(
            'register:grant_reliefs_fir',
            'Police complaints pray for registration/investigation — not court-style "grant reliefs".',
            'QUALIFY',
          ),
        );
      }
    }

    if (register !== 'bail_application') {
      if (/\bBNSS\s*§?\s*(?:480|482|483)\b/i.test(draft) && /fir_complaint|police/i.test(input.kind)) {
        findings.push(
          this.blocker(
            'register:bail_sections_in_fir',
            'Bail sections (BNSS §480/482/483) do not belong in an FIR/police complaint.',
            'REMOVE',
          ),
        );
      }
    }

    return findings;
  }

  private indiaCodeFamilyFindings(input: LegalRegisterGateInput): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const draft = input.draft;
    const offenceDate = this.parseDate(input.offenceDate) ?? this.inferDateFromText(input.caseDetails);
    const usesIpcGoverning =
      /\bIPC\s*§?\s*(?:354D|302|376|392|420|498A)\b/i.test(draft) &&
      !/\b(?:predecessor|erstwhile|formerly|Schedule\s*I)\b/i.test(draft);
    const usesBns = /\bBNS\s*§?\s*\d+/i.test(draft);

    if (offenceDate && offenceDate >= CURRENT_CODE_START && usesIpcGoverning) {
      findings.push(
        this.blocker(
          'code_family:ipc_post_cutoff',
          'Offence date is on/after 1 July 2024 — use BNS/BNSS as governing law; IPC/CrPC may appear only as Schedule I predecessors.',
          'RECITE',
        ),
      );
    }

    if (!offenceDate && usesIpcGoverning && usesBns) {
      findings.push({
        checkId: 'code_family:unknown_date_mixed',
        state: 'INDETERMINATE',
        severity: 'HIGH',
        dimension: 'currentLaw',
        evidenceIds: [],
        explanation:
          'Offence/FIR date missing while both IPC and BNS appear — insert [BLANK: offence date] and confirm code family before filing.',
        repairAction: 'QUALIFY',
        verifierVersion: VERIFIER,
      });
    }

    if (!offenceDate && usesIpcGoverning && !usesBns) {
      findings.push({
        checkId: 'code_family:unknown_date_ipc_only',
        state: 'INDETERMINATE',
        severity: 'HIGH',
        dimension: 'currentLaw',
        evidenceIds: [],
        explanation:
          'IPC cited as governing without offence date — require [BLANK: offence/FIR date]; do not auto-pick IPC or BNS.',
        repairAction: 'QUALIFY',
        verifierVersion: VERIFIER,
      });
    }

    return findings;
  }

  private indiaBailabilityFindings(
    input: LegalRegisterGateInput,
    register: DraftRegister,
  ): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    if (register !== 'police_complaint' && register !== 'magistrate_complaint') {
      return findings;
    }

    const draft = input.draft;
    const stalkingContext =
      /\bstalk/i.test(input.caseDetails) || /\bBNS\s*§?\s*78\b/i.test(draft);
    const assertsNonBailable = /\bnon[-\s]?bailable\b/i.test(draft);
    const secondConviction = /\bsecond\b|\bsubsequent\b|\bprevious\s+conviction\b/i.test(
      `${input.caseDetails}\n${draft}`,
    );

    if (stalkingContext && assertsNonBailable && !secondConviction) {
      findings.push(
        this.blocker(
          'bailability:stalking_non_bailable',
          'BNS §78 first offence is generally bailable — do not assert "non-bailable" without second/subsequent conviction facts.',
          'REMOVE',
        ),
      );
    }

    if (
      register === 'police_complaint' &&
      /\b(?:must|shall|direct(?:ed)?)\s+arrest\b|\bmandatory\s+arrest\b|\bproduce\s+(?:the\s+)?accused\s+before\s+(?:the\s+)?Magistrate\b/i.test(
        draft,
      )
    ) {
      findings.push(
        this.blocker(
          'arrest:mandatory_in_fir',
          'FIR complaints should not demand mandatory arrest; pray for lawful investigation under BNSS §173.',
          'QUALIFY',
        ),
      );
    }

    return findings;
  }

  private indiaWrongVehicleFindings(input: LegalRegisterGateInput): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const kind = input.recommendedKind ?? input.kind;
    const facts = input.caseDetails;
    const draft = input.draft;

    if (
      /ni\s*act|cheque\s+bounce|section\s+138/i.test(facts) &&
      /fir_complaint|police/i.test(kind)
    ) {
      findings.push(
        this.blocker(
          'vehicle:ni138_as_fir',
          'NI Act §138 belongs in a Magistrate complaint (india_cheque_bounce_complaint_ni138 / BNSS §223), not an FIR under BNSS §173.',
          'RECITE',
        ),
      );
    }

    if (
      /fir_complaint/i.test(kind) &&
      /\bBNSS\s*§?\s*223\b/i.test(draft) &&
      !/\bBNSS\s*§?\s*173\b/i.test(draft)
    ) {
      findings.push(
        this.blocker(
          'vehicle:223_on_fir_kind',
          'Document kind is FIR complaint but draft cites BNSS §223 without §173 — wrong procedural vehicle.',
          'RECITE',
        ),
      );
    }

    if (
      /cheque_bounce|ni138/i.test(kind) &&
      /\bBNS\s*§?\s*138\b/i.test(draft)
    ) {
      findings.push(
        this.blocker(
          'vehicle:bns138_for_cheque',
          'Cheque dishonour is NI Act §138 — never BNS §138.',
          'RECITE',
        ),
      );
    }

    return findings;
  }

  private usRegisterFindings(
    input: LegalRegisterGateInput,
    register: DraftRegister,
  ): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const draft = input.draft;

    if (register === 'police_complaint' || register === 'protective_order') {
      if (/\bMOST\s+RESPECTFULLY\s+SHOWETH\b/i.test(draft)) {
        findings.push(
          this.blocker(
            'us_register:india_showeth',
            'India court register language is incorrect for US criminal/protective filings.',
            'REMOVE',
          ),
        );
      }
    }

    if (
      /us_form_catalog/i.test(input.kind) &&
      /\b(?:stalk|assault|battery|domestic\s+violence|criminal)\b/i.test(input.caseDetails)
    ) {
      findings.push(
        this.blocker(
          'us_vehicle:form_catalog_criminal',
          'Criminal/protective facts routed to us_form_catalog — use us_state_criminal_complaint or us_state_restraining_order.',
          'RECITE',
        ),
      );
    }

    return findings;
  }

  private usWrongVehicleFindings(input: LegalRegisterGateInput): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const kind = input.recommendedKind ?? input.kind;
    const facts = input.caseDetails;

    if (
      /us_federal_criminal/i.test(kind) &&
      !/\b(?:18\s*u\.?\s*s\.?\s*c|federal|wire\s+fraud|mail\s+fraud)\b/i.test(facts)
    ) {
      findings.push({
        checkId: 'us_vehicle:federal_without_nexus',
        state: 'FAIL',
        severity: 'HIGH',
        dimension: 'jurisdiction',
        evidenceIds: [],
        explanation:
          'Federal criminal kind without clear federal nexus in facts — prefer state criminal complaint unless nexus is established.',
        repairAction: 'RECITE',
        verifierVersion: VERIFIER,
      });
    }

    if (
      /civil|contract|breach/i.test(kind) &&
      /\b(?:arrest|bail|indictment|felony)\b/i.test(input.draft)
    ) {
      findings.push(
        this.blocker(
          'us_vehicle:criminal_in_civil',
          'Criminal custody/arrest language appears in a civil document register.',
          'REMOVE',
        ),
      );
    }

    return findings;
  }

  private blocker(
    checkId: string,
    explanation: string,
    repairAction: VerificationFinding['repairAction'],
  ): VerificationFinding {
    return {
      checkId,
      state: 'FAIL',
      severity: 'BLOCKER',
      dimension: 'application',
      evidenceIds: [],
      explanation,
      repairAction,
      verifierVersion: VERIFIER,
    };
  }

  private parseDate(value?: string): number | undefined {
    if (!value?.trim()) return undefined;
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : undefined;
  }

  private inferDateFromText(text: string): number | undefined {
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
      return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    const dmy = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
    if (dmy) {
      return Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    }
    return undefined;
  }
}

/** Exported for citation policy / prompt helpers. */
export function isPoliceComplaintRegister(kind: string): boolean {
  return archetypeToRegister(kindToArchetype(kind)) === 'police_complaint';
}
