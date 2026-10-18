export interface JudicialCouncilFormMeta {
  formCode: string;
  title: string;
  category: string;
}

export function jcFormKind(formCode: string): string {
  const slug = formCode.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `us_ca_form_${slug}`;
}

export function buildJudicialCouncilPrompt(meta: JudicialCouncilFormMeta): string {
  return `You are completing California Judicial Council Form ${meta.formCode} (${meta.title}) — ${meta.category}. Follow mandatory Judicial Council form layout: caption, party names, numbered fields matching the official form, verification/declaration, and signature blocks. Use descriptive [BLANK] placeholders. Apply California Rules of Court and relevant statute citations.`;
}

export function resolveJudicialCouncilPrompt(formCode: string, title?: string): string {
  return buildJudicialCouncilPrompt({
    formCode,
    title: title ?? formCode,
    category: 'California Court',
  });
}

export function resolveJudicialCouncilPromptByKind(kind: string): string | null {
  const match = kind.match(/^us_ca_form_([a-z0-9]+)$/i);
  if (!match) return null;
  const code = match[1].toUpperCase();
  return resolveJudicialCouncilPrompt(code);
}

export function resolveDynamicFormPrompt(formNumber: string, title?: string, jurisdiction?: string): string {
  const j = jurisdiction ? `${jurisdiction} ` : '';
  return `You are completing ${j}official form ${formNumber}${title ? ` (${title})` : ''}. Follow the official form instructions structure with all required sections, fields, declarations, and signature blocks. Use descriptive [BLANK] placeholders for user-supplied information.`;
}
