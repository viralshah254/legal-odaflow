export function buildIndiaCatalogFormPrompt(meta: {
  formNumber?: string;
  formTitle?: string;
  authority?: string;
  jurisdiction?: string;
  practiceArea?: string;
}): string {
  const title = meta.formTitle ?? meta.formNumber ?? 'Official Filing';
  const court = meta.jurisdiction
    ? `${meta.jurisdiction} courts`
    : meta.authority ?? 'competent Indian court or authority';
  const area = meta.practiceArea ? ` Practice area: ${meta.practiceArea}.` : '';
  return `You are drafting ${title}${meta.formNumber ? ` (Form ${meta.formNumber})` : ''} for filing before ${court}.${area}
Follow Indian court/authority conventions: cause title, numbered paragraphs stating material facts only, prayer/relief clause, verification/affidavit where required, and signature blocks.
Use descriptive [BLANK] placeholders for party names, dates, amounts, and case numbers not supplied.
Apply current Indian statutes (BNSS 2023 for criminal, CPC for civil, relevant special Acts) and cite sections where applicable.`;
}
