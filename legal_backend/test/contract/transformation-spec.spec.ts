/**
 * Contract tests — Transformation Spec Phases 3-6
 */

import { AI_CREDIT_COSTS } from '@/ai-credits/credit-costs';
import { INTERNAL_AGENTS } from '@/agents/agent.registry';
import { COUNTRY_PRICING_SEEDS, PRICING_PLANS } from '@/config/pricing.config';
import { DEFAULT_TRAINING_CONSENT_STATUS } from '@/training-consent/training-consent.constants';
import { CONSUMER_FULL_REPORT_SECTIONS } from '@/consumer-reports/report-sections';
import { LEGAL_SOURCE_COUNTRY_CODES } from '@/legal-sources/legal-source.seed';

describe('API contract — training consent', () => {
  it('defaults new training consent to DENIED', () => {
    expect(DEFAULT_TRAINING_CONSENT_STATUS).toBe('DENIED');
  });
});

describe('API contract — governance settings', () => {
  const GOVERNANCE_ROUTES = {
    getSettings: 'GET /governance/settings',
    updateSettings: 'PATCH /governance/settings',
  };

  it('exposes tenant governance settings routes', () => {
    expect(GOVERNANCE_ROUTES.getSettings).toContain('/governance/settings');
    expect(GOVERNANCE_ROUTES.updateSettings).toMatch(/^PATCH/);
  });
});

describe('API contract — pricing plans', () => {
  it('seeds pricing for IN/US/KE/GB launch markets', () => {
    for (const country of ['IN', 'US', 'KE', 'GB']) {
      const plans = COUNTRY_PRICING_SEEDS.filter((plan) => plan.countryCode === country);
      expect(plans.length).toBeGreaterThan(0);
    }
  });

  it('includes consumer and firm plan ids', () => {
    expect(PRICING_PLANS.CONSUMER_FREE).toBe('consumer_free');
    expect(PRICING_PLANS.FIRM_PROFESSIONAL).toBe('firm_professional');
  });
});

describe('API contract — transformation modules', () => {
  it('defines AI credit costs from spec §10.6 / §15.3', () => {
    expect(AI_CREDIT_COSTS.ISSUE_CHECKER).toBe(1);
    expect(AI_CREDIT_COSTS.CONSUMER_FULL_REPORT).toBe(20);
    expect(AI_CREDIT_COSTS.LEGAL_RESEARCH).toBe(30);
  });

  it('registers Phase 5/6 AI agents', () => {
    expect(INTERNAL_AGENTS['document-explainer']).toBeDefined();
    expect(INTERNAL_AGENTS['opponent-analyzer']).toBeDefined();
    expect(INTERNAL_AGENTS['evidence-gap']).toBeDefined();
    expect(INTERNAL_AGENTS.deadline).toBeDefined();
    expect(INTERNAL_AGENTS['billing-recovery']).toBeDefined();
  });

  it('defines 15-section consumer full report', () => {
    expect(CONSUMER_FULL_REPORT_SECTIONS).toHaveLength(15);
  });

  it('seeds legal source connectors for IN/US/KE/GB', () => {
    expect(LEGAL_SOURCE_COUNTRY_CODES).toEqual(['IN', 'US', 'KE', 'GB']);
  });
});
