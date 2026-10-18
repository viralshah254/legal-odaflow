/**
 * Thin-jurisdiction usefulness fixture: Uganda construction-delay methodology
 * fight (ASCE vs SCL). Success is measured by substantive comparative analysis
 * and honest reliance labeling — not by verified local citation count alone.
 */

export const UG_CONSTRUCTION_DELAY_QUERY =
  'The Ministry of Works Uganda argues that the American Society of Civil Engineers delay analysis methodology is more applicable to our Ugandan FIDIC infrastructure project than the Society of Construction Law Delay and Disruption Protocol (UK). Review that argument for a common-law jurisdiction: when ASCE vs SCL methods are preferable, how concurrent delay and critical path are treated, and how UK/common-law materials may be persuasive in Uganda.';

export const UG_CONSTRUCTION_DELAY_COUNTRY = 'UG';

/** Phrases a useful analytical memo should address (case-insensitive). */
export const UG_CONSTRUCTION_DELAY_MUST_COVER = [
  'SCL',
  'ASCE',
  'concurrent delay',
  'critical path',
  'common-law',
  'FIDIC',
] as const;

/** Labels that signal honest non-verified doctrine use. */
export const UG_ANALYTICAL_LABEL_MARKERS = [
  'Analytical guidance',
  'not verified against retrieved sources',
  'confirm locally',
  'persuasive',
] as const;

/** Anti-patterns that indicate the thin-RAG failure mode (useless hedge stub). */
export const UG_CONSTRUCTION_DELAY_ANTI_PATTERNS = [
  /I cannot (help|assist|provide).{0,40}without (retrieved|local) (authorit|sources)/i,
  /confirm with (a )?locally licensed practitioner\.?\s*$/i,
  /no authorities were retrieved\.?\s*$/i,
] as const;

export interface ThinJurisdictionUsefulnessScore {
  coveredMustHaveCount: number;
  coveredMustHaveTotal: number;
  hasAnalyticalHonestyMarker: boolean;
  hitAntiPattern: boolean;
  useful: boolean;
}

/**
 * Score usefulness of a thin-jurisdiction construction-delay memo without
 * requiring verified ULII citations.
 */
export function scoreUgandaConstructionDelayMemo(
  outputMarkdown: string,
): ThinJurisdictionUsefulnessScore {
  const text = outputMarkdown ?? '';
  const lower = text.toLowerCase();

  const coveredMustHaveCount = UG_CONSTRUCTION_DELAY_MUST_COVER.filter((term) =>
    lower.includes(term.toLowerCase()),
  ).length;

  const hasAnalyticalHonestyMarker = UG_ANALYTICAL_LABEL_MARKERS.some((marker) =>
    lower.includes(marker.toLowerCase()),
  );

  const hitAntiPattern = UG_CONSTRUCTION_DELAY_ANTI_PATTERNS.some((pattern) =>
    pattern.test(text.trim()),
  );

  // Useful = covers most methodology points, shows honesty about verification,
  // and is not a pure refusal/hedge stub.
  const useful =
    coveredMustHaveCount >= 4 &&
    hasAnalyticalHonestyMarker &&
    !hitAntiPattern &&
    text.trim().length > 800;

  return {
    coveredMustHaveCount,
    coveredMustHaveTotal: UG_CONSTRUCTION_DELAY_MUST_COVER.length,
    hasAnalyticalHonestyMarker,
    hitAntiPattern,
    useful,
  };
}

/** Example memo body used as a regression golden for the scorer itself. */
export const UG_CONSTRUCTION_DELAY_GOLDEN_MEMO = `
# Legal Research Memorandum

## Question Presented
Whether ASCE schedule delay analysis is more applicable than the SCL Delay and Disruption Protocol on a Ugandan FIDIC infrastructure project, and how common-law reception affects that choice.

## Short Answer
[Analytical guidance — not verified against retrieved sources] In a Ugandan common-law forum, neither ASCE nor the SCL Protocol is binding statute. Methodology choice turns on the governing FIDIC (or bespoke) contract, available programme records, and the critical path evidence the tribunal will accept. SCL is often more familiar in commonwealth construction practice; ASCE methods can still be persuasive where the records and expert discipline fit a particular forensic technique. Confirm locally against ULII authorities and the signed contract before filing.

## Legal Framework
[Analytical guidance — not verified against retrieved sources] Uganda receives common-law doctrine alongside local statute. UK secondary materials such as the SCL Delay and Disruption Protocol may be persuasive. ASCE guidance is US engineering secondary material. FIDIC EOT machinery in the governing form controls notice and entitlement thresholds.

## Issues
### Issue 1 — Methodology fit
Rule: Delay analysis methods (time impact, windows, as-planned vs as-built, collapsed as-built) must match the available as-built and baseline data.
Application: Compare SCL protocol recommendations with ASCE recommended practices for concurrent delay and critical path allocation on the project facts.
Conclusion: Prefer the method that can be proven from the records; do not treat Ministry preference alone as legally conclusive.

### Issue 2 — Concurrent delay
[Analytical guidance — not verified against retrieved sources] Address true concurrency vs sequential delay and how EOT vs prolongation costs diverge.

## Risks and Defences
Missing notices, incomplete programmes, and over-reliance on a single methodology without critical path proof.

## Practical Steps
1. Retrieve the signed FIDIC edition and notice clauses.
2. Search ULII for Uganda construction/EOT authorities.
3. Instruct the delay expert to state why the chosen method fits the records.

## Authorities Relied On
(A) Retrieved / verified: none in this fixture.
(B) Analytical secondary: SCL Delay and Disruption Protocol; ASCE schedule delay analysis; FIDIC EOT framework — confirm locally.

## Unanswered Questions
Exact FIDIC edition, notice compliance, and contemporaneous programme updates.

## Appendix: Verification Notes
This memo includes analytical guidance because local corpus coverage was insufficient. Confirm with ULII primary sources before reliance.
`.trim();
