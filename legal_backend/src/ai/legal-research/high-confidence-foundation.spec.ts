import { ContraryAuthorityQueryService } from './contrary-authority-query.service';
import { EvidenceAdmissionService } from './evidence-admission.service';
import {
  LegalConflictResolver,
  type ConflictAuthority,
} from './legal-conflict-resolver.service';
import { SourceIntegrityService } from './source-integrity.service';
import { TemporalApplicabilityService } from './temporal-applicability.service';
import type { SourceProvenance } from '@/legal-search/legal-retrieval.types';

const provenance = (overrides: Partial<SourceProvenance> = {}): SourceProvenance => ({
  provider: 'Supreme Court',
  retrievedAt: '2026-07-27T10:00:00.000Z',
  canonicalUrl: 'https://example.test/judgment',
  documentHash: 'sha256:abc',
  completeness: 'COMPLETE',
  extractionMethod: 'NATIVE_TEXT',
  authoritativeStatus: 'OFFICIAL',
  ...overrides,
});

const conflictAuthority = (
  authorityId: string,
  position: string,
  overrides: Partial<ConflictAuthority> = {},
): ConflictAuthority => ({
  authorityId,
  position,
  jurisdiction: 'IN',
  bindingStatus: 'BINDING',
  treatmentStatus: 'good_law',
  treatmentVerified: true,
  passageClassification: 'HOLDING',
  admissionPassed: true,
  ...overrides,
});

describe('high-confidence legal research foundation', () => {
  describe('source integrity and admission', () => {
    it('fails closed when provenance is absent', () => {
      expect(new SourceIntegrityService().assess()).toMatchObject({
        state: 'INDETERMINATE',
        intact: false,
      });
      expect(
        new EvidenceAdmissionService().admit({
          authority: { fullText: 'A legally operative passage.' },
          intendedUse: 'LEGAL_RULE',
        }),
      ).toMatchObject({ admitted: false, state: 'INDETERMINATE' });
    });

    it('rejects low-confidence OCR and user factual material as legal authority', () => {
      const decision = new EvidenceAdmissionService().admit({
        authority: {
          fullText: 'Scanned text',
          sourceProvenance: provenance({
            extractionMethod: 'OCR',
            ocr: { used: true, confidence: 0.7 },
          }),
          userAuthorityStatus: 'FACTUAL_MATERIAL_ONLY',
        },
        intendedUse: 'LEGAL_RULE',
      });
      expect(decision.admitted).toBe(false);
      expect(decision.state).toBe('FAIL');
      expect(decision.permittedUses).toEqual(['MATTER_FACT']);
    });

    it('admits complete official native text for a holding', () => {
      expect(
        new EvidenceAdmissionService().admit({
          authority: {
            fullText: 'The appeal is dismissed.',
            sourceProvenance: provenance(),
            sourcePassages: [
              { text: 'The appeal is dismissed.', classification: 'HOLDING' },
            ],
          },
          intendedUse: 'LEGAL_RULE',
        }),
      ).toMatchObject({ admitted: true, state: 'PASS' });
    });
  });

  describe('temporal applicability', () => {
    it('evaluates effective ranges against the legally relevant event', () => {
      const result = new TemporalApplicabilityService().evaluate({
        effectiveFrom: '2024-07-01',
        effectiveTo: '2026-01-01',
        eventDate: '2025-02-10',
        asOfDate: '2026-07-27',
      });
      expect(result.status).toBe('APPLICABLE');
      expect(result.applicable).toBe(true);
    });

    it('does not silently assume historical applicability for an undated repeal', () => {
      expect(
        new TemporalApplicabilityService().evaluate({
          effectiveFrom: '2020-01-01',
          repealed: true,
          eventDate: '2022-01-01',
          asOfDate: '2026-07-27',
        }),
      ).toMatchObject({ status: 'UNKNOWN', applicable: false });
    });
  });

  it('generates bounded contrary-authority searches for propositions and citations', () => {
    const queries = new ContraryAuthorityQueryService().generate({
      proposition: 'A director is personally liable',
      jurisdiction: 'India',
      citedAuthorities: [{ title: 'Example Ltd v Rao', citation: '(2020) 1 SCC 1' }],
      limit: 5,
    });
    expect(queries).toHaveLength(5);
    expect(queries.join(' ')).toMatch(/overruled/);
    expect(queries.join(' ')).toContain('Example Ltd v Rao');
  });

  describe('legal conflict resolution', () => {
    const resolver = new LegalConflictResolver();

    it('returns SETTLED for aligned admitted binding holdings', () => {
      expect(
        resolver.resolve([
          conflictAuthority('A', 'notice required'),
          conflictAuthority('B', 'notice required'),
        ]).status,
      ).toBe('SETTLED');
    });

    it('returns JURISDICTION_SPLIT for conflicting local binding rules', () => {
      expect(
        resolver.resolve([
          conflictAuthority('A', 'notice required', { jurisdiction: 'IN-DL' }),
          conflictAuthority('B', 'notice unnecessary', { jurisdiction: 'IN-BOM' }),
        ]).status,
      ).toBe('JURISDICTION_SPLIT');
    });

    it('returns FACT_DEPENDENT when authorities turn on distinguishable facts', () => {
      expect(
        resolver.resolve([
          conflictAuthority('A', 'liable', { materiallyDistinguishableFacts: true }),
          conflictAuthority('B', 'not liable'),
        ]).status,
      ).toBe('FACT_DEPENDENT');
    });

    it('returns PREDOMINANT for materially stronger binding support', () => {
      expect(
        resolver.resolve([
          conflictAuthority('A', 'notice required', { courtLevel: 0 }),
          conflictAuthority('B', 'notice required', { courtLevel: 0 }),
          conflictAuthority('C', 'notice unnecessary', {
            bindingStatus: 'PERSUASIVE',
            treatmentVerified: false,
            passageClassification: 'DICTA',
          }),
        ]).status,
      ).toBe('PREDOMINANT');
    });

    it('returns UNRESOLVED when no source passed admission', () => {
      expect(
        resolver.resolve([
          conflictAuthority('A', 'liable', { admissionPassed: false }),
          conflictAuthority('B', 'not liable', { admissionPassed: false }),
        ]).status,
      ).toBe('UNRESOLVED');
    });
  });
});
