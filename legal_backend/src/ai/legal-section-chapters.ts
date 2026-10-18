export interface SectionChapterMeta {
  actId: string;
  section: string;
  chapterTitle: string;
  propositionHints: string[];
}

const META: Record<string, SectionChapterMeta> = {
  'bnss:250': {
    actId: 'bnss',
    section: '250',
    chapterTitle: 'Trial before a Court of Session',
    propositionHints: ['sessions', 'discharge'],
  },
  'bnss:251': {
    actId: 'bnss',
    section: '251',
    chapterTitle: 'Trial before a Court of Session',
    propositionHints: ['sessions', 'framing of charge', 'charge'],
  },
  'bnss:252': {
    actId: 'bnss',
    section: '252',
    chapterTitle: 'Trial before a Court of Session',
    propositionHints: ['sessions', 'plea of guilty', 'guilty plea'],
  },
  'bnss:262': {
    actId: 'bnss',
    section: '262',
    chapterTitle: 'Trial of Warrant-Cases by Magistrates',
    propositionHints: ['warrant', 'discharge'],
  },
  'bnss:263': {
    actId: 'bnss',
    section: '263',
    chapterTitle: 'Trial of Warrant-Cases by Magistrates',
    propositionHints: ['warrant', 'framing of charge', 'charge'],
  },
  'bnss:264': {
    actId: 'bnss',
    section: '264',
    chapterTitle: 'Trial of Warrant-Cases by Magistrates',
    propositionHints: ['warrant', 'plea of guilty', 'guilty plea'],
  },
  'bnss:274': {
    actId: 'bnss',
    section: '274',
    chapterTitle: 'Trial of Summons-Cases by Magistrates',
    propositionHints: ['summons', 'substance of accusation'],
  },
  'bnss:275': {
    actId: 'bnss',
    section: '275',
    chapterTitle: 'Trial of Summons-Cases by Magistrates',
    propositionHints: ['summons', 'plea of guilty', 'guilty plea'],
  },
  'bnss:416': {
    actId: 'bnss',
    section: '416',
    chapterTitle: 'Appeals',
    propositionHints: ['appeal', 'guilty plea', 'sentence'],
  },
  'bnss:480': {
    actId: 'bnss',
    section: '480',
    chapterTitle: 'Provisions as to Bail and Bonds',
    propositionHints: ['magistrate', 'non-bailable', 'bail'],
  },
  'bnss:482': {
    actId: 'bnss',
    section: '482',
    chapterTitle: 'Provisions as to Bail and Bonds',
    propositionHints: ['anticipatory', 'bail'],
  },
  'bnss:483': {
    actId: 'bnss',
    section: '483',
    chapterTitle: 'Provisions as to Bail and Bonds',
    propositionHints: ['sessions', 'high court', 'bail'],
  },
  'bns:101': {
    actId: 'bns',
    section: '101',
    chapterTitle: 'Offences Affecting the Human Body',
    propositionHints: ['murder'],
  },
  'bns:63': {
    actId: 'bns',
    section: '63',
    chapterTitle: 'Sexual Offences',
    propositionHints: ['rape'],
  },
  'bns:309': {
    actId: 'bns',
    section: '309',
    chapterTitle: 'Offences Against Property',
    propositionHints: ['robbery', 'theft', 'extortion'],
  },
  'bns:310': {
    actId: 'bns',
    section: '310',
    chapterTitle: 'Offences Against Property',
    propositionHints: ['dacoity', 'five or more'],
  },
  'bns:311': {
    actId: 'bns',
    section: '311',
    chapterTitle: 'Offences Against Property',
    propositionHints: ['deadly weapon', 'grievous hurt', 'robbery', 'dacoity'],
  },
};

export function getSectionChapterMeta(
  actId: string,
  section: string,
): SectionChapterMeta | undefined {
  return META[`${actId.toLowerCase()}:${section.toUpperCase()}`];
}

export function detectChapterMismatch(input: {
  markdown: string;
  actId: string;
  section: string;
}): string | null {
  const meta = getSectionChapterMeta(input.actId, input.section);
  if (!meta) return null;

  const text = input.markdown.toLowerCase();
  if (
    meta.actId === 'bnss' &&
    meta.section === '275' &&
    /(warrant|sessions|court of session|police report|robbery|dacoity)/i.test(input.markdown)
  ) {
    return 'BNSS §275 is in the summons-case chapter; warrant/Sessions guilty-plea contexts require BNSS §264 or §252.';
  }
  if (
    meta.actId === 'bnss' &&
    meta.section === '480' &&
    /(sessions court|court of sessions|high court|post.?rejection|successive bail)/i.test(
      input.markdown,
    )
  ) {
    return 'BNSS §480 is Magistrate-level bail; Sessions/High Court bail should invoke BNSS §483.';
  }
  if (
    meta.actId === 'bns' &&
    meta.section === '310' &&
    !/(five|5|five or more|five persons|five accused)/i.test(input.markdown)
  ) {
    return 'BNS §310 dacoity requires five or more persons conjointly committing or attempting robbery.';
  }

  if (text.includes('ni act') && meta.actId === 'bns' && meta.section === '138') {
    return 'Cheque dishonour should cite NI Act §138, not BNS §138.';
  }

  return null;
}
