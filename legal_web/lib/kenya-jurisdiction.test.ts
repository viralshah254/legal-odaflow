import { describe, expect, it } from "vitest"
import {
  decodeJurisdictionValue,
  encodeJurisdictionValue,
} from "@/lib/geo/jurisdiction-value"

describe("Kenya jurisdiction selection", () => {
  it("round-trips Kenya and a county without falling back to India", () => {
    const encoded = encodeJurisdictionValue("KE", "Nairobi")

    expect(encoded).toBe("KE|Nairobi")
    expect(decodeJurisdictionValue(encoded)).toEqual({
      countryCode: "KE",
      jurisdiction: "Nairobi",
    })
  })
})
