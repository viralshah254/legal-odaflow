/**
 * Curated secondary pins for construction-delay / EOT / disruption research.
 * These are NOT primary law. They are labeled secondary analytical sources so
 * synthesis can reason about SCL vs ASCE methodology without inventing citations.
 */

export interface CuratedSecondaryAuthority {
  id: string;
  title: string;
  citation: string;
  sourceName: string;
  sourceUrl: string | null;
  summary: string;
  /** Seed tier: curated pin, not live primary law. */
  sourceTier: 'seed';
  authorityType: 'SECONDARY';
}

export const CONSTRUCTION_DELAY_PROTOCOL_PINS: CuratedSecondaryAuthority[] = [
  {
    id: 'curated-scl-delay-protocol-2nd',
    title: 'Society of Construction Law Delay and Disruption Protocol (2nd edition)',
    citation: 'SCL Delay and Disruption Protocol (2nd ed.)',
    sourceName: 'Society of Construction Law (UK) — secondary protocol',
    sourceUrl: 'https://www.scl.org.uk/resources/delay-disruption-protocol',
    summary:
      'UK-origin guidance on extension of time, delay analysis methodologies (including time impact, windows, as-planned vs as-built), concurrent delay, disruption, and prolongation. Persuasive secondary material in many common-law construction disputes; not binding statute. Confirm reception and contract/governing-law interaction locally.',
    sourceTier: 'seed',
    authorityType: 'SECONDARY',
  },
  {
    id: 'curated-asce-delay-analysis',
    title: 'ASCE Schedule Delay Analysis recommended practice / guidance',
    citation: 'ASCE Schedule Delay Analysis (recommended practice)',
    sourceName: 'American Society of Civil Engineers — secondary guidance',
    sourceUrl: 'https://www.asce.org',
    summary:
      'US engineering-society guidance on schedule delay analysis methods (e.g. impacted as-planned, collapsed as-built, windows, time impact analysis). Often cited by parties as a technical methodology; persuasive weight depends on contract, expert evidence, and forum practice. Not primary law.',
    sourceTier: 'seed',
    authorityType: 'SECONDARY',
  },
  {
    id: 'curated-fidic-delay-framework',
    title: 'FIDIC forms — EOT / delay claim framework (secondary commentary lens)',
    citation: 'FIDIC (typical Red/Yellow/Silver Book EOT machinery)',
    sourceName: 'FIDIC contract framework — secondary analytical lens',
    sourceUrl: null,
    summary:
      'Standard FIDIC employer/contractor risk allocation, notice, and extension-of-time machinery frequently used on African and international projects. Exact clause numbers and edition must be taken from the governing contract; treat as framework only until the signed form is retrieved.',
    sourceTier: 'seed',
    authorityType: 'SECONDARY',
  },
];

const CONSTRUCTION_DELAY_QUERY =
  /\b(delay analysis|extension of time|\bEOT\b|concurrent delay|critical path|time[- ]impact|as[- ]planned|as[- ]built|windows analysis|prolongation|disruption protocol|SCL Delay|ASCE|FIDIC|liquidated damages|programme delay|construction delay)\b/i;

export function queryLooksLikeConstructionDelay(query: string): boolean {
  return CONSTRUCTION_DELAY_QUERY.test(query);
}

export function buildConstructionDelayAuthorityPins(query: string): CuratedSecondaryAuthority[] {
  if (!queryLooksLikeConstructionDelay(query)) return [];
  return CONSTRUCTION_DELAY_PROTOCOL_PINS.map((pin) => ({ ...pin }));
}

export function buildConstructionDelayPinsPromptBlock(
  pins: CuratedSecondaryAuthority[],
): string {
  if (pins.length === 0) return '';
  return [
    'CURATED SECONDARY CONSTRUCTION-DELAY SOURCES (analytical pins — not local primary law):',
    ...pins.map(
      (pin) =>
        `- ${pin.title} (${pin.citation}): ${pin.summary}${
          pin.sourceUrl ? ` Source: ${pin.sourceUrl}` : ''
        }`,
    ),
    'Label propositions drawn only from these pins as "[Analytical guidance — not verified against retrieved sources]" unless independently confirmed by retrieved primary authorities.',
  ].join('\n');
}
