import { relevantPassages, expandRelevantStatuteProvisions } from './relevant-passages';
it('selects a late holding and its real pinpoint ahead of headers and party submissions', () => {
  const source = [
    { text: 'Supreme Court of Kenya Nairobi employment appeal cover page.', page: 1 },
    { text: 'Counsel submitted that employment notice permits termination without any hearing.', page: 5 },
    { text: 'We find that statutory employment safeguards govern the notice and hearing required before dismissal.', page: 18, paragraph: '41', sourcePinpoint: true },
  ];
  expect(relevantPassages(source, 'employment notice dismissal', 1)[0]).toEqual(source[2]);
});

it('ranks actual notice and payment-in-lieu headings ahead of generic employment mentions', () => {
  const source = [
    { paragraph: 'Section 18', page: 20, text: 'Payment of wages.\n\nAn employer shall pay the employee wages for work done under the employment contract.' },
    { paragraph: 'Section 35', page: 42, text: 'Termination notice.\n\nWhere salary is paid at intervals of a month, termination requires twenty-eight days notice in writing.' },
    { paragraph: 'Section 36', page: 44, text: 'Payment in lieu of notice.\n\nEither party may pay remuneration for the required notice period.' },
  ];
  expect(relevantPassages(source, 'What notice applies to monthly resignation and payment in lieu?', 2).map(p => p.paragraph)).toEqual(expect.arrayContaining(['Section 35', 'Section 36']));
});


it('recovers a relevant provision from the retained complete act after child-section reranking', () => {
  const whole = { id: 'official-act', title: 'Employment Act, 2007', authorityType: 'STATUTE', sourceTier: 'primary', sourceName: 'Official ministry', citation: null, summary: null, sourceUrl: 'https://www.labourmarket.go.ke/media/resources/The_Employment_Act_2007.pdf', sourceProvenance: { completeness: 'COMPLETE' }, sourcePassages: [{ paragraph: 'Section 36', page: 44, sourcePinpoint: true, text: 'Payment in lieu of notice.\n\nEither party may terminate upon payment of remuneration for the period of notice.' }] } as any;
  const results = expandRelevantStatuteProvisions([whole], 'Monthly resignation notice and payment in lieu');
  expect(results.find(authority => authority.section === '36')).toMatchObject({ page: 44, actName: 'Employment Act, 2007', fullText: whole.sourcePassages[0].text });
  expect(expandRelevantStatuteProvisions([{ ...whole, sourceProvenance: { completeness: 'EXCERPT' } }], 'notice')).toHaveLength(1);
});

it('retrieves the actual text and pinpoint of a referenced exception from the complete Act', () => {
  const passages = [{ paragraph: 'Section 41', page: 48, sourcePinpoint: true, text: 'Dismissal notice and hearing.\n\nSubject to section 42(1), notice and hearing apply.' },
    ...Array.from({ length: 8 }, (_, i) => ({ paragraph: `Section ${10 + i}`, page: 20 + i, sourcePinpoint: true, text: 'Notice and hearing.\n\nNotice for dismissal and hearing.' })),
    { paragraph: 'Section 42', page: 49, sourcePinpoint: true, text: 'Probationary contracts. (1) An exception applies.' }];
  const whole = { id: 'act', title: 'Employment Act', authorityType: 'STATUTE', sourceProvenance: { completeness: 'COMPLETE' }, sourcePassages: passages } as any;
  expect(expandRelevantStatuteProvisions([whole], 'Dismissal notice and hearing').find(a => a.section === '42')).toMatchObject({ page: 49, fullText: passages.at(-1)!.text });
});
