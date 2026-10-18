import { digitsOnly, getPhoneCountry, normalizePhone, validatePhone } from "@/lib/phone"

export type SignUpPhoneError = "required" | "invalid"

export function resolveSignUpPhone(
  phoneCountryCode: string,
  phoneNational: string,
): { phone: string } | { error: SignUpPhoneError } {
  if (!digitsOnly(phoneNational)) {
    return { error: "required" }
  }
  const country = getPhoneCountry(phoneCountryCode)
  if (!validatePhone(country, phoneNational)) {
    return { error: "invalid" }
  }
  const phone = normalizePhone(country.dialCode, phoneNational)
  if (!phone) {
    return { error: "required" }
  }
  return { phone }
}
