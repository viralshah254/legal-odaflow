import { OutlineBuilderService } from './outline-builder.service';

describe('draft section dependency contract', () => {
  it('starts independent factual sections together and preserves legal dependencies', () => {
    const builder = new OutlineBuilderService({ buildPromptBlock: () => '' } as never);
    const outline = builder.build({ id: 'p', documentKind: 'india_regular_bail_bnss_480', documentTitle: 'Bail',
      documentClass: 'pleading', countryCode: 'IN', jurisdiction: 'IN', filingGrade: true,
      mandatorySections: ['Applicable Law', 'Maintainability', 'Arguments'], issues: [], requiredIngredients: [], requiredEvidence: [], requiredAuthorities: [] } as any,
      { authorities: [], statuteGrounding: '' }, { kind: 'india_regular_bail_bnss_480', caseDetails: 'Fictional facts' }, {} as any, {} as any);
    const byType = Object.fromEntries(outline.sections.map(section => [section.type, section]));
    expect(byType.heading.dependsOn).toEqual([]);
    expect(byType.parties.dependsOn).toEqual([]);
    expect(byType.facts.dependsOn).toEqual([]);
    expect(byType.maintainability.dependsOn).toContain(byType.facts.id);
    expect(byType.grounds.dependsOn).toEqual(expect.arrayContaining([byType.facts.id, byType.law.id]));
    expect(byType.arguments.dependsOn).toContain(byType.grounds.id);
    expect(byType.prayer.dependsOn).toContain(byType.grounds.id);
  });
});
