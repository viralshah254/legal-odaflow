import { parseKenyaLawAknHtmlSections } from '@/legal-sources/connectors/kenya-law.connector';
import {
  isIngestableKenyaAct,
  KenyaLawCatalogConnector,
} from '@/legal-sources/connectors/kenya-law-catalog.connector';
import { actIdFromFrbrUri, natureFromFrbrUri, toKeManifestEntry } from '@/legal-sources/ke-frbr.util';

describe('parseKenyaLawAknHtmlSections', () => {
  it('uses top-level section numbers from h3 headings, not subsection (1) labels', () => {
    const html = `
      <section class="akn-section" id="part_II__sec_5" data-eid="part_II__sec_5">
        <h3>5. Discrimination in employment</h3>
        <section class="akn-subsection" id="part_II__sec_5__subsec_1">
          <span class="akn-num">(1)</span>
          <span class="akn-p">It shall be the duty of the Cabinet Secretary.</span>
        </section>
      </section>
      <section class="akn-section" id="part_II__sec_6" data-eid="part_II__sec_6">
        <h3>6. Sexual harassment</h3>
        <section class="akn-subsection" id="part_II__sec_6__subsec_1">
          <span class="akn-num">(1)</span>
          <span class="akn-p">An employer shall take steps to prevent sexual harassment.</span>
        </section>
      </section>
    `;

    const sections = parseKenyaLawAknHtmlSections(
      html,
      'https://new.kenyalaw.org/akn/ke/act/2007/11/eng@2022-12-31',
    );

    expect(sections).toHaveLength(2);
    expect(sections[0].section).toBe('5');
    expect(sections[0].title).toContain('Discrimination in employment');
    expect(sections[1].section).toBe('6');
  });

  it('does not silently truncate instruments with more than 500 provisions', () => {
    const html = Array.from(
      { length: 501 },
      (_, index) => `
        <section class="akn-section" id="part_I__sec_${index + 1}">
          <h3>${index + 1}. Provision ${index + 1}</h3>
          <span class="akn-p">Complete provision text number ${index + 1}.</span>
        </section>`,
    ).join('');

    expect(
      parseKenyaLawAknHtmlSections(html, 'https://new.kenyalaw.org/akn/ke/act/2026/1'),
    ).toHaveLength(501);
  });
});

describe('KenyaLawCatalogConnector', () => {
  const connector = new KenyaLawCatalogConnector();

  it('parses act rows from catalog HTML', () => {
    const html = `
      <tr class="">
        <td class="cell-title">
          <a href="/akn/ke/act/1930/10/eng@2023-12-11">Penal Code</a>
        </td>
        <td class="cell-citation">Cap. 63</td>
      </tr>
      <tr class="">
        <td class="cell-title">
          <a href="/akn/ke/act/ln/2023/91/eng@2023-08-25">Declaration of Chetambe Forest</a>
        </td>
        <td class="cell-citation">Legal Notice 91 of 2023</td>
      </tr>
    `;

    const rows = connector.parseCatalogPage(html);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Penal Code');
    expect(rows[0].expressionFrbrUri).toBe('akn/ke/act/1930/10/eng@2023-12-11');
    expect(rows[0].capCitation).toBe('Cap. 63');
  });

  it('maps catalog rows to registry act ids when Cap matches', () => {
    const entry = connector.toManifestEntry({
      title: 'Penal Code',
      expressionFrbrUri: 'akn/ke/act/1930/10/eng@2023-12-11',
      capCitation: 'Cap. 63',
    });

    expect(entry.actId).toBe('cap-63');
    expect(entry.publicUrl).toContain('1930/10');
  });
});

describe('isIngestableKenyaAct', () => {
  it('includes primary acts and excludes legal notices', () => {
    expect(isIngestableKenyaAct('akn/ke/act/1930/10/eng@2023-12-11')).toBe(true);
    expect(isIngestableKenyaAct('akn/ke/act/2010/constitution')).toBe(true);
    expect(isIngestableKenyaAct('akn/ke/act/2010/constitution/eng@2010-09-03')).toBe(true);
    expect(isIngestableKenyaAct('akn/ke/act/ln/2023/91/eng@2023-08-25')).toBe(false);
    expect(isIngestableKenyaAct('akn/ke/act/corr/2012/18/eng@2012-03-23')).toBe(false);
    expect(isIngestableKenyaAct('akn/ke/act/gn/1956/2165/eng@2022-12-31')).toBe(false);
  });
});

describe('actIdFromFrbrUri', () => {
  it('assigns unique ids to subsidiary legal notices and gazette notices', () => {
    expect(actIdFromFrbrUri('akn/ke/act/ln/2023/161/eng@2023-12-01')).toBe('ke-ln-2023-161');
    expect(actIdFromFrbrUri('akn/ke/act/ln/2022/147/eng@2022-12-31')).toBe('ke-ln-2022-147');
    expect(actIdFromFrbrUri('akn/ke/act/gn/2022/6022/eng@2022-05-27')).toBe('ke-gn-2022-6022');
    expect(actIdFromFrbrUri('akn/ke/act/2016/31/eng@2022-12-31')).toBe('ke-act-2016-31');
    expect(actIdFromFrbrUri('akn/ke/act/2010/constitution/eng@2010-09-03')).toBe('constitution-ke');
  });

  it('does not collide across legal notices from the same year', () => {
    const a = actIdFromFrbrUri('akn/ke/act/ln/2023/161/eng@2023-12-01');
    const b = actIdFromFrbrUri('akn/ke/act/ln/2023/91/eng@2023-08-25');
    expect(a).not.toBe(b);
  });
});

describe('natureFromFrbrUri and toKeManifestEntry', () => {
  it('classifies subsidiary instruments', () => {
    expect(natureFromFrbrUri('akn/ke/act/ln/2023/161/eng@2023-12-01')).toBe('legal_notice');
    expect(natureFromFrbrUri('akn/ke/act/gn/2022/6022/eng@2022-05-27')).toBe('gazette_notice');
    expect(natureFromFrbrUri('akn/ke/act/2016/31/eng@2022-12-31')).toBe('act');

    const ln = toKeManifestEntry({
      title: 'Access to Information (General) Regulations',
      expressionFrbrUri: 'akn/ke/act/ln/2023/161/eng@2023-12-01',
    });
    expect(ln.actId).toBe('ke-ln-2023-161');
    expect(ln.nature).toBe('legal_notice');
    expect(ln.year).toBe('2023');
    expect(ln.number).toBe('161');
    expect(ln.expressionDate).toBe('2023-12-01');
  });
});
