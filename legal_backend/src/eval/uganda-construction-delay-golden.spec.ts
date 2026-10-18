import {
  UG_CONSTRUCTION_DELAY_GOLDEN_MEMO,
  UG_CONSTRUCTION_DELAY_MUST_COVER,
  UG_CONSTRUCTION_DELAY_QUERY,
  scoreUgandaConstructionDelayMemo,
} from './uganda-construction-delay-golden.fixture';
import { decideAnalyticalMode } from '@/ai/legal-research/analytical-research-mode';
import {
  buildConstructionDelayAuthorityPins,
  queryLooksLikeConstructionDelay,
} from '@/ai/legal-research/construction-delay-authorities';
import { LegalResearchClassifierService } from '@/ai/legal-research/legal-research-classifier.service';
import { MatterIntelligenceService } from '@/ai/matter-intelligence/matter-intelligence.service';
import { getResearchOverlay } from '@/config/jurisdictions/research-overlays';

describe('Uganda construction-delay thin-jurisdiction usefulness', () => {
  const matterIntelligence = {
    classify: jest.fn(),
  } as unknown as MatterIntelligenceService;
  const classifier = new LegalResearchClassifierService(matterIntelligence);

  it('classifies the client-style query as CONSTRUCTION_DELAY', () => {
    const result = classifier.classify({
      query: UG_CONSTRUCTION_DELAY_QUERY,
      countryCode: 'UG',
    });
    expect(result.legalDomain).toBe('CONSTRUCTION_DELAY');
    expect(queryLooksLikeConstructionDelay(UG_CONSTRUCTION_DELAY_QUERY)).toBe(true);
  });

  it('activates analytical mode for empty UG retrieval', () => {
    const decision = decideAnalyticalMode({
      countryCode: 'UG',
      authorityCount: 0,
      sufficiencyPassed: false,
    });
    expect(decision.enabled).toBe(true);
    expect(decision.relianceLabel).toBe('analytical-guidance');
  });

  it('pins SCL/ASCE/FIDIC secondary sources for the query', () => {
    const pins = buildConstructionDelayAuthorityPins(UG_CONSTRUCTION_DELAY_QUERY);
    expect(pins.length).toBeGreaterThanOrEqual(3);
  });

  it('has a Uganda research overlay with ULII-first priority', () => {
    const overlay = getResearchOverlay('UG');
    expect(overlay).toBeDefined();
    expect(overlay!.sourcePriority[0].toLowerCase()).toContain('ulii');
  });

  it('scores the golden analytical memo as useful', () => {
    const score = scoreUgandaConstructionDelayMemo(UG_CONSTRUCTION_DELAY_GOLDEN_MEMO);
    expect(score.coveredMustHaveCount).toBe(UG_CONSTRUCTION_DELAY_MUST_COVER.length);
    expect(score.hasAnalyticalHonestyMarker).toBe(true);
    expect(score.hitAntiPattern).toBe(false);
    expect(score.useful).toBe(true);
  });

  it('rejects a thin hedge stub as not useful', () => {
    const stub =
      'No authorities were retrieved. Please confirm with a locally licensed practitioner.';
    const score = scoreUgandaConstructionDelayMemo(stub);
    expect(score.useful).toBe(false);
    expect(score.hitAntiPattern).toBe(true);
  });
});
