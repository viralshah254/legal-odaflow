import { ExtractFormFieldsService } from '@/ai/india-draft/extract-form-fields.service';

const MEDICAL = `
Jurisdiction: Ahmedabad, Gujarat, India.
Complainant: Riya Desai, aged 32 years, software engineer, residing at Navrangpura, Ahmedabad.
Opposite Party No. 1: Sunrise Multispeciality Hospital Pvt. Ltd., Ahmedabad.
Opposite Party No. 2: Dr. Mahesh Trivedi, consultant general surgeon.
Opposite Party No. 3: Dr. Kavita Rao, consultant anaesthesiologist.
Opposite Party No. 4: SecureCare Health Insurance Ltd.
Prepare: 1) Legal research memo 2) Consumer complaint under CPA.
A CT scan was performed on 13 March 2025.
`.trim();

describe('ExtractFormFieldsService', () => {
  const service = new ExtractFormFieldsService();

  it('extracts labeled complainant and opposite parties without LLM', async () => {
    const result = await service.extract({
      caseDetails: MEDICAL,
      kind: 'india_legal_research_memo',
      category: 'Research',
    });

    expect(result.source).toBe('regex');
    expect(result.clientName).toBe('Riya Desai');
    expect(result.opposingParty).toContain('Sunrise Multispeciality Hospital Pvt. Ltd');
    expect(result.opposingParty).toContain('Dr. Mahesh Trivedi');
    expect(result.opposingParty).toContain('Dr. Kavita Rao');
    expect(result.opposingParty).toContain('SecureCare Health Insurance Ltd');
    expect(result.parties?.defendants).toHaveLength(4);
    expect(result.courtName).toBe(
      'District Consumer Disputes Redressal Commission, Ahmedabad',
    );
    expect(result.courtName?.toLowerCase()).not.toContain('scan');
  });

  it('extractRegex mirrors extract for labeled consumer facts', () => {
    const regex = service.extractRegex(MEDICAL, 'india_consumer_complaint', 'Consumer');
    expect(regex.clientName).toBe('Riya Desai');
    expect(regex.parties?.defendants).toHaveLength(4);
    expect(regex.courtName).toBe(
      'District Consumer Disputes Redressal Commission, Ahmedabad',
    );
  });

  it('uses LLM fallback when regex finds nothing and llm is provided', async () => {
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          clientName: 'Asha Patel',
          opposingParty: 'Acme Motors Ltd',
          courtName: 'District Court, Surat',
          oppositeParties: null,
        }),
      }),
    };
    const withLlm = new ExtractFormFieldsService(llm as never);
    const result = await withLlm.extract({
      caseDetails:
        'The buyer wants a refund after the seller refused to deliver the car purchased in Surat last year.',
      kind: 'india_civil_plaint',
      category: 'Civil',
    });
    expect(llm.complete).toHaveBeenCalled();
    expect(result.source).toBe('hybrid');
    expect(result.clientName).toBe('Asha Patel');
    expect(result.opposingParty).toBe('Acme Motors Ltd');
    expect(result.courtName).toBe('District Court, Surat');
  });
});
