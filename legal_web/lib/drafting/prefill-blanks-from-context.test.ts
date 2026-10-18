import { describe, expect, it } from "vitest"
import {
  prefillBlanksFromContext,
  resolveBlankValueFromContext,
} from "./prefill-blanks-from-context"
import { initDraftFillState } from "./draft-text-formatter"
import { resolveDraftFieldHintContext } from "@/lib/india-drafting/extract-field-hints"

const BAIL_FACTS = `
Case: State v. Rohan Mehta
Jurisdiction: Ahmedabad, Gujarat, India.
Accused: Rohan Mehta, aged 31 years.
FIR No. 42/2026 dated 10 January 2026 at Police Station Navrangpura.
Arrested on 19 February 2026 under sections 318, 336 BNS.
Seek regular bail under BNSS §480.
`.trim()

describe("prefillBlanksFromContext", () => {
  it("resolves party and court labels from form fields", () => {
    expect(
      resolveBlankValueFromContext("BLANK: accused name", {
        caseDetails: "",
        clientName: "Rohan Mehta",
        opposingParty: "State of Gujarat",
        courtName: "Sessions Court, Ahmedabad",
      }),
    ).toBe("Rohan Mehta")

    expect(
      resolveBlankValueFromContext("BLANK: Complainant / State", {
        caseDetails: "",
        opposingParty: "State of Gujarat",
      }),
    ).toBe("State of Gujarat")

    expect(
      resolveBlankValueFromContext("BLANK: designation of Court", {
        caseDetails: "",
        courtName: "Sessions Court, Ahmedabad",
      }),
    ).toBe("Sessions Court, Ahmedabad")
  })

  it("extracts FIR / PS / arrest from case details", () => {
    const ctx = {
      caseDetails: BAIL_FACTS,
      hintContext: resolveDraftFieldHintContext(
        "india_regular_bail_bnss_480",
        "Bail",
      ),
    }
    expect(resolveBlankValueFromContext("BLANK: FIR No", ctx)).toMatch(/42/)
    expect(resolveBlankValueFromContext("BLANK: police station", ctx)).toMatch(
      /Navrangpura/i,
    )
    expect(resolveBlankValueFromContext("BLANK: arrest date", ctx)).toMatch(
      /19 February 2026/i,
    )
  })

  it("prefills empty slots in draft order without overwriting", () => {
    const draft = [
      "IN THE COURT OF [BLANK: designation of Court]",
      "Applicant–Accused: [BLANK: accused name]",
      "Versus [BLANK: Complainant / State]",
      "FIR No. [BLANK: FIR No] at [BLANK: police station]",
    ].join("\n")

    const { draft: normalized, blanks } = initDraftFillState(draft)
    blanks[0] = "Already set"

    const filled = prefillBlanksFromContext(normalized, blanks, {
      caseDetails: BAIL_FACTS,
      clientName: "Rohan Mehta",
      opposingParty: "State of Gujarat",
      courtName: "Sessions Court, Ahmedabad",
      hintContext: resolveDraftFieldHintContext(
        "india_regular_bail_bnss_480",
        "Bail",
      ),
    })

    expect(filled[0]).toBe("Already set")
    expect(filled[1]).toBe("Rohan Mehta")
    expect(filled[2]).toBe("State of Gujarat")
    expect(filled[3]).toMatch(/42/)
    expect(filled[4]).toMatch(/Navrangpura/i)
  })
})
