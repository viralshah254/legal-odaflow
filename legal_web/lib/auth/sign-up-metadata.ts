export type AccountType = "CONSUMER" | "LAWYER"
export type PracticeType = "SOLO" | "FIRM"

export interface SignUpMetadata {
  accountType: AccountType
  practiceType: PracticeType
  firmName?: string
  name?: string
  countryCode: string
  jurisdiction?: string
}

export function resolveFirmName(
  data: Pick<SignUpMetadata, "accountType" | "practiceType" | "firmName" | "name">,
  defaultPracticeName: string,
): string | undefined {
  if (data.accountType !== "LAWYER") return undefined
  if (data.practiceType === "SOLO") {
    return data.firmName?.trim() || data.name?.trim() || defaultPracticeName
  }
  return data.firmName
}

export function validateSignUpMetadata(
  data: Pick<SignUpMetadata, "accountType" | "practiceType" | "firmName" | "countryCode">,
  messages: {
    confirmCountry: string
    firmNameRequired: string
  },
): string | null {
  if (!data.countryCode || data.countryCode.length < 2) {
    return messages.confirmCountry
  }
  if (
    data.accountType === "LAWYER" &&
    data.practiceType === "FIRM" &&
    (!data.firmName || data.firmName.trim().length < 2)
  ) {
    return messages.firmNameRequired
  }
  return null
}
