import { relevantPassages } from './relevant-passages';
import { focusNamedCaseEvidence } from './named-authority-check-pack';
import { markAttributedAuthorityPassages } from './passage-classification.service';
import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

export interface LlmAdversarialVerifyInput {
  query: string;
  outputMarkdown: string;
  authorities: RetrievedAuthority[];
  /** Independent verifier model (typically gpt-5.6-sol). Must not be the same completion as synthesis. */
  verifierModel: string;
  countryCode?: string;
}

export interface LlmAdversarialVerifyResult {
  findings: VerificationFinding[];
  uncertaintyReported: boolean;
  rawSummary?: string;
}

/**
 * Independent LLM adversarial audit for research memos.
 * Always runs as a separate completion from synthesis/drafting — never self-certifies.
 */
@Injectable()
export class LegalResearchLlmVerifierService {
  private readonly logger = new Logger(LegalResearchLlmVerifierService.name);

  constructor(private readonly llmCompletion: LlmCompletionService) {}

  async verify(input: LlmAdversarialVerifyInput): Promise<LlmAdversarialVerifyResult> {
    if (!this.llmCompletion.isModelConfigured(input.verifierModel)) {
      return { findings: [], uncertaintyReported: false };
    }

    const authorityBlock = focusNamedCaseEvidence(input.authorities, input.query)
      .slice(0, 25)
      .map((a, i) => {
        const cite = a.citation ?? a.title ?? a.id ?? `authority-${i + 1}`;
        const snippet = a.sourcePassages?.length ? relevantPassages(markAttributedAuthorityPassages(a.sourcePassages), `${input.query} ${input.outputMarkdown}`, 6).map(p => `[${p.attribution ?? p.classification ?? 'UNCLASSIFIED SOURCE CONTEXT'}] ${p.paragraph ? `para.${p.paragraph} ` : ''}${p.page ? `p.${p.page} ` : ''}${p.text.slice(0, 6000)}`).join('\n') : (a.fullText ?? a.summary ?? '').slice(0, 6000);
        return `[${i + 1}] ${cite}\nRetrieved source identity: ${JSON.stringify({ title: a.title, court: a.court, decisionDate: a.decisionDate, decisionYear: a.decisionYear, canonicalIdentity: a.sourceProvenance?.canonicalIdentity })}\n${snippet}`;
      })
      .join('\n\n');

    const system = [
      'You are an independent adversarial legal verifier.',
      'You did NOT write the memo below. Your job is to attack weak claims.',
      'Do not invent authorities. Only use the evidence pack provided. Do not promote party submissions, lower-court history or unspecified context into the deciding court’s holding. A dismissed appeal does not make every earlier argument a holding.',
      'Each source block is a separate authority. Never merge facts, currencies, awards or outcomes across different cases, including cases involving similar parties.',
      'Optional historical detail is a MEDIUM improvement unless its omission changes a material answer or misstates the actual disposition. Identify the concrete unsupported affirmative claim for HIGH/BLOCKER findings.',
      'Actual native PDF pages are valid source pinpoints. Do not demand printed reporter pagination unless the user expressly requests it, and never infer a printed page absent from the supplied source.',
      'Explicitly withheld current-law conclusions and disclosed unknown treatment are MEDIUM limitations; flag HIGH/BLOCKER when the memo nevertheless asserts an unsupported operative rule. Do not describe a disclosed evidence gap as a fabricated affirmative claim.',
      'Report at most three material issues, highest severity first. Keep each explanation under 60 words. Quote the specific problematic assertion. Do not repeat properly disclosed source-edition/treatment limitations as new defects; flag an affirmative rule that contradicts those limitations. Distinguish source checking from current-law verification; never invent a good-law finding.',
      'Respond with JSON only in this shape:',
      '{"uncertainty":boolean,"issues":[{"severity":"BLOCKER"|"HIGH"|"MEDIUM"|"LOW","dimension":"application"|"treatment"|"hierarchy"|"currentLaw"|"passage"|"citation","explanation":string,"repairAction":"NARROW"|"QUALIFY"|"REMOVE"|"ABSTAIN"|"RETRIEVE"}]}',
      'Flag: unsupported dispositive claims, conflicting SC/HC authorities left unresolved,',
      'uncertain statute versions / old-new code transitions, negative treatment ignored,',
      'constitutional/criminal liberty claims without binding support, weak entailment.',
    ].join(' ');

    const user = [
      `Country: ${input.countryCode ?? 'unknown'}`,
      `Query:\n${input.query}`,
      `\nEvidence pack:\n${authorityBlock || '(none)'}`,
      `\nMemo under review:\n${input.outputMarkdown.slice(0, 24_000)}`,
    ].join('\n');

    try {
      const completion = await this.llmCompletion.complete({
        modelName: input.verifierModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.1,
        maxTokens: 2500,
        reasoningEffort: 'medium',
      });

      const parsed = this.parseJson(completion.content);
      const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
      if (!Array.isArray(parsed.issues) || issues.some(item => !item || typeof item !== 'object' || !String((item as Record<string, unknown>).explanation ?? '').trim())) {
        throw new Error('Independent verifier returned incomplete findings');
      }
      const findings: VerificationFinding[] = issues
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item, idx) => ({
          checkId: `research:llm-adversarial:${idx + 1}`,
          state: 'FAIL' as const,
          severity: this.asSeverity(item.severity),
          dimension: this.asDimension(item.dimension),
          evidenceIds: [],
          explanation: String(item.explanation ?? 'Adversarial verifier flagged an issue.'),
          repairAction: this.asRepair(item.repairAction),
          verifierVersion: 'legal-research-llm-verifier-v1',
        }));

      return {
        findings,
        uncertaintyReported: Boolean(parsed.uncertainty) || findings.length > 0,
        rawSummary: completion.content.slice(0, 500),
      };
    } catch (err) {
      this.logger.warn(
        `Adversarial LLM verify failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        findings: [
          {
            checkId: 'research:llm-adversarial',
            state: 'INDETERMINATE',
            severity: 'MEDIUM',
            dimension: 'system',
            evidenceIds: [],
            explanation: 'Independent LLM adversarial verification did not complete.',
            repairAction: 'ABSTAIN',
            verifierVersion: 'legal-research-llm-verifier-v1',
          },
        ],
        uncertaintyReported: true,
      };
    }
  }

  private parseJson(content: string): Record<string, unknown> {
    const trimmed = content.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fence?.[1]?.trim() ?? trimmed;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return {};
    try {
      return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private asSeverity(value: unknown): VerificationFinding['severity'] {
    const v = String(value ?? 'MEDIUM').toUpperCase();
    if (v === 'BLOCKER' || v === 'HIGH' || v === 'MEDIUM' || v === 'LOW') return v;
    return 'MEDIUM';
  }

  private asDimension(value: unknown): VerificationFinding['dimension'] {
    const v = String(value ?? 'application');
    const allowed = new Set([
      'identity',
      'passage',
      'quotation',
      'jurisdiction',
      'hierarchy',
      'treatment',
      'currentLaw',
      'application',
      'citation',
      'system',
    ]);
    return (allowed.has(v) ? v : 'application') as VerificationFinding['dimension'];
  }

  private asRepair(value: unknown): VerificationFinding['repairAction'] {
    const v = String(value ?? 'QUALIFY').toUpperCase();
    const allowed = new Set(['RETRIEVE', 'NARROW', 'RECITE', 'REMOVE', 'QUALIFY', 'ABSTAIN']);
    return (allowed.has(v) ? v : 'QUALIFY') as VerificationFinding['repairAction'];
  }
}
