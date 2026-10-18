import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DraftWorkspaceV3, DraftSectionV3 } from '@prisma/client';
import type { DraftFact, DraftPlan, ProceduralCheckResult } from './drafting.types';

interface SectionTemplate {
  sectionType: string;
  title: string;
  orderIndex: number;
  required: boolean;
}

/** Maps a document type to a canonical list of section templates. */
const SECTION_TEMPLATES: Record<string, SectionTemplate[]> = {
  court_draft: [
    { sectionType: 'heading', title: 'Cause Title', orderIndex: 0, required: true },
    { sectionType: 'parties', title: 'Parties to the Proceedings', orderIndex: 1, required: true },
    { sectionType: 'facts', title: 'Statement of Facts', orderIndex: 2, required: true },
    { sectionType: 'legal_grounds', title: 'Grounds & Legal Arguments', orderIndex: 3, required: true },
    { sectionType: 'prayer', title: 'Prayer / Relief Sought', orderIndex: 4, required: true },
    { sectionType: 'verification', title: 'Verification', orderIndex: 5, required: true },
    { sectionType: 'schedule', title: 'List of Annexures', orderIndex: 6, required: false },
  ],
  pleading: [
    { sectionType: 'heading', title: 'Cause Title', orderIndex: 0, required: true },
    { sectionType: 'parties', title: 'Parties', orderIndex: 1, required: true },
    { sectionType: 'facts', title: 'Material Facts', orderIndex: 2, required: true },
    { sectionType: 'legal_grounds', title: 'Legal Grounds', orderIndex: 3, required: true },
    { sectionType: 'prayer', title: 'Prayer', orderIndex: 4, required: true },
    { sectionType: 'verification', title: 'Verification', orderIndex: 5, required: true },
  ],
  contract: [
    { sectionType: 'heading', title: 'Agreement Title & Parties', orderIndex: 0, required: true },
    { sectionType: 'definitions', title: 'Definitions & Interpretation', orderIndex: 1, required: true },
    { sectionType: 'facts', title: 'Recitals / Background', orderIndex: 2, required: false },
    { sectionType: 'legal_grounds', title: 'Scope of Services / Terms', orderIndex: 3, required: true },
    { sectionType: 'legal_grounds', title: 'Payment Terms', orderIndex: 4, required: true },
    { sectionType: 'legal_grounds', title: 'Intellectual Property', orderIndex: 5, required: false },
    { sectionType: 'legal_grounds', title: 'Confidentiality', orderIndex: 6, required: false },
    { sectionType: 'legal_grounds', title: 'Termination', orderIndex: 7, required: true },
    { sectionType: 'legal_grounds', title: 'Dispute Resolution & Governing Law', orderIndex: 8, required: true },
    { sectionType: 'signature', title: 'Execution & Signatures', orderIndex: 9, required: true },
    { sectionType: 'schedule', title: 'Schedules', orderIndex: 10, required: false },
  ],
  letter: [
    { sectionType: 'heading', title: 'Letterhead & Date', orderIndex: 0, required: true },
    { sectionType: 'parties', title: 'Addressee', orderIndex: 1, required: true },
    { sectionType: 'facts', title: 'Subject & Body', orderIndex: 2, required: true },
    { sectionType: 'legal_grounds', title: 'Legal Basis / Demand', orderIndex: 3, required: false },
    { sectionType: 'signature', title: 'Closing & Signature', orderIndex: 4, required: true },
  ],
  affidavit: [
    { sectionType: 'heading', title: 'Affidavit Title', orderIndex: 0, required: true },
    { sectionType: 'parties', title: 'Deponent Declaration', orderIndex: 1, required: true },
    { sectionType: 'facts', title: 'Statement of Facts', orderIndex: 2, required: true },
    { sectionType: 'verification', title: 'Verification & Oath', orderIndex: 3, required: true },
  ],
  notice: [
    { sectionType: 'heading', title: 'Legal Notice Header', orderIndex: 0, required: true },
    { sectionType: 'parties', title: 'Addressee', orderIndex: 1, required: true },
    { sectionType: 'facts', title: 'Background & Facts', orderIndex: 2, required: true },
    { sectionType: 'legal_grounds', title: 'Legal Basis & Demand', orderIndex: 3, required: true },
    { sectionType: 'prayer', title: 'Relief / Deadline', orderIndex: 4, required: true },
    { sectionType: 'signature', title: 'Signature', orderIndex: 5, required: true },
  ],
};

