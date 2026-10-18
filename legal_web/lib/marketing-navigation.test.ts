import { describe, expect, it } from "vitest"
import { marketingContent } from "@/content/marketing"

describe("marketing navigation", () => {
  it("keeps lawyer and law-firm audiences on distinct routes", () => {
    const solutions = marketingContent.navigation.groups.find((group) => group.label === "Solutions")
    const lawyers = solutions?.items.find((item) => item.label === "For lawyers")
    const firms = solutions?.items.find((item) => item.label === "For law firms")

    expect(lawyers?.href).toBe("/for-lawyers")
    expect(firms?.href).toBe("/for-law-firms")
    expect(lawyers?.href).not.toBe(firms?.href)
  })

  it("exposes the complete resources menu", () => {
    const resources = marketingContent.navigation.groups.find((group) => group.label === "Resources")

    expect(resources?.items.map((item) => item.href)).toEqual([
      "/legal-guides",
      "/solutions",
      "/compare",
      "/developers",
      "/trust",
    ])
  })

  it("links Security directly to the trust centre", () => {
    expect(marketingContent.navigation.direct).toContainEqual({
      label: "Security",
      href: "/trust",
    })
  })

  it("does not duplicate destinations within a menu", () => {
    for (const group of marketingContent.navigation.groups) {
      const hrefs = group.items.map((item) => item.href)
      expect(new Set(hrefs).size).toBe(hrefs.length)
    }
  })
})
