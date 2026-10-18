import { buildFormEmbedText, formSearchText } from '@/legal-forms/form-embed-text.util';
import type { JurisdictionForm } from '@prisma/client';

describe('form-embed-text util', () => {
  const c1a = {
    formName: 'Allegations of Harm and Domestic Violence',
    formNumber: 'C1A',
    authority: 'HM Courts & Tribunals Service',
    description: 'Statement of allegations for family proceedings',
    practiceArea: 'FAMILY_MATRIMONIAL',
    category: 'Family',
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
  } as JurisdictionForm;

  it('includes domestic violence synonyms in embed text', () => {
    const text = buildFormEmbedText(c1a);
    expect(text).toContain('domestic violence');
    expect(text).toContain('C1A');
    expect(text).toContain('FAMILY_MATRIMONIAL');
  });

  it('includes synonyms in lexical search text', () => {
    const text = formSearchText(c1a);
    expect(text.toLowerCase()).toContain('husband');
    expect(text.toLowerCase()).toContain('assault');
  });
});
