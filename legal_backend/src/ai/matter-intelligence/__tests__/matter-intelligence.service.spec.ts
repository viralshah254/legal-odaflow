import { MatterIntelligenceService } from '../matter-intelligence.service';
import { ConfidenceGateService } from '../confidence-gate.service';
import {
  getLegalAssetMetadata,
  scoreMetadataMatch,
} from '../legal-asset-metadata';
import {
  ARJUN_WRONGFUL_TERMINATION_FACTS,
  DRAFT_EMPLOYMENT_CONTRACT_QUERY,
  GOLDEN_FIXTURES,
  NEHA_SHARMA_MAINTENANCE_FACTS,
  WRONGFULLY_TERMINATED_QUERY,
} from './golden-fixtures';

describe('MatterIntelligenceService', () => {
  const service = new MatterIntelligenceService(
    { isProviderConfigured: () => false } as never,
    new ConfidenceGateService(),
  );

  describe('classifyHeuristic — golden fixtures', () => {
    it.each(GOLDEN_FIXTURES)(
      'classifies $label as $expected.practiceArea / $expected.subPracticeArea',
      ({ facts, expected }) => {
        const { profile } = service.classifyHeuristic(facts, 'IN');

        expect(profile.practiceArea).toBe(expected.practiceArea);
        expect(profile.subPracticeArea).toBe(expected.subPracticeArea);
        expect(profile.nature).toBe(expected.nature);
        if (expected.documentKind) {
          expect(profile.documentKind).toBe(expected.documentKind);
        }
      },
    );
  });

  describe('Arjun Patel wrongful termination', () => {
    it('classifies employment_labour / wrongful_termination / dispute, not employment_contract', () => {
      const { profile } = service.classifyHeuristic(ARJUN_WRONGFUL_TERMINATION_FACTS, 'IN');

      expect(profile.practiceArea).toBe('employment_labour');
      expect(profile.subPracticeArea).toBe('wrongful_termination');
      expect(profile.nature).toBe('dispute');
      expect(profile.subPracticeArea).not.toBe('employment_contract');
      expect(profile.documentKind).toBe('wrongful_termination_petition');
    });
  });

  describe('Neha Sharma maintenance revision', () => {
    it('classifies family_matrimonial maintenance, not employment wrongful termination', () => {
      const { profile } = service.classifyHeuristic(NEHA_SHARMA_MAINTENANCE_FACTS, 'IN');

      expect(profile.practiceArea).toBe('family_matrimonial');
      expect(profile.subPracticeArea).toBe('maintenance');
      expect(profile.issues).toEqual(
        expect.arrayContaining(['Maintenance claim', 'Interim vs final order']),
      );
      expect(profile.issues).not.toContain('Wrongful termination');
      expect(profile.documentKind).toBe('maintenance_order_revision');
    });
  });

  describe('dispute vs contract routing', () => {
    it('routes "draft employment contract" to employment_contract / transaction', () => {
      const { profile } = service.classifyHeuristic(DRAFT_EMPLOYMENT_CONTRACT_QUERY, 'IN');

      expect(profile.practiceArea).toBe('employment_labour');
      expect(profile.subPracticeArea).toBe('employment_contract');
      expect(profile.nature).toBe('transaction');
      expect(profile.documentKind).toBe('employment_contract');
    });

    it('routes "wrongfully terminated" to wrongful_termination / dispute', () => {
      const { profile } = service.classifyHeuristic(WRONGFULLY_TERMINATED_QUERY, 'IN');

      expect(profile.practiceArea).toBe('employment_labour');
      expect(profile.subPracticeArea).toBe('wrongful_termination');
      expect(profile.nature).toBe('dispute');
      expect(profile.documentKind).toBe('wrongful_termination_petition');
    });
  });

  describe('metadata scoring — india_wrongful_termination vs arbitration kinds', () => {
    const wrongfulTerminationProfile = {
      practiceArea: 'employment_labour',
      subPracticeArea: 'wrongful_termination',
      nature: 'dispute' as const,
      forum: 'labour_court',
    };

    it('scores india_wrongful_termination higher than arbitration kinds for employment dispute', () => {
      const wrongfulMeta = getLegalAssetMetadata('india_wrongful_termination');
      const arbitrationMeta = getLegalAssetMetadata('india_arbitration_notice_s21');

      expect(wrongfulMeta).toBeDefined();
      expect(arbitrationMeta).toBeDefined();

      const wrongfulScore = scoreMetadataMatch(wrongfulMeta!, wrongfulTerminationProfile);
      const arbitrationScore = scoreMetadataMatch(arbitrationMeta!, wrongfulTerminationProfile);

      expect(wrongfulScore).toBeGreaterThan(arbitrationScore);
      expect(wrongfulScore).toBeGreaterThanOrEqual(0.7);
      expect(arbitrationScore).toBeLessThan(0.5);
    });

    it('excludes arbitration practice area when employment profile carries exclude rules', () => {
      const arbitrationMeta = getLegalAssetMetadata('india_arbitration_notice_s21');
      const excludedScore = scoreMetadataMatch(
        arbitrationMeta!,
        wrongfulTerminationProfile,
        ['arbitration_adr'],
      );

      expect(excludedScore).toBe(0);
    });
  });
});
