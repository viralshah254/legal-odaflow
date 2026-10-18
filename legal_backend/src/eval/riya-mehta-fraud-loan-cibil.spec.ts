import {
  RIYA_MEHTA_ACCEPTANCE_CHECKS,
  RIYA_MEHTA_EXPECTED_CANDIDATE_SIGNALS,
  RIYA_MEHTA_FRAUD_LOAN_CIBIL_QUERY,
} from './riya-mehta-fraud-loan-cibil.fixture';
import { ResearchIntelligenceMapService } from '@/ai/legal-research/research-intelligence-map.service';
import {
  AI_FIRST_RESEARCH_ENGINE_PROMPT,
  buildVerifiedMemoContract,
} from '@/ai/legal-research/research-prompt-blocks';
import { getJurisdictionSourceProfile } from '@/ai/legal-research/global-source-registry';
import { ConfigService } from '@nestjs/config';

describe('Riya Mehta fraudulent loan + CIBIL acceptance (architecture)', () => {
  it('fixture encodes the product query and acceptance gates', () => {
    expect(RIYA_MEHTA_FRAUD_LOAN_CIBIL_QUERY).toMatch(/Riya Mehta/i);
    expect(RIYA_MEHTA_FRAUD_LOAN_CIBIL_QUERY).toMatch(/CIBIL/i);
    expect(RIYA_MEHTA_ACCEPTANCE_CHECKS.requireLiveRetrieval).toBe(true);
    expect(RIYA_MEHTA_ACCEPTANCE_CHECKS.doNotWeakenVerification).toBe(true);
    expect(RIYA_MEHTA_ACCEPTANCE_CHECKS.forbidFalseNoCasesExist).toBe(true);
  });

  it('AI-first prompt forbids treating model knowledge as verified evidence', () => {
    expect(AI_FIRST_RESEARCH_ENGINE_PROMPT).toMatch(/NOT final evidence/i);
    expect(AI_FIRST_RESEARCH_ENGINE_PROMPT).toMatch(/CANDIDATES/i);
    expect(AI_FIRST_RESEARCH_ENGINE_PROMPT).not.toMatch(
      /trust model memory over retrieved/i,
    );
  });

  it('India source registry includes RBI and primary legislation/courts', () => {
    const profile = getJurisdictionSourceProfile('IN');
    expect(profile.regulators.some((r) => /rbi/i.test(r.id) || /rbi/i.test(r.label))).toBe(
      true,
    );
    expect(profile.legislation.length).toBeGreaterThan(0);
    expect(profile.courts.length).toBeGreaterThan(0);
  });

  it('fallback intelligence map surfaces expected candidate search signals', () => {
    const service = new ResearchIntelligenceMapService(
      { complete: jest.fn() } as never,
      { get: () => 'gpt-5.6-sol' } as unknown as ConfigService,
    );
    const map = service.fallbackMap(
      { query: RIYA_MEHTA_FRAUD_LOAN_CIBIL_QUERY, countryCode: 'IN' },
      'gpt-5.6-sol',
      'offline',
    );
    const blob = [
      ...map.researchQueries.map((q) => q.query),
      ...map.contraryAuthorityQueries.map((q) => q.query),
      ...map.likelyStatutes.map((s) => s.title),
      ...map.likelyRegulations.map((r) => r.title),
    ].join('\n');
    for (const signal of RIYA_MEHTA_EXPECTED_CANDIDATE_SIGNALS) {
      expect(blob).toMatch(signal);
    }
    expect(map.likelyStatutes.every((s) => s.origin === 'MODEL_KNOWLEDGE')).toBe(true);
    expect(map.likelyStatutes.every((s) => s.verificationStatus === 'CANDIDATE')).toBe(true);
  });

  it('Verified memo contract requires TOA from retrieved evidence only', () => {
    expect(buildVerifiedMemoContract('IN')).toMatch(/Table of authorities/i);
    expect(buildVerifiedMemoContract('IN')).toMatch(/RETRIEVED|evidence catalog/i);
    expect(buildVerifiedMemoContract('IN')).toMatch(/research leads/i);
    expect(buildVerifiedMemoContract('IN')).toMatch(/Never invent/i);
  });
});
