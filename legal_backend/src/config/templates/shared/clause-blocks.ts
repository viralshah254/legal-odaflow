/** Reusable conditional HTML fragments — wrapped with [[if:...]] in injectConditionals(). */

export const SERVICE_AGREEMENT_CONDITIONALS = {
  ipClient: `[[if:ipOwnership == client]]
<h3>Intellectual Property — Assignment to Client</h3>
<p>All work product, inventions, and deliverables created under this Agreement shall vest exclusively in the Client upon creation, and the Service Provider hereby assigns all rights therein to the Client.</p>
[[/if]]`,
  ipProvider: `[[if:ipOwnership == provider]]
<h3>Intellectual Property — Retention by Provider</h3>
<p>The Service Provider retains ownership of pre-existing IP and grants the Client a non-exclusive licence to use deliverables for the purpose of this Agreement.</p>
[[/if]]`,
  milestonePayment: `[[if:paymentSchedule == milestone]]
<h3>Milestone Payments</h3>
<p>Fees shall be invoiced upon completion and acceptance of each milestone as set out in Schedule 1. Payment is due within {{paymentDays}} days of invoice.</p>
[[/if]]`,
  monthlyPayment: `[[if:paymentSchedule == monthly]]
<h3>Monthly Invoicing</h3>
<p>Fees shall be invoiced monthly in arrears and are payable within {{paymentDays}} days of the invoice date.</p>
[[/if]]`,
  arbitration: `[[if:disputeResolution == arbitration]]
<h3>Dispute Resolution — Arbitration</h3>
<p>Any dispute arising under this Agreement shall first be referred to mediation. Failing resolution within 30 days, the dispute shall be finally resolved by arbitration under the applicable arbitration rules of {{governingLaw}}.</p>
[[/if]]`,
  litigation: `[[if:disputeResolution == litigation]]
<h3>Dispute Resolution — Courts</h3>
<p>The courts of {{jurisdiction}} shall have exclusive jurisdiction over any dispute arising from this Agreement.</p>
[[/if]]`,
};

export const EMPLOYMENT_CONDITIONALS = {
  probation: `[[if:probationPeriod truthy]]
<h3>Probation</h3>
<p>The Employee shall serve a probationary period of {{probationPeriod}}. During probation, either party may terminate on shorter notice as permitted by applicable law.</p>
[[/if]]`,
  nonCompete: `[[if:nonCompete == yes]]
<h3>Restrictive Covenants</h3>
<p>For {{nonCompetePeriod}} following termination, the Employee shall not solicit the Employer's clients or employees within {{restrictedTerritory}}, subject to applicable statutory limits.</p>
[[/if]]`,
};

export const NDA_CONDITIONALS = {
  mutual: `[[if:ndaType == mutual]]
<h3>Mutual Obligations</h3>
<p>Each party may disclose Confidential Information to the other. Both parties owe reciprocal confidentiality obligations of equal scope.</p>
[[/if]]`,
  unilateral: `[[if:ndaType == unilateral]]
<h3>Unilateral Disclosure</h3>
<p>Only the Disclosing Party shall share Confidential Information. The Receiving Party's obligations apply solely to information received from the Disclosing Party.</p>
[[/if]]`,
  duration: `[[if:confidentialityDuration truthy]]
<h3>Duration of Confidentiality</h3>
<p>Confidentiality obligations survive for {{confidentialityDuration}} after termination of discussions or the underlying agreement.</p>
[[/if]]`,
};

export const LEASE_CONDITIONALS = {
  deposit: `[[if:depositAmount truthy]]
<h3>Security Deposit</h3>
<p>The Tenant shall pay a security deposit of {{depositAmount}}. Return is subject to applicable tenancy law and fair wear and tear.</p>
[[/if]]`,
  breakClause: `[[if:breakClause == yes]]
<h3>Break Clause</h3>
<p>Either party may terminate early on {{breakNoticePeriod}} written notice, subject to any break premium or statutory requirements.</p>
[[/if]]`,
};

export const CONDITIONAL_FIELDS_BY_KIND: Record<string, string[]> = {
  service_agreement: [
    'ipOwnership',
    'paymentSchedule',
    'disputeResolution',
    'paymentDays',
    'paymentTerms',
  ],
  employment_contract: ['probationPeriod', 'nonCompete', 'nonCompetePeriod', 'restrictedTerritory'],
  nda: ['ndaType', 'confidentialityDuration', 'ndaDurationYears'],
  lease_agreement: ['depositAmount', 'breakClause', 'breakNoticePeriod'],
  partnership_agreement: ['equitySplit', 'partnerRoles'],
  demand_letter: ['paymentDemand', 'claimAmount'],
};
