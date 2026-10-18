import { CAUSE_TITLE_INSTRUCTION } from './section-generator.service';
import { INDIA_COURT_PLEADING_PROTOCOL } from '@/ai/drafting/legal-accuracy-protocol';

describe('filing-grade cause title instructions', () => {
  it('requires a filled court caption and forbids invented citations in grounds protocol', () => {
    expect(CAUSE_TITLE_INSTRUCTION).toMatch(/IN THE HIGH COURT/i);
    expect(CAUSE_TITLE_INSTRUCTION).toMatch(/never leave it empty/i);
    expect(CAUSE_TITLE_INSTRUCTION).toMatch(/MOST RESPECTFULLY SHOWETH/i);
    expect(INDIA_COURT_PLEADING_PROTOCOL).toMatch(/never an empty heading/i);
    expect(INDIA_COURT_PLEADING_PROTOCOL).toMatch(/forum and competence only/i);
  });
});