const DEFAULT_SECTIONS = SECTION_TEMPLATES['court_draft'];

// ─── Legal issue extraction helpers ──────────────────────────────────────────

const ISSUE_KEYWORDS: Array<{ pattern: RegExp; issue: string; authorities: string[]; evidence: string[] }> = [
  {
    pattern: /breach of contract|contract dispute|specific performance/i,
    issue: 'Breach of Contract',
    authorities: ['Indian Contract Act, 1872', 'Specific Relief Act, 1963'],
    evidence: ['Signed contract / agreement', 'Communication records', 'Proof of non-performance'],
  },
  {
    pattern: /property|possession|title|easement|trespass/i,
    issue: 'Property Dispute',
    authorities: ['Transfer of Property Act, 1882', 'Specific Relief Act, 1963', 'Code of Civil Procedure, 1908'],
    evidence: ['Title deeds', 'Revenue records', 'Survey report', 'Witness statements'],
  },
  {
    pattern: /consumer|deficiency of service|unfair trade/i,
    issue: 'Consumer Dispute',
    authorities: ['Consumer Protection Act, 2019', 'Consumer Protection Regulations, 2020'],
    evidence: ['Purchase receipt / invoice', 'Complaint correspondence', 'Expert report (if applicable)'],
  },
  {
    pattern: /matrimonial|divorce|custody|maintenance|domestic violence/i,
    issue: 'Family / Matrimonial Matter',
    authorities: ['Hindu Marriage Act, 1955', 'Special Marriage Act, 1954', 'Protection of Women from DV Act, 2005'],
    evidence: ['Marriage certificate', 'Birth certificates (children)', 'Income proof', 'Medical records (if DV)'],
  },
  {
    pattern: /cheque|dishonor|138|negotiable instrument/i,
    issue: 'Cheque Dishonour (NI Act)',
    authorities: ['Negotiable Instruments Act, 1881 §138-142', 'Code of Criminal Procedure, 1973'],
    evidence: ['Original cheque', 'Bank return memo', 'Legal notice', 'Acknowledgement of notice'],
  },
  {
    pattern: /writ|fundamental rights|article 226|article 32/i,
    issue: 'Constitutional / Writ Matter',
    authorities: ['Constitution of India', 'High Court Rules'],
    evidence: ['Government order / action challenged', 'Proof of fundamental right violation'],
  },
  {
    pattern: /employment|wrongful termination|labour|workman/i,
    issue: 'Employment / Labour Dispute',
    authorities: ['Industrial Disputes Act, 1947', 'Payment of Wages Act, 1936'],
    evidence: ['Appointment letter', 'Termination letter', 'Pay slips', 'HR correspondence'],
  },
  {
    pattern: /defamation|reputation|libel|slander/i,
    issue: 'Defamation',
    authorities: ['Indian Penal Code / BNS §499-500', 'Information Technology Act, 2000 (if online)'],
    evidence: ['Published material / screenshots', 'Proof of publication', 'Proof of harm'],
  },
];

@Injectable()
export class DraftPlannerService {
  private readonly logger = new Logger(DraftPlannerService.name);

