/**
 * U01/U32 — Direct defect reproductions from the Umbrella audit.
 * These tests document fail-closed expectations; several assert fixed behavior.
 */
import { VerifiedSourceRegistryService } from '@/ai/unified-drafting/retrieval/verified-source-registry.service';
import {
  enforceVerifiedSourceAdmission,
  toSourcePromptEntry,
} from '@/ai/unified-drafting/contracts/verified-source';
import { CitationBindingService } from '@/platform/research/citation-binding.service';
import { VerificationService } from '@/platform/verification/verification.service';
import { StatuteExistenceVerifier } from '@/ai/drafting/platform/validators/statute-existence-verifier';
import type { DraftWorkspaceV3 } from '@prisma/client';

describe('Umbrella defect regressions', () => {
  const registrySvc = new VerifiedSourceRegistryService();

  it('F01: partially verified source is not promoted to verified', async () => {
    const registry = await registrySvc.build('job-1', [
      {
        id: 'fake-case',
        type: 'case',
        jurisdiction: 'unknown',
        title: 'Invented v State',
        citation: '(2020) 1 FAKE 1',
        text: 'Some text',
        verificationStatus: 'partially_verified',
        contentHash: 'abc',
      },
    ]);
    expect(registry.sources[0].verificationStatus).toBe('partially_verified');
    const prompt = toSourcePromptEntry(registry.sources[0]);
    expect(prompt.verified).toBe(false);
    expect(prompt.citable).toBe(false);
  });

  it('F01: prompt does not mark partial sources as verified', () => {
    const entry = toSourcePromptEntry({
      id: 'x',
      type: 'case',
      jurisdiction: 'IN',
      title: 'T',
      verificationStatus: 'partially_verified',
      contentHash: 'h',
    });
    expect(entry.verified).toBe(false);
  });

  it('F15: two citation names do not verify an absurd proposition', () => {
    const binding = new CitationBindingService();
    const paragraph =
      'Authority Alpha and Authority Beta prove that the moon is made of cheese.';
    const authorities = [
      {
        id: 'a1',
        canonicalId: 'a1',
        citation: 'Authority Alpha',
        title: 'Authority Alpha',
        jurisdiction: 'IN',
        authorityWeight: 1,
        relevanceScore: 0.5,
        treatmentStatus: 'good_law' as const,
      },
      {
        id: 'a2',
        canonicalId: 'a2',
        citation: 'Authority Beta',
        title: 'Authority Beta',
        jurisdiction: 'IN',
        authorityWeight: 1,
        relevanceScore: 0.5,
        treatmentStatus: 'good_law' as const,
      },
    ];
    const props = binding.bindParagraphPropositions(paragraph, authorities);
    expect(props.length).toBeGreaterThan(0);
    expect(props.some((p) => p.supportStatus === 'verified')).toBe(false);
  });

  it('F16: empty findings must not yield readyForFiling', () => {
    const verification = new VerificationService({} as never);
    const workspace = { id: 'ws-1' } as DraftWorkspaceV3;
    const report = verification.calculateFilingReadiness(workspace, []);
    expect(report.readyForFiling).toBe(false);
    expect(report.overallScore).toBeLessThan(100);
  });

  it('F09: FAKEACT triggers unknown act finding', () => {
    const verifier = new StatuteExistenceVerifier();
    const findings = verifier.evaluate({
      metadata: {
        caseRecordId: 'cr-1',
        version: 1,
        status: 'draft',
        extractedAt: new Date().toISOString(),
        sourceHash: 'x',
        playbookId: 'p',
        playbookVersion: '1',
      },
      jurisdiction: { countryCode: 'IN' },
      parties: [],
      facts: [],
      chronology: [],
      evidence: [],
      statutes: [
        { id: 's1', actId: 'FAKEACT', section: '99999', raw: 'FAKEACT s.99999', charged: true },
      ],
      suggestedStatutes: [],
      contradictions: [],
      missingFields: [],
      matterData: {},
    });
    const unknownAct = findings.some((f) => f.message.includes('Unrecognized actId'));
    expect(unknownAct).toBe(true);
  });

  it('F01b: verified status without evidence receipt is downgraded at registry build', async () => {
    const registry = await registrySvc.build('job-2', [
      enforceVerifiedSourceAdmission({
        id: 'no-receipt',
        type: 'case',
        jurisdiction: 'IN',
        title: 'Test',
        verificationStatus: 'verified',
        contentHash: 'abc',
        verbatimPassage: 'Locked passage text for citation.',
      }),
    ]);
    expect(registry.sources[0].verificationStatus).toBe('partially_verified');
  });
});
