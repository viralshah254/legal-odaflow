/**
 * The single anti-hallucination contract shared by legal research and document
 * drafting, for every jurisdiction.
 *
 * Connectors (India Kanoon, e-SCR, Kenya Law, CourtListener, web search) are not
 * reliable, so the model is frequently the only thing standing between the user
 * and a fabricated citation. The rule below is therefore deliberately narrow:
 * reasoning is unrestricted, *citation* is not. A source that cannot be
 * verified is reported as a gap - never replaced with a plausible-looking one.
 */

/** Marker for a proposition the evidence pack cannot support. */
export const AUTHORITY_GAP_TEXT = '[AUTHORITY GAP]';

export type LegalFlow = 'research' | 'drafting';

const SHARED_RULES = [
  '1. REASONING IS FREE, CITATION IS NOT. Use your legal knowledge to analyse, explain, structure, and advise. But present a case citation, statute section, rule, regulation, form number, court, or quoted holding as AUTHORITY only when it appears in the evidence provided to you in this prompt.',
  `2. WHEN A SOURCE IS MISSING, SAY SO. If the provided evidence does not support a point, keep your reasoning and mark the point ${AUTHORITY_GAP_TEXT}. Never substitute a plausible-looking citation, reporter reference, section number, or paragraph pinpoint to fill the gap.`,
  '3. RETRIEVAL FAILURE IS NOT ABSENCE OF LAW. If a source could not be searched or returned nothing, say the search was incomplete. Do not conclude, or imply, that no relevant statute or authority exists.',
  '4. NEVER INVENT IDENTIFIERS. Do not invent URLs, reporter volumes or page numbers, neutral citations, docket or petition numbers, paragraph pinpoints, judge names, or dates of judgment.',
  '5. QUOTE ONLY WHAT YOU WERE GIVEN. Quotation marks may only contain text that appears verbatim in a provided passage. Do not paraphrase into quotation marks.',
  '6. STATE THE TEST, NOT THE OUTCOME. Give the governing legal test, its elements, and how the facts bear on each. Do not guarantee a result.',
  '7. ONLY THE HOLDING. State what the cited court actually decided. Party submissions, background facts, obiter, and search-result blurbs are not holdings.',
];

const RESEARCH_RULES = [
  '8. Distinguish clearly between what is VERIFIED (supported by a provided source), what is a RESEARCH LEAD (recalled from knowledge but not retrieved), and what is your own ANALYSIS. Never promote a research lead to controlling authority.',
  '9. Answer the exact question asked. Do not substitute a related question, and do not ask the user to narrow scope when the question already identifies a provision, jurisdiction, or matter.',
];

const DRAFTING_RULES = [
  '8. Cite only from the VERIFIED AUTHORITIES block. Map each ground to the most relevant authority in that block; where the block has nothing on point, plead the ground on the facts and mark the authority as pending rather than inventing one.',
  '9. Do not assert that a procedural route, forum, limitation period, or form is correct unless it is confirmed by the provided material. Where unconfirmed, flag it for confirmation.',
];

/**
 * Build the contract. `countryCode` only adjusts framing - the rules themselves
 * are identical everywhere so no jurisdiction gets weaker protection.
 */
export function buildAntiHallucinationContract(input: {
  flow: LegalFlow;
  countryCode?: string;
}): string {
  const country = input.countryCode?.toUpperCase();
  const scope = country
    ? `Jurisdiction for this task: ${country}. Apply that jurisdiction's own statutes, courts, and citation conventions.`
    : 'Apply the governing jurisdiction\'s own statutes, courts, and citation conventions.';

  return [
    '=== ANTI-HALLUCINATION CONTRACT (MANDATORY, ALL JURISDICTIONS) ===',
    scope,
    ...SHARED_RULES,
    ...(input.flow === 'research' ? RESEARCH_RULES : DRAFTING_RULES),
    'A separate verifier will check every citation against the evidence pack. Unsupported citations will be removed or flagged, and the run will be marked as requiring lawyer review. Writing an honest gap costs you nothing; writing a fabricated citation fails the task.',
    '=== END ANTI-HALLUCINATION CONTRACT ===',
  ].join('\n');
}

/** Generic form for prompt constants that are assembled without a country. */
export const ANTI_HALLUCINATION_CONTRACT_RESEARCH = buildAntiHallucinationContract({
  flow: 'research',
});

export const ANTI_HALLUCINATION_CONTRACT_DRAFTING = buildAntiHallucinationContract({
  flow: 'drafting',
});
