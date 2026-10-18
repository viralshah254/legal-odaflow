import { apiFetch } from "./client"
import type { CountryCode } from "./types"

export interface CountryCompliancePolicy {
  id?: string
  countryCode: CountryCode | string
  countryName: string
  allowConsumerGuidance: boolean
  allowDocumentGeneration: boolean
  allowLawyerMarketplace: boolean
  requireLawyerReviewForAdvice: boolean
  requireDisclaimerOnEveryOutput: boolean
  allowTrainingOptIn: boolean
  requireExplicitTrainingConsent: boolean
  allowAutomatedDecisioning: boolean
  restrictedPhrases?: string[] | null
  approvedProductLabels?: string[] | null
  dataResidencyRequired: boolean
  defaultDataRegion?: string | null
  privacyRequirements?: {
    policyVersion: string
    legalFramework: string[]
    requireSensitiveDataAssessment: boolean
    requireTransferAssessment: boolean
    requireResidencyConfirmation: boolean
    requireDpiaForSensitiveData: boolean
    permittedDataRegions: string[]
  }
  notes?: string | null
}

const FALLBACK_POLICIES: CountryCompliancePolicy[] = [
  {
    countryCode: "IN",
    countryName: "India",
    allowConsumerGuidance: true,
    allowDocumentGeneration: true,
    allowLawyerMarketplace: true,
    requireLawyerReviewForAdvice: true,
    requireDisclaimerOnEveryOutput: true,
    allowTrainingOptIn: true,
    requireExplicitTrainingConsent: true,
    allowAutomatedDecisioning: false,
    dataResidencyRequired: false,
    defaultDataRegion: "ap-south-1",
  },
  {
    countryCode: "US",
    countryName: "United States",
    allowConsumerGuidance: true,
    allowDocumentGeneration: true,
    allowLawyerMarketplace: true,
    requireLawyerReviewForAdvice: true,
    requireDisclaimerOnEveryOutput: true,
    allowTrainingOptIn: true,
    requireExplicitTrainingConsent: true,
    allowAutomatedDecisioning: false,
    dataResidencyRequired: false,
    defaultDataRegion: "us-east-1",
  },
  {
    countryCode: "KE",
    countryName: "Kenya",
    allowConsumerGuidance: true,
    allowDocumentGeneration: true,
    allowLawyerMarketplace: true,
    requireLawyerReviewForAdvice: true,
    requireDisclaimerOnEveryOutput: true,
    allowTrainingOptIn: true,
    requireExplicitTrainingConsent: true,
    allowAutomatedDecisioning: false,
    dataResidencyRequired: true,
    defaultDataRegion: "af-south-1",
    privacyRequirements: {
      policyVersion: "KE-DPA-2019-2026.1",
      legalFramework: [
        "Data Protection Act, 2019",
        "Data Protection (General) Regulations, 2021",
      ],
      requireSensitiveDataAssessment: true,
      requireTransferAssessment: true,
      requireResidencyConfirmation: true,
      requireDpiaForSensitiveData: true,
      permittedDataRegions: ["af-south-1"],
    },
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    allowConsumerGuidance: true,
    allowDocumentGeneration: true,
    allowLawyerMarketplace: true,
    requireLawyerReviewForAdvice: true,
    requireDisclaimerOnEveryOutput: true,
    allowTrainingOptIn: true,
    requireExplicitTrainingConsent: true,
    allowAutomatedDecisioning: false,
    dataResidencyRequired: true,
    defaultDataRegion: "eu-west-2",
  },
]

export async function listCountryCompliancePolicies(): Promise<CountryCompliancePolicy[]> {
  try {
    const rows = await apiFetch<CountryCompliancePolicy[]>("/compliance/countries")
    return rows.length > 0 ? rows : FALLBACK_POLICIES
  } catch {
    return FALLBACK_POLICIES
  }
}

export async function getCountryCompliancePolicy(
  countryCode: string,
): Promise<CountryCompliancePolicy | null> {
  const policies = await listCountryCompliancePolicies()
  return policies.find((p) => p.countryCode === countryCode) ?? null
}
