import { describe, expect, it } from "vitest"
import { PHONE_COUNTRIES, orderPhoneCountries } from "./phone"

describe("orderPhoneCountries", () => {
  it("puts the preferred ISO code first", () => {
    const ordered = orderPhoneCountries(PHONE_COUNTRIES, "KE")
    expect(ordered[0]?.iso2).toBe("KE")
    expect(ordered).toHaveLength(PHONE_COUNTRIES.length)
  })

  it("leaves order unchanged when preferred code is missing", () => {
    const ordered = orderPhoneCountries(PHONE_COUNTRIES, "ZZ")
    expect(ordered[0]?.iso2).toBe(PHONE_COUNTRIES[0]?.iso2)
  })

  it("leaves order unchanged when preferred code is empty", () => {
    expect(orderPhoneCountries(PHONE_COUNTRIES, null)).toEqual(PHONE_COUNTRIES)
    expect(orderPhoneCountries(PHONE_COUNTRIES, "")).toEqual(PHONE_COUNTRIES)
  })

  it("does not duplicate the preferred country", () => {
    const ordered = orderPhoneCountries(PHONE_COUNTRIES, "IN")
    expect(ordered.filter((c) => c.iso2 === "IN")).toHaveLength(1)
  })
})
