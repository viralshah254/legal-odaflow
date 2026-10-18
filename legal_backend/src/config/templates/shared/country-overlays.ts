export type Tier1Country = 'IN' | 'US' | 'KE' | 'GB';

export const COUNTRY_PREFIX: Record<Tier1Country, string> = {
  IN: 'India',
  US: 'US',
  KE: 'Kenya',
  GB: 'UK',
};

export const COUNTRY_DEFAULT_JURISDICTION: Record<Tier1Country, string> = {
  IN: 'India',
  US: 'United States',
  KE: 'Kenya',
  GB: 'England & Wales',
};

/** Legal framework preamble injected per country and document kind. */
export const COUNTRY_LEGAL_FRAMEWORK: Record<Tier1Country, Record<string, string>> = {
  IN: {
    default:
      '<p><em>Legal framework: Indian Contract Act, 1872; applicable state/union territory law; stamp duty and registration requirements may apply.</em></p>',
    service_agreement:
      '<p><em>Governed by the Indian Contract Act, 1872. GST invoicing and TDS withholding may apply. DPDP Act, 2023 applies to personal data processing.</em></p>',
    employment_contract:
      '<p><em>Subject to applicable Shops & Establishments Act, Payment of Wages Act, 1936, EPF Act, 1952, Payment of Gratuity Act, 1972, and state labour rules.</em></p>',
    lease_agreement:
      '<p><em>Subject to state rent control/tenancy laws and RERA, 2016 where applicable. Stamp duty per state Article of Schedule.</em></p>',
    sale_agreement:
      '<p><em>Subject to Transfer of Property Act, 1882 and state registration/stamp duty requirements including RERA for certain projects.</em></p>',
    nda:
      '<p><em>Confidentiality obligations subject to Indian Contract Act and DPDP Act, 2023 for personal data.</em></p>',
    last_will_testament:
      '<p><em>Execution and attestation per Indian Succession Act, 1925 (or personal law applicable to the testator).</em></p>',
    llc_operating_agreement:
      '<p><em>Limited liability company governance subject to Companies Act, 2013 (LLP Act, 2008 for LLPs) and applicable state rules.</em></p>',
    incorporation_documents:
      '<p><em>Incorporation via MCA SPICe+ portal; DIN, DSC, and stamp duty per state may apply.</em></p>',
  },
  US: {
    default:
      '<p><em>Legal framework: applicable state and federal law. Consult local counsel for filing, notarisation, and recording requirements.</em></p>',
    service_agreement:
      '<p><em>Subject to UCC Article 2 where applicable and state contract law. Independent contractor classification must comply with IRS and state labour rules.</em></p>',
    employment_contract:
      '<p><em>Employment at-will unless otherwise stated. FLSA, state wage/hour, and anti-discrimination laws apply. Non-competes may be void in certain states (e.g. California).</em></p>',
    lease_agreement:
      '<p><em>Subject to state landlord-tenant statutes and local rent control ordinances where applicable.</em></p>',
    sale_agreement:
      '<p><em>Subject to state real property law, disclosure statutes, and title/escrow customs.</em></p>',
    nda:
      '<p><em>Trade secret protection under DTSA and applicable state UTSA. CCPA/state privacy laws may apply to personal information.</em></p>',
    llc_operating_agreement:
      '<p><em>Governed by state LLC statute (e.g. Delaware LLC Act, California Corp. Code). Single-member vs multi-member tax treatment may differ.</em></p>',
    incorporation_documents:
      '<p><em>State-specific articles of organisation/incorporation and registered agent requirements apply.</em></p>',
  },
  KE: {
    default:
      '<p><em>Legal framework: Constitution of Kenya, 2010 and applicable Acts of Parliament.</em></p>',
    service_agreement:
      '<p><em>Subject to Law of Contract Act (Cap 23) and applicable tax/withholding requirements.</em></p>',
    employment_contract:
      '<p><em>Subject to Employment Act, 2007, Work Injury Benefits Act, and NSSF/NHIF requirements.</em></p>',
    lease_agreement:
      '<p><em>Subject to Landlord and Tenant (Shops, Hotels and Catering Establishments) Act and Land Registration Act, 2012.</em></p>',
    sale_agreement:
      '<p><em>Subject to Land Registration Act, 2012 and stamp duty under Stamp Duty Act.</em></p>',
    nda:
      '<p><em>Confidentiality enforceable under Law of Contract Act; Data Protection Act, 2019 applies to personal data.</em></p>',
    llc_operating_agreement:
      '<p><em>Subject to Limited Liability Partnership Act, 2011 or Companies Act, 2015 as applicable.</em></p>',
    incorporation_documents:
      '<p><em>Registration with Business Registration Service; Companies Act, 2015 and stamp duty requirements apply.</em></p>',
  },
  GB: {
    default:
      '<p><em>Legal framework: laws of England and Wales unless otherwise stated. Scottish/Northern Irish variants may differ.</em></p>',
    service_agreement:
      '<p><em>Subject to Consumer Rights Act 2015 (B2C) and common law contract principles. IR35 may apply to contractor arrangements.</em></p>',
    employment_contract:
      '<p><em>Subject to Employment Rights Act 1996, Equality Act 2010, and Working Time Regulations 1998.</em></p>',
    lease_agreement:
      '<p><em>Subject to Landlord and Tenant Act 1954 (commercial) and Housing Act provisions (residential).</em></p>',
    sale_agreement:
      '<p><em>Subject to Law of Property Act 1925 and UK conveyancing practice including SDLT.</em></p>',
    nda:
      '<p><em>Confidentiality under common law and Trade Secrets (Enforcement, etc.) Regulations 2018. UK GDPR applies to personal data.</em></p>',
    last_will_testament:
      '<p><em>Execution per Wills Act 1837 (England & Wales). Separate rules apply in Scotland.</em></p>',
    llc_operating_agreement:
      '<p><em>UK private limited companies governed by Companies Act 2006; LLP members agreement for LLPs.</em></p>',
    incorporation_documents:
      '<p><em>Companies House filing (IN01/LL IN01); statement of compliance and PSC register required.</em></p>',
  },
};

export function getCountryFramework(countryCode: Tier1Country, documentKind: string): string {
  const country = COUNTRY_LEGAL_FRAMEWORK[countryCode];
  return country[documentKind] ?? country.default ?? '';
}

export function applyCountryOverlay(
  countryCode: Tier1Country,
  documentKind: string,
  body: string,
): string {
  const framework = getCountryFramework(countryCode, documentKind);
  if (!framework) return body;
  return `${framework}${body}`;
}
