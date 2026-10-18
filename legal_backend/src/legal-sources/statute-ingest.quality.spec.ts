import {
  hasCaseTitleContamination,
  shouldPreserveExistingStatuteText,
} from './statute-ingest.service';

describe('statute ingest quality guards', () => {
  const substantive = {
    title: 'Admissibility of electronic records',
    fullText:
      '63. Admissibility of electronic records.—A computer output shall be deemed to be also a document when the conditions stated in this section are satisfied.',
  };

  it('preserves substantive existing text from a heading-only replacement', () => {
    expect(
      shouldPreserveExistingStatuteText(substantive, {
        section: '63',
        title: 'Admissibility of electronic records',
        fullText: '63. Admissibility of electronic records.',
      }),
    ).toBe(true);
  });

  it('allows an idempotent or more substantive replacement', () => {
    expect(
      shouldPreserveExistingStatuteText(substantive, {
        section: '63',
        title: substantive.title,
        fullText: `${substantive.fullText} The certificate shall identify the electronic record.`,
      }),
    ).toBe(false);
  });

  it('detects case-title contamination without rejecting statutory prose citations', () => {
    expect(
      hasCaseTitleContamination({
        title: 'Asha Devi v. State of India',
        fullText: 'IN THE SUPREME COURT OF INDIA\nCivil Appeal No. 10\nAppellant versus Respondent',
      }),
    ).toBe(true);
    expect(
      hasCaseTitleContamination({
        title: 'Effect of prior decisions',
        fullText:
          '35. The court may consider a judgment such as Asha Devi v. State of India when relevant.',
      }),
    ).toBe(false);
  });
});
