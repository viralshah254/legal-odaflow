/**
 * Acceptance fixture: Riya Mehta fraudulent personal loan + CIBIL damage (India).
 * Architecture must use AI knowledge to plan retrieval; never invent verified authorities.
 */

export const RIYA_MEHTA_FRAUD_LOAN_CIBIL_QUERY = `
Case: Fraudulent Loan + CIBIL Damage
Facts: Riya Mehta, a resident of Ahmedabad, discovers that a ₹4,80,000 personal loan has been opened in her name with a digital lender without her knowledge. The loan amount was disbursed to a third-party bank account. Recovery agents are contacting her, and her CIBIL score has been damaged.
Questions:
1. What criminal and civil remedies are available?
2. What regulatory complaints (RBI / ombudsman / credit information company) apply?
3. What interim relief can protect her credit and stop recovery harassment?
4. What evidence should be preserved (BSA / electronic records)?
5. Identify similar Indian cases and governing statutes/regulations.
`.trim();

/** Expected intelligence-map / retrieval targets (candidates), not invented citations. */
export const RIYA_MEHTA_EXPECTED_CANDIDATE_SIGNALS = [
  /rbi|digital lending|fair practices|ombudsman/i,
  /consumer protection|cpa\s*2019|deficiency/i,
  /cibil|credit information|credit score/i,
  /it act|identity theft|cheating|bns/i,
  /bsa|electronic evidence|sakshya/i,
  /injunction|declaration|interim/i,
];

export const RIYA_MEHTA_ACCEPTANCE_CHECKS = {
  id: 'riya-mehta-fraud-loan-cibil',
  countryCode: 'IN',
  researchMode: 'DEEP' as const,
  requireLiveRetrieval: true,
  requireIntelligenceMap: true,
  requireSimilarCasesOutcomeHonesty: true,
  forbidFalseNoCasesExist: true,
  requireClaimLevelCitations: true,
  doNotWeakenVerification: true,
};
