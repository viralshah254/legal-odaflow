export type TransferSafeguard =
  | 'NOT_APPLICABLE'
  | 'ADEQUACY_DECISION'
  | 'CONTRACTUAL_SAFEGUARDS'
  | 'EXPLICIT_CONSENT'
  | 'OTHER_DOCUMENTED_SAFEGUARD'
  | 'UNASSESSED';

export interface CountryPrivacyRequirements {
  policyVersion: string;
  legalFramework: string[];
  requireSensitiveDataAssessment: boolean;
  requireTransferAssessment: boolean;
  requireResidencyConfirmation: boolean;
  requireDpiaForSensitiveData: boolean;
  permittedDataRegions: string[];
}

export interface PrivacyAssessment {
  sensitiveDataHandled: boolean | null;
  crossBorderTransfers: boolean | null;
  transferSafeguard: TransferSafeguard;
  residencyConfirmed: boolean;
  dpiaCompleted: boolean;
  assessedAt?: string;
  assessedBy?: string;
}

export interface PrivacyAssessmentStatus {
  policyVersion: string;
  countryCode: string;
  status: 'READY' | 'BLOCKED';
  processingAllowed: boolean;
  trainingAllowed: boolean;
  integrationsAllowed: boolean;
  blockers: string[];
  evaluatedAt: string;
}

export const DEFAULT_PRIVACY_ASSESSMENT: PrivacyAssessment = {
  sensitiveDataHandled: null,
  crossBorderTransfers: null,
  transferSafeguard: 'UNASSESSED',
  residencyConfirmed: false,
  dpiaCompleted: false,
};

const KE_PRIVACY_REQUIREMENTS: CountryPrivacyRequirements = {
  policyVersion: 'KE-DPA-2019-2026.1',
  legalFramework: [
    'Data Protection Act, 2019',
    'Data Protection (General) Regulations, 2021',
  ],
  requireSensitiveDataAssessment: true,
  requireTransferAssessment: true,
  requireResidencyConfirmation: true,
  requireDpiaForSensitiveData: true,
  permittedDataRegions: ['af-south-1'],
};

const DEFAULT_PRIVACY_REQUIREMENTS: CountryPrivacyRequirements = {
  policyVersion: 'GLOBAL-2026.1',
  legalFramework: [],
  requireSensitiveDataAssessment: false,
  requireTransferAssessment: false,
  requireResidencyConfirmation: false,
  requireDpiaForSensitiveData: false,
  permittedDataRegions: [],
};

export function getCountryPrivacyRequirements(
  countryCode: string,
): CountryPrivacyRequirements {
  return countryCode.toUpperCase() === 'KE'
    ? KE_PRIVACY_REQUIREMENTS
    : DEFAULT_PRIVACY_REQUIREMENTS;
}

export function normalizePrivacyAssessment(raw: unknown): PrivacyAssessment {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_PRIVACY_ASSESSMENT };
  }

  const value = raw as Partial<PrivacyAssessment>;
  const safeguard: TransferSafeguard =
    value.transferSafeguard === 'NOT_APPLICABLE' ||
    value.transferSafeguard === 'ADEQUACY_DECISION' ||
    value.transferSafeguard === 'CONTRACTUAL_SAFEGUARDS' ||
    value.transferSafeguard === 'EXPLICIT_CONSENT' ||
    value.transferSafeguard === 'OTHER_DOCUMENTED_SAFEGUARD'
      ? value.transferSafeguard
      : 'UNASSESSED';

  const normalized: PrivacyAssessment = {
    sensitiveDataHandled:
      typeof value.sensitiveDataHandled === 'boolean'
        ? value.sensitiveDataHandled
        : null,
    crossBorderTransfers:
      typeof value.crossBorderTransfers === 'boolean'
        ? value.crossBorderTransfers
        : null,
    transferSafeguard: safeguard,
    residencyConfirmed: value.residencyConfirmed === true,
    dpiaCompleted: value.dpiaCompleted === true,
  };
  if (typeof value.assessedAt === 'string') {
    normalized.assessedAt = value.assessedAt;
  }
  if (typeof value.assessedBy === 'string') {
    normalized.assessedBy = value.assessedBy;
  }
  return normalized;
}

export function evaluatePrivacyAssessment(params: {
  countryCode: string;
  dataRegion?: string | null;
  assessment: PrivacyAssessment;
  allowTrainingOptIn?: boolean;
}): PrivacyAssessmentStatus {
  const countryCode = params.countryCode.toUpperCase();
  const requirements = getCountryPrivacyRequirements(countryCode);
  const blockers: string[] = [];

  if (
    requirements.requireSensitiveDataAssessment &&
    params.assessment.sensitiveDataHandled === null
  ) {
    blockers.push('SENSITIVE_DATA_UNASSESSED');
  }
  if (
    requirements.requireDpiaForSensitiveData &&
    params.assessment.sensitiveDataHandled === true &&
    !params.assessment.dpiaCompleted
  ) {
    blockers.push('SENSITIVE_DATA_DPIA_REQUIRED');
  }
  if (
    requirements.requireTransferAssessment &&
    params.assessment.crossBorderTransfers === null
  ) {
    blockers.push('TRANSFER_UNASSESSED');
  }
  if (
    requirements.requireTransferAssessment &&
    params.assessment.crossBorderTransfers === true &&
    (params.assessment.transferSafeguard === 'UNASSESSED' ||
      params.assessment.transferSafeguard === 'NOT_APPLICABLE')
  ) {
    blockers.push('TRANSFER_SAFEGUARD_REQUIRED');
  }
  if (
    requirements.requireTransferAssessment &&
    params.assessment.crossBorderTransfers === false &&
    params.assessment.transferSafeguard !== 'NOT_APPLICABLE'
  ) {
    blockers.push('TRANSFER_ASSESSMENT_INCONSISTENT');
  }
  if (
    requirements.requireResidencyConfirmation &&
    !params.assessment.residencyConfirmed
  ) {
    blockers.push('RESIDENCY_UNCONFIRMED');
  }
  if (
    requirements.permittedDataRegions.length > 0 &&
    (!params.dataRegion ||
      !requirements.permittedDataRegions.includes(params.dataRegion))
  ) {
    blockers.push('DATA_REGION_NOT_PERMITTED');
  }

  const processingAllowed = blockers.length === 0;
  return {
    policyVersion: requirements.policyVersion,
    countryCode,
    status: processingAllowed ? 'READY' : 'BLOCKED',
    processingAllowed,
    trainingAllowed: processingAllowed && params.allowTrainingOptIn !== false,
    integrationsAllowed: processingAllowed,
    blockers,
    evaluatedAt: new Date().toISOString(),
  };
}