  async buildPlan(
    workspace: DraftWorkspaceV3,
    proceduralResults: ProceduralCheckResult[],
  ): Promise<DraftPlan> {
    this.logger.log(`Building draft plan for workspace ${workspace.id}`);

    const objective = workspace.objective ?? '';
    const documentType = workspace.documentType ?? 'court_draft';
    const jurisdiction = workspace.jurisdiction ?? 'India';
    const region = workspace.region;
    const court = workspace.court;

    const matchedIssues = ISSUE_KEYWORDS.filter((ik) => ik.pattern.test(objective));

    const issues = matchedIssues.length > 0
      ? matchedIssues.map((m) => m.issue)
      : [this.inferIssueFromDocumentType(documentType)];

    const requiredAuthorities = [
      ...new Set(matchedIssues.flatMap((m) => m.authorities)),
    ];
    const requiredEvidence = [
      ...new Set(matchedIssues.flatMap((m) => m.evidence)),
    ];

    // Derive assumed facts from workspace
    const existingFacts = this.extractAssumedFacts(workspace);

    const risks = this.computeRisks(proceduralResults, matchedIssues.length === 0);
    const openQuestions = this.computeOpenQuestions(workspace, requiredEvidence, existingFacts);

    const plan: DraftPlan = {
      id: randomUUID(),
      objective,
      jurisdiction: { country: jurisdiction, region: region ?? undefined, court: court ?? undefined },
      documentType,
      issues,
      requiredAuthorities,
      requiredEvidence,
      proceduralChecks: proceduralResults,
      assumedFacts: existingFacts,
      risks,
      openQuestions,
    };

    return plan;
  }

  buildOutline(plan: DraftPlan, workspaceId: string): Omit<DraftSectionV3, 'id' | 'createdAt' | 'updatedAt'>[] {
    const templates = SECTION_TEMPLATES[plan.documentType] ?? DEFAULT_SECTIONS;

    return templates.map((tmpl) => ({
      workspaceId,
      sectionType: tmpl.sectionType,
      title: tmpl.title,
      orderIndex: tmpl.orderIndex,
      required: tmpl.required,
      content: null,
      status: 'pending',
      confidence: null,
      verificationJson: null,
      provenanceJson: null,
      repairHistoryJson: null,
      modelUsed: null,
      costUsd: 0,
      version: 1,
    }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private inferIssueFromDocumentType(documentType: string): string {
    const map: Record<string, string> = {
      court_draft: 'Civil / Legal Matter',
      pleading: 'Pleading Matter',
      contract: 'Contractual Matter',
      letter: 'Correspondence Matter',
      affidavit: 'Sworn Statement',
      notice: 'Legal Notice',
    };
    return map[documentType] ?? 'General Legal Matter';
  }

  private extractAssumedFacts(workspace: DraftWorkspaceV3): DraftFact[] {
    // Read pre-existing facts from planJson if any
    const plan = workspace.planJson as { assumedFacts?: DraftFact[] } | null;
    return plan?.assumedFacts ?? [];
  }

  private computeRisks(
    proceduralResults: ProceduralCheckResult[],
    noIssueIdentified: boolean,
  ): string[] {
    const risks: string[] = [];

    const errors = proceduralResults.filter((r) => !r.passed && r.severity === 'error');
    const warnings = proceduralResults.filter((r) => !r.passed && r.severity === 'warning');

    errors.forEach((e) => risks.push(`PROCEDURAL ERROR: ${e.message}`));
    warnings.forEach((w) => risks.push(`PROCEDURAL WARNING: ${w.message}`));

    if (noIssueIdentified) {
      risks.push('No specific legal issue pattern matched from objective. Manual review recommended.');
    }

    return risks;
  }

  private computeOpenQuestions(
    workspace: DraftWorkspaceV3,
    requiredEvidence: string[],
    facts: DraftFact[],
  ): string[] {
    const questions: string[] = [];

    if (!workspace.court) {
      questions.push('Which court / forum will this document be filed in?');
    }
    if (!workspace.jurisdiction) {
      questions.push('What is the applicable jurisdiction (state / country)?');
    }

    // Check required evidence against provided facts
    const providedEvidenceTexts = facts.map((f) => f.text.toLowerCase());
    requiredEvidence.forEach((ev) => {
      const evLower = ev.toLowerCase();
      const covered = providedEvidenceTexts.some((t) => t.includes(evLower.split(' ')[0]));
      if (!covered) {
        questions.push(`Has the following been collected: ${ev}?`);
      }
    });

    return questions;
  }
}
