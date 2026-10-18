import { parseAknProvisionTree } from './akn-provision-tree.parser';

describe('parseAknProvisionTree', () => {
  it('retains section, subsection and paragraph parentage', () => {
    const provisions = parseAknProvisionTree(`
      <section eId="sec_5">
        <num>5.</num><heading>Duty</heading>
        <subsection eId="sec_5__subsec_1">
          <num>(1)</num>
          <paragraph eId="sec_5__subsec_1__para_a">
            <num>(a)</num><content><p>Keep accurate records.</p></content>
          </paragraph>
        </subsection>
      </section>
    `);

    expect(provisions.map(({ provisionKey }) => provisionKey)).toEqual([
      'sec_5',
      'sec_5__subsec_1',
      'sec_5__subsec_1__para_a',
    ]);
    expect(provisions[1].parentProvisionKey).toBe('sec_5');
    expect(provisions[2].parentProvisionKey).toBe('sec_5__subsec_1');
  });
});
