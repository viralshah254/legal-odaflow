export const STANDARD_DISCLAIMER =
  'Legal by OdaFlow provides legal information, document explanation, self-help preparation, and risk analysis. ' +
  'It is not a law firm and does not replace a licensed lawyer. ' +
  'For legal advice specific to your situation, you should consult a qualified lawyer in your jurisdiction.';

export const HIGH_RISK_TRIGGERS = [
  'court deadline',
  'arrest',
  'criminal charge',
  'eviction notice',
  'child custody emergency',
  'domestic violence',
  'deportation',
  'immigration removal',
  'large monetary claim',
  'injunction',
  'restraining order',
  'police report',
  'FIR',
  'charge sheet',
  'regulatory investigation',
  'tax penalty notice',
  'limitation deadline',
  'notice to appear in court',
] as const;

export const DEFAULT_RESTRICTED_PHRASES = [
  'AI lawyer',
  'guaranteed legal advice',
  'guaranteed win',
  'replace your lawyer',
  'court-proof',
  '100% accurate legal advice',
] as const;
