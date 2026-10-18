import { parseAkomaNtosoSections } from '@/legal-sources/parsers/akn-xml.parser';
import { actIdFromFrbrUri, dedupeLatestExpressions } from '@/legal-sources/ke-frbr.util';

describe('parseAkomaNtosoSections', () => {
  it('extracts numbered sections from Akoma Ntoso XML', () => {
    const xml = `
      <akomaNtoso>
        <body>
          <section eId="sec_1">
            <num>1.</num>
            <heading>Short title</heading>
            <content><p>This Act may be cited as the Employment Act.</p></content>
          </section>
          <section eId="sec_2">
            <num>2</num>
            <heading>Interpretation</heading>
            <content><p>In this Act, "employee" means any person employed for wages.</p></content>
          </section>
        </body>
      </akomaNtoso>
    `;

    const sections = parseAkomaNtosoSections(
      xml,
      'https://new.kenyalaw.org/akn/ke/act/2007/11/eng@2022-12-31',
    );

    expect(sections).toHaveLength(2);
    expect(sections[0].section).toBe('1');
    expect(sections[0].fullText).toContain('Employment Act');
    expect(sections[1].section).toBe('2');
    expect(sections[1].title).toContain('Interpretation');
  });
});

describe('ke-frbr helpers', () => {
  it('derives stable act ids from FRBR URIs', () => {
    expect(actIdFromFrbrUri('akn/ke/act/2010/constitution')).toBe('constitution-ke');
    expect(actIdFromFrbrUri('akn/ke/act/2007/11/eng@2022-12-31')).toBe('ke-act-2007-11');
  });

  it('keeps the latest expression per work', () => {
    const rows = dedupeLatestExpressions([
      {
        frbr_uri: 'akn/ke/act/2007/11',
        expression_frbr_uri: 'akn/ke/act/2007/11/eng@2014-12-19',
        updated_at: '2020-01-01',
      },
      {
        frbr_uri: 'akn/ke/act/2007/11',
        expression_frbr_uri: 'akn/ke/act/2007/11/eng@2022-12-31',
        updated_at: '2023-01-01',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].expression_frbr_uri).toContain('@2022-12-31');
  });
});
