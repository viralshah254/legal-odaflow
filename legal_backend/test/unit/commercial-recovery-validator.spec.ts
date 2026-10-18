import { evaluateCommercialRecoveryDraft } from '@/ai/drafting/accuracy/commercial-recovery-validator';
import type { CaseRecord } from '@/ai/drafting/contracts/case-record';
import { buildCommercialRecoveryFactLock } from '@/ai/draft-intent/commercial-recovery-calculator';

const facts = `
Invoice No. APS/2451 dated 5 October 2025 — ₹12,00,000.
On 10 December 2025, Zenith paid ₹7,50,000.
Payment was due within 30 days. Interest is 18% per annum.
Apex intends to institute proceedings on 15 July 2026.
The acknowledgment was sent by email and WhatsApp.
`;

function record(confirmed: boolean): CaseRecord {
  const lock = buildCommercialRecoveryFactLock({
    facts,
    deliveryBasis: confirmed ? 'invoice_dates' : undefined,
    allocationMethod: confirmed ? 'oldest_invoice_first' : undefined,
    confirmed,
  });
  return {
    metadata: {
      caseRecordId: 'CR_TEST',
      version: 1,
      status: confirmed ? 'confirmed' : 'draft',
      extractedAt: new Date().toISOString(),
      sourceHash: 'hash',
      playbookId: 'commercial',
      playbookVersion: '1',
    },
    jurisdiction: { countryCode: 'IN' },
    parties: [],
    facts: [],
    chronology: [],
    evidence: [],
    statutes: [],
    suggestedStatutes: [],
    contradictions: [],
    missingFields: [],
    matterData: {},
    factLocks: [
      {
        id: 'FACT_LOCK_COMMERCIAL_RECOVERY',
        kind: lock.kind,
        version: 1,
        status: lock.blockingIssues.length ? 'blocked' : 'confirmed',
        sourceHash: 'hash',
        payload: lock,
        blockingIssues: lock.blockingIssues,
      },
    ],
  };
}

const completeStructure = `
COMMERCIAL DISPUTE AND MAINTAINABILITY
JURISDICTION
LIMITATION
VALUATION AND COURT FEE
PRAYER
VERIFICATION
STATEMENT OF TRUTH
SUPPORTING AFFIDAVIT
LIST OF DOCUMENTS
Electronic record preservation, original device, complete conversation and certificate particulars.
`;

describe('commercial recovery filing validator', () => {
  it('blocks invoice identifier drift and unsupported allegations', () => {
    const result = evaluateCommercialRecoveryDraft({
      caseRecord: record(true),
      caseDetails: facts,
      documentKind: 'india_suit_recovery_cpc_37',
      draftText: `${completeStructure}
Invoice APS/9999 — ₹12,00,000.
The Defendant is in financial distress and is dishonestly dissipating assets.
`,
    });

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'COMMERCIAL_INVOICE_ID_MISMATCH',
        'COMMERCIAL_UNSUPPORTED_SERIOUS_ALLEGATION',
      ]),
    );
  });

  it('blocks a final calculation while appropriation remains unconfirmed', () => {
    const result = evaluateCommercialRecoveryDraft({
      caseRecord: record(false),
      caseDetails: facts,
      documentKind: 'india_suit_recovery_cpc_37',
      draftText: `${completeStructure}
Invoice APS/2451 — ₹12,00,000. Part payment ₹7,50,000.
`,
    });

    expect(result.findings.map((finding) => finding.code)).toContain(
      'COMMERCIAL_CALCULATION_INPUTS_UNCONFIRMED',
    );
  });
});
