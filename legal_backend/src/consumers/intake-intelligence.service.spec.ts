import { IntakeIntelligenceService } from './intake-intelligence.service';
import type { ConfigService } from '@nestjs/config';
import type { LlmCompletionService } from '@/ai/llm-completion.service';

describe('IntakeIntelligenceService', () => {
  const config = {
    get: () => 'gpt-test',
  } as unknown as ConfigService;

  it('heuristic fallback routes transactional facts to draft', () => {
    const llm = {
      isModelConfigured: () => false,
      complete: jest.fn(),
    } as unknown as LlmCompletionService;
    const service = new IntakeIntelligenceService(config, llm);

    const result = service.heuristicFallback({
      facts: 'Please draft an NDA between Acme Corp and a contractor in Mumbai',
      countryCode: 'IN',
      issueType: 'Contract & Document Drafting',
    });

    expect(result.intent).toBe('TRANSACTIONAL_DRAFT');
    expect(result.toolPlan).toContain('draft');
    expect(result.recommendedNextTool).toBe('draft');
    expect(result.toolPlan).toContain('section_finder');
  });

  it('heuristic fallback prefers strategy for disputes', () => {
    const llm = {
      isModelConfigured: () => false,
      complete: jest.fn(),
    } as unknown as LlmCompletionService;
    const service = new IntakeIntelligenceService(config, llm);

    const result = service.heuristicFallback({
      facts: 'Employee was terminated without notice and seeks reinstatement',
      countryCode: 'IN',
      issueType: 'Employment & Workplace',
      jurisdiction: 'Delhi',
    });

    expect(result.intent).toBe('DISPUTE_ADVISORY');
    expect(result.recommendedNextTool).toBe('strategy');
    expect(result.toolPlan[0]).toBe('strategy');
    expect(result.jurisdictionHints).toContain('Delhi');
  });

  it('analyze merges LLM tool plan and sets recommendedNextTool', async () => {
    const llm = {
      isModelConfigured: () => true,
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          intent: 'DISPUTE_ADVISORY',
          jurisdictionHints: ['Kenya', 'Nairobi'],
          missingSlots: ['terminationLetter'],
          toolPlan: ['retrieve', 'section_finder', 'strategy'],
        }),
      }),
    } as unknown as LlmCompletionService;
    const service = new IntakeIntelligenceService(config, llm);

    const result = await service.analyze({
      facts: 'Unfair dismissal after pregnancy disclosure',
      countryCode: 'KE',
      issueType: 'Employment & Workplace',
    });

    expect(result.intent).toBe('DISPUTE_ADVISORY');
    expect(result.toolPlan).toEqual(
      expect.arrayContaining(['strategy', 'retrieve', 'section_finder']),
    );
    expect(result.recommendedNextTool).toBe('strategy');
    expect(result.missingSlots).toContain('terminationLetter');
  });
});
