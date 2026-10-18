export interface DraftStylePreset {
  id: string;
  label: string;
  description: string;
  promptBlock: string;
}

/**
 * Curated drafting style presets — stored in code, no DB needed.
 * Adding a new preset requires only a deploy.
 *
 * These are injected into the AI system prompt via PromptInjectionService.resolveStyleBlock()
 * when the user selects a preset instead of their personal "My Style".
 */
export const PRESET_DRAFT_STYLES: DraftStylePreset[] = [
  {
    id: 'formal_exhaustive',
    label: 'Formal & Exhaustive',
    description: 'Comprehensive, structured, traditional court language',
    promptBlock: `## DRAFTING STYLE: Formal & Exhaustive
Write in a comprehensive, formal style consistent with traditional Indian/common law court practice.
Use full legal titles and citations. Structure with numbered paragraphs and clear headings.
Anticipate every counter-argument. Include all procedural recitals, supporting facts, and statutory bases.
Leave no ambiguity. Prefer exhaustive enumeration over brevity. Use respectful, ceremonious register throughout.`,
  },
  {
    id: 'concise_direct',
    label: 'Concise & Direct',
    description: 'Crisp, minimal — every sentence carries legal weight',
    promptBlock: `## DRAFTING STYLE: Concise & Direct
Write in a crisp, efficient style. No preamble, throat-clearing, or filler phrases.
Every sentence must carry legal weight. Prefer short, declarative sentences.
Avoid repetition across sections. Omit boilerplate unless legally mandatory.
Use plain English wherever law permits. Strip adjectives that do not add precision.`,
  },
  {
    id: 'plain_language',
    label: 'Plain Language',
    description: 'Accessible and clear — avoids unnecessary legalese',
    promptBlock: `## DRAFTING STYLE: Plain Language
Write in plain, accessible English without sacrificing legal accuracy.
Replace Latin phrases with plain equivalents unless the Latin is the established legal term.
Prefer active voice. Use short sentences and short paragraphs.
Define technical terms on first use. Write as if explaining to an educated non-lawyer.
Maintain all required legal formalities, but strip every unnecessary complexity.`,
  },
  {
    id: 'scholarly',
    label: 'Scholarly',
    description: 'Heavily cited, academic tone with deep legal analysis',
    promptBlock: `## DRAFTING STYLE: Scholarly
Write in a scholarly, analytical style befitting a senior academic or appellate specialist.
Provide deep doctrinal analysis with citations to landmark authorities and law commission reports.
Identify the ratio decidendi of cases cited. Engage with dissenting opinions where relevant.
Structure arguments as propositions supported by layered authority.
Prefer nuanced qualifications over categorical statements. The reader is expected to be an expert.`,
  },
  {
    id: 'assertive_advocate',
    label: 'Assertive Advocate',
    description: 'Bold, persuasive, strong advocacy language',
    promptBlock: `## DRAFTING STYLE: Assertive Advocate
Write as a confident, persuasive advocate making the strongest possible case for the client.
Lead with the strongest argument. Use forceful, unequivocal language where the law supports it.
Frame facts favourably but accurately. Characterise the opposing position at its weakest defensible reading.
Avoid hedging unless legally necessary. The tone is serious, urgent, and professionally assertive.
Every paragraph should advance the client's position.`,
  },
  {
    id: 'balanced_moderate',
    label: 'Balanced',
    description: 'Measured, objective — suitable for neutral applications and consent orders',
    promptBlock: `## DRAFTING STYLE: Balanced
Write in a measured, objective style suitable for consent applications, neutral petitions, or agreed orders.
Present facts and submissions without advocacy bias. Acknowledge complexity where it exists.
Avoid forceful characterisation of any party. Use conditional and hedged language where the outcome is uncertain.
The tone is professional, cooperative, and moderate. Suitable for matters where the court's confidence in balance matters.`,
  },
];

export const PRESET_STYLE_MAP = new Map<string, DraftStylePreset>(
  PRESET_DRAFT_STYLES.map((p) => [p.id, p]),
);

export const DEFAULT_PRESET_ID = 'formal_exhaustive';
