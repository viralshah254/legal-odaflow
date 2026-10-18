import { Injectable } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';
import type { MatterGraph, MatterParty, TimelineEvent } from './matter-intelligence.types';

@Injectable()
export class MatterGraphExtractorService {
  constructor(private readonly llmCompletion: LlmCompletionService) {}

  async extract(facts: string, matterId?: string): Promise<MatterGraph> {
    const heuristic = this.extractHeuristic(facts);

    if (this.llmCompletion.isProviderConfigured('openai') && facts.length > 200) {
      try {
        const llm = await this.extractWithLlm(facts);
        return { ...heuristic, ...llm, matterId };
      } catch {
        return { ...heuristic, matterId };
      }
    }

    return { ...heuristic, matterId };
  }

  extractHeuristic(facts: string): MatterGraph {
    const parties: MatterParty[] = [];
    const timeline: TimelineEvent[] = [];

    const employerMatch = facts.match(
      /(?:employer|company|XYZ|Industries|Pvt\.?\s*Ltd\.?)[:\s]+([A-Z][A-Za-z0-9\s.&]+?)(?:\.|,|\n|$)/i,
    );
    const employeeMatch = facts.match(
      /(?:Mr\.?|Ms\.?|Mrs\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    );

    if (employeeMatch) {
      parties.push({ name: employeeMatch[0].trim(), role: 'Employee', side: 'claimant' });
    }
    if (employerMatch) {
      parties.push({
        name: employerMatch[1]?.trim() ?? 'Employer',
        role: 'Employer',
        side: 'respondent',
      });
    }

    const dateMatches = facts.matchAll(
      /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4}-\d{2}-\d{2})/gi,
    );
    for (const m of dateMatches) {
      timeline.push({ date: m[1], description: 'Event referenced in facts', eventType: 'fact_date' });
    }

    if (/\bterminated\b|\btermination\b/i.test(facts)) {
      timeline.push({ description: 'Termination of employment', eventType: 'termination' });
    }

    const claims: MatterGraph['claims'] = [];
    if (/\breinstatement\b/i.test(facts)) {
      claims.push({ summary: 'Seeking reinstatement with continuity of service', reliefSought: 'reinstatement' });
    }
    if (/\bback wages\b/i.test(facts)) {
      claims.push({ summary: 'Claim for back wages', reliefSought: 'back_wages' });
    }
    if (/\bcompensation\b/i.test(facts)) {
      claims.push({ summary: 'Claim for compensation for illegal termination', reliefSought: 'compensation' });
    }

    const defences: MatterGraph['defences'] = [];
    if (/\bmanagerial\b|\bnot a.? workman\b/i.test(facts)) {
      defences.push({ summary: 'Employee is managerial, not a workman under labour laws' });
    }
    if (/\bcontractual termination\b|\bone month.?s notice\b/i.test(facts)) {
      defences.push({ summary: 'Termination was contractual with notice/salary in lieu' });
    }

    return {
      parties,
      claims,
      defences,
      statutes: [],
      precedents: [],
      evidence: [],
      documents: [],
      timeline,
    };
  }

  private async extractWithLlm(facts: string): Promise<Partial<MatterGraph>> {
    const prompt = `Extract structured matter data from these legal facts. Return JSON:
{
  "parties": [{"name":"","role":"","side":"claimant|respondent"}],
  "claims": [{"summary":"","reliefSought":""}],
  "defences": [{"summary":""}],
  "timeline": [{"date":"","description":"","eventType":""}]
}
Facts: ${facts.slice(0, 4000)}`;

    const response = await this.llmCompletion.complete({
      modelName: DEFAULT_AUTO_MODEL,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
      temperature: 0.1,
    });

    const text = response.content?.trim() ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    return JSON.parse(jsonMatch[0]) as Partial<MatterGraph>;
  }
}
