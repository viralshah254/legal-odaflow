import {
  CONDITIONAL_FIELDS_BY_KIND,
  EMPLOYMENT_CONDITIONALS,
  LEASE_CONDITIONALS,
  NDA_CONDITIONALS,
  SERVICE_AGREEMENT_CONDITIONALS,
} from './clause-blocks';

/** Inject conditional clause blocks for drafting-critical document kinds. */
export function injectConditionals(documentKind: string, body: string): string {
  const blocks: string[] = [];

  switch (documentKind) {
    case 'service_agreement':
      blocks.push(
        SERVICE_AGREEMENT_CONDITIONALS.ipClient,
        SERVICE_AGREEMENT_CONDITIONALS.ipProvider,
        SERVICE_AGREEMENT_CONDITIONALS.milestonePayment,
        SERVICE_AGREEMENT_CONDITIONALS.monthlyPayment,
        SERVICE_AGREEMENT_CONDITIONALS.arbitration,
        SERVICE_AGREEMENT_CONDITIONALS.litigation,
      );
      break;
    case 'employment_contract':
      blocks.push(
        EMPLOYMENT_CONDITIONALS.probation,
        EMPLOYMENT_CONDITIONALS.nonCompete,
      );
      break;
    case 'nda':
      blocks.push(
        NDA_CONDITIONALS.mutual,
        NDA_CONDITIONALS.unilateral,
        NDA_CONDITIONALS.duration,
      );
      break;
    case 'lease_agreement':
      blocks.push(LEASE_CONDITIONALS.deposit, LEASE_CONDITIONALS.breakClause);
      break;
    default:
      break;
  }

  if (!blocks.length) return body;
  return `${body}<h3>Additional Terms (conditional)</h3>${blocks.join('')}`;
}

export function getConditionalFields(documentKind: string): string[] | undefined {
  const fields = CONDITIONAL_FIELDS_BY_KIND[documentKind];
  return fields?.length ? fields : undefined;
}
