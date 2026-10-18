import { formatPersonName } from "./format-person-name"

describe("formatPersonName", () => {
  it("title-cases each word and trims whitespace", () => {
    expect(formatPersonName("  priya   patel  ")).toBe("Priya Patel")
  })

  it("preserves already capitalized names", () => {
    expect(formatPersonName("Rohit Sharma")).toBe("Rohit Sharma")
  })
})
