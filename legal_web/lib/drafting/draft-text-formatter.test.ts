import { describe, expect, it } from "vitest"
import {
  countBlanksInDraft,
  extractBlankLabelsFromDraft,
  isFillableBlankLabel,
  normalizeDraftForBlanks,
  parseInlineTokens,
} from "./draft-text-formatter"

describe("draft-text-formatter blanks", () => {
  it("detects blanks wrapped in markdown bold (cause title)", () => {
    const line = "**IN THE COURT OF [BLANK: designation of Court]**"
    const tokens = parseInlineTokens(line)
    expect(tokens.some((t) => t.type === "blank" && t.label === "BLANK: designation of Court")).toBe(
      true,
    )
  })

  it("counts court header blanks after bold unwrap", () => {
    const draft = [
      "**IN THE COURT OF [BLANK: designation of Court]**",
      "AT **[BLANK: seat of Court]**",
      "CRIMINAL MISC. APPLICATION NO. [BLANK: application number] OF [BLANK: year]",
    ].join("\n")
    expect(countBlanksInDraft(draft)).toBe(4)
    expect(extractBlankLabelsFromDraft(draft)).toEqual([
      "BLANK: designation of Court",
      "BLANK: seat of Court",
      "BLANK: application number",
      "BLANK: year",
    ])
  })

  it("normalizes bold-wrapped blanks in full draft", () => {
    const raw = "**IN THE COURT OF [BLANK: designation of Court]**"
    expect(normalizeDraftForBlanks(raw)).toBe("IN THE COURT OF [BLANK: designation of Court]")
  })

  it("still parses plain blanks in verification paras", () => {
    const line =
      "Solemnly affirmed at [BLANK: place of verification] on [BLANK: date of verification]."
    const tokens = parseInlineTokens(line)
    const blanks = tokens.filter((t) => t.type === "blank")
    expect(blanks).toHaveLength(2)
  })

  it("does not treat curated source IDs as blanks", () => {
    const line =
      "held in [curated__prasanta_kumar_sarkar_v_ashis_chatterjee_2010] and [SOURCE_1]."
    expect(countBlanksInDraft(line)).toBe(0)
    expect(extractBlankLabelsFromDraft(line)).toEqual([])
    const tokens = parseInlineTokens(line)
    expect(tokens.some((t) => t.type === "blank")).toBe(false)
    expect(tokens.some((t) => t.type === "text" && t.value.includes("curated__"))).toBe(true)
  })

  it("still counts factual BLANK placeholders alongside citation IDs", () => {
    const draft =
      "FIR at [BLANK: police station]. Authority: [curated__arnesh_kumar_v_state_bihar_2014]."
    expect(extractBlankLabelsFromDraft(draft)).toEqual(["BLANK: police station"])
  })

  it("classifies AUTHORITY TO BE ADDED as non-fillable", () => {
    expect(isFillableBlankLabel("AUTHORITY TO BE ADDED")).toBe(false)
    expect(
      isFillableBlankLabel("AUTHORITY TO BE ADDED — counsel to supply verified citation"),
    ).toBe(false)
    expect(isFillableBlankLabel("BLANK: police station")).toBe(true)
  })
})
