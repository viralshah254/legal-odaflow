/**
 * Unit tests: CaseRecord → NormalizedMatter merge and curated consumer retrieval.
 */

import { CaseRecordExtractionService } from '../platform/case-record-extraction.service';
import { DraftCaseBriefService } from '../draft-case-brief.service';
import { DraftPlaybookRegistryService } from '../platform/draft-playbook-registry.service';
import { DraftKindPlaybookService } from '../playbooks/draft-kind-playbook.service';
import {
  buildCaseRecordFactsBlock,
  mergeCaseRecordIntoNormalizedMatter,
} from './case-record-to-normalized-matter.util';
import { getCuratedConsumerResearchSources } from './curated-consumer-sources.util';
import { isConfirmedCaseRecord } from './case-record-prompt.util';
import { RIYA_INTAKE } from './riya-intake.fixture';
import type { CaseRecord } from '../contracts/case-record';
import type { NormalizedMatter } from '@/ai/unified-drafting/contracts/normalized-matter';

function confirmRecord(cr: CaseRecord): CaseRecord {
  return {
    ...cr,
    metadata: {
      ...cr.metadata,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      confirmedByUserId: 'test-user',
    },
  };
}

function sparseMatter(): NormalizedMatter {
  return {
    id: 'matter_test',
    jurisdiction: 'IN',
    documentKind: 'india_consumer_research_memo',
    parties: [],
    facts: [
      { id: 'f1', statement: 'Consent on 10 March', status: 'confirmed', source: 'matter' },
      { id: 'f2', statement: 'Amount ₹1.8L', status: 'confirmed', source: 'matter' },
    ],
    dates: [],
    requestedRelief: [],
    proceduralHistory: [],
    userAssertions: [],
    missingInputs: [],
    contradictions: [],
    sourceDocumentIds: [],
    rawUserInput: RIYA_INTAKE,
    normalizedAt: new Date().toISOString(),
  };
}

describe('CaseRecord primary facts (Phase 2)', () => {
  const extraction = new CaseRecordExtractionService(
    new DraftCaseBriefService(),
    new DraftPlaybookRegistryService(new DraftKindPlaybookService()),
  );

  it('isConfirmedCaseRecord requires metadata.status confirmed', () => {
    const draft = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_research_memo',
    });
    expect(isConfirmedCaseRecord(draft)).toBe(false);
    expect(isConfirmedCaseRecord(confirmRecord(draft))).toBe(true);
  });

  it('merges full Riya chronology and facts into NormalizedMatter', () => {
    const cr = confirmRecord(
      extraction.extract({
        caseDetails: RIYA_INTAKE,
        documentKind: 'india_consumer_research_memo',
        clientName: 'Riya Desai',
        opposingParty: 'Sunrise Multispeciality Hospital',
        courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
      }),
    );
    const merged = mergeCaseRecordIntoNormalizedMatter(sparseMatter(), cr);
    expect(merged.caseRecordBacked).toBe(true);
    expect(merged.facts.length).toBeGreaterThan(5);

    const hay = merged.facts.map((f) => f.statement).join('\n');
    expect(hay).toMatch(/bile|surgery|11 March|expert|consent/i);
    expect(merged.facts.every((f) => f.source === 'court_record')).toBe(true);
  });

  it('buildCaseRecordFactsBlock contains bile leak, surgery, and experts', () => {
    const cr = confirmRecord(
      extraction.extract({
        caseDetails: RIYA_INTAKE,
        documentKind: 'india_consumer_research_memo',
      }),
    );
    const block = buildCaseRecordFactsBlock(cr);
    expect(block).toMatch(/CASE RECORD FACTS/i);
    expect(block).toMatch(/bile/i);
    expect(block).toMatch(/11 March|surgery/i);
    expect(block).toMatch(/expert|medical board|recognised complication/i);
  });

  it('retrieveAll consumer research includes Spring Meadows for Riya intake', () => {
    const sources = getCuratedConsumerResearchSources(
      'india_consumer_research_memo',
      RIYA_INTAKE,
    );
    expect(sources.some((s) => /spring meadows/i.test(s.title))).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(3);
  });

  it('excludes Nitin Khandelwal when no repudiation in intake', () => {
    const sources = getCuratedConsumerResearchSources(
      'india_consumer_research_memo',
      RIYA_INTAKE,
    );
    expect(sources.some((s) => /nitin khandelwal/i.test(s.title))).toBe(false);
  });
});
