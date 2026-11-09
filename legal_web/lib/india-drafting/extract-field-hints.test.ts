import { describe, expect, it } from "vitest"
import {
  extractDraftFieldHints,
  resolveDraftFieldHintContext,
} from "./extract-field-hints"

const KAVITA = `
Mrs. Kavita Shah agreed to purchase a residential plot from Mr. Rakesh Mehta for ₹45 lakhs.
An Agreement to Sell was executed on 10 March 2024.
Kavita paid ₹20 lakhs as advance.
Before execution of the sale deed, Rakesh sold the property to a third party.
`.trim()

const ROHIT_PRIYA = `
Mr. Rohit Sharma is the owner of a commercial shop in Ahmedabad.
On 1 February 2024, Mr. Rohit Sharma and Mrs. Priya Mehta entered into an Agreement to Sell.
Mrs. Priya Mehta agreed to purchase the shop for ₹80,00,000 and paid ₹5,00,000 as advance.
Mr. Rohit Sharma sold the shop to a third party before the sale deed could be executed.
Client seeks specific performance or refund of advance.
`.trim()

describe("extractDraftFieldHints", () => {
  it("extracts buyer and seller from agreement-to-sell narrative", () => {
    const hints = extractDraftFieldHints(KAVITA)
    expect(hints.clientName).toBe("Mrs. Kavita Shah")
    expect(hints.opposingParty).toBe("Mr. Rakesh Mehta")
    expect(hints.courtName).toBeUndefined()
  })

  it("extracts parties from vs pattern", () => {
    const hints = extractDraftFieldHints("Ram vs Ria maintenance appeal Gujarat HC")
    expect(hints.clientName).toBe("Ram")
    expect(hints.opposingParty).toBe("Ria")
  })

  it("extracts seller/owner and purchaser from specific-performance narrative", () => {
    const hints = extractDraftFieldHints(ROHIT_PRIYA)
    expect(hints.clientName).toBe("Mr. Rohit Sharma")
    expect(hints.opposingParty).toBe("Mrs. Priya Mehta")
    expect(hints.courtName).toBe("District Court, Ahmedabad")
  })

  it("extracts Ms S / Mr K from sparse stalking complaint narrative", () => {
    const hints = extractDraftFieldHints(`
Mr k and ms s are neighbours
Mr k stalks ms s
Ms s wants to file a complaint against mr k
`.trim())
    expect(hints.clientName?.toLowerCase()).toContain("s")
    expect(hints.opposingParty?.toLowerCase()).toContain("k")
    expect(hints.clientName).toMatch(/Ms\.?\s*S/i)
    expect(hints.opposingParty).toMatch(/Mr\.?\s*K/i)
    expect(hints.courtName).toBeUndefined()
  })

  it("maps State v. accused to defence roles for bail applications", () => {
    const facts = `
Case: State v. Rohan Mehta

Jurisdiction
Ahmedabad, Gujarat, India.

Parties
Accused: Rohan Mehta, aged 31 years, software engineer, residing at Navrangpura, Ahmedabad.
Seek regular bail under BNSS §480.
`.trim()

    const hints = extractDraftFieldHints(
      facts,
      resolveDraftFieldHintContext("india_regular_bail_bnss_480", "Bail"),
    )

    expect(hints.clientName).toBe("Rohan Mehta")
    expect(hints.opposingParty).toBe("State of Gujarat")
    expect(hints.courtName).toBe("Sessions Court, Ahmedabad")
  })

  it("still treats plaintiff as client in civil vs captions", () => {
    const hints = extractDraftFieldHints(
      "Ram vs Ria maintenance appeal Gujarat HC",
      resolveDraftFieldHintContext("india_maintenance_petition", "Family"),
    )
    expect(hints.clientName).toBe("Ram")
    expect(hints.opposingParty).toBe("Ria")
  })

  it("extracts labeled Plaintiff and multiple Defendants into structured parties", () => {
    const facts = `
Parties
Plaintiff: Meera Shah, aged 38 years, architect, residing at Satellite, Ahmedabad.
Defendant No. 1: Arjun Patel, aged 46 years, businessman, residing at Bodakdev, Ahmedabad. He signed the agreement to sell.
Defendant No. 2: Nisha Patel, aged 42 years, wife of Arjun Patel, residing at the same address. She is a joint owner.
Background
Meera Shah agreed to purchase Plot No. 14 from the defendants. He offered to refund the earnest money.
Ahmedabad, Gujarat.
`.trim()

    const hints = extractDraftFieldHints(
      facts,
      resolveDraftFieldHintContext("india_civil_plaint", "Civil"),
    )

    expect(hints.clientName).toBe("Meera Shah")
    expect(hints.opposingParty).toBe("Arjun Patel; Nisha Patel")
    expect(hints.opposingParty).not.toMatch(/Offered|Refund/i)
    expect(hints.parties?.plaintiffs).toEqual([
      { name: "Meera Shah", role: "plaintiff" },
    ])
    expect(hints.parties?.defendants).toEqual([
      { name: "Arjun Patel", role: "defendant" },
      { name: "Nisha Patel", role: "defendant" },
    ])
    expect(hints.courtName).toBe("District Court, Ahmedabad")
  })

  it("rejects garbage honorific narrative as opposing party", () => {
    const hints = extractDraftFieldHints(
      `Ms he offered to refund the advance. Defendant agreed to purchase from seller.`,
      resolveDraftFieldHintContext("india_civil_plaint", "Civil"),
    )
    expect(hints.opposingParty ?? "").not.toMatch(/Offered|Refund/i)
    expect(hints.clientName ?? "").not.toMatch(/Offered|Refund/i)
  })

  it("extracts Plaintiff residing-at format without requiring comma before aged", () => {
    const hints = extractDraftFieldHints(
      `Plaintiff: Meera Shah residing at Bungalow No. 17, Green Park Society, Bodakdev, Ahmedabad.
Defendant No. 1: Arjun Patel residing at the same society.
Defendant No. 2: Nisha Patel.`,
      resolveDraftFieldHintContext("india_civil_plaint", "Civil"),
    )
    expect(hints.clientName).toBe("Meera Shah")
    expect(hints.opposingParty).toBe("Arjun Patel; Nisha Patel")
    expect(hints.parties?.defendants).toHaveLength(2)
  })

  it("extracts between X and Y for agreement to sell narrative", () => {
    const hints = extractDraftFieldHints(
      `Agreement to sell dated 12 January 2024 between Meera Shah and Arjun Patel for Plot No. 14, Ahmedabad.`,
      resolveDraftFieldHintContext("india_civil_plaint", "Civil"),
    )
    expect(hints.clientName).toBe("Meera Shah")
    expect(hints.opposingParty).toBe("Arjun Patel")
  })

  it("extracts complainant and opposite parties for medical-negligence consumer complaint", () => {
    const facts = `
Jurisdiction: Ahmedabad, Gujarat, India.
Complainant: Riya Desai, aged 32 years, software engineer, residing at Navrangpura, Ahmedabad.
Opposite Party No. 1: Sunrise Multispeciality Hospital Pvt. Ltd., Ahmedabad.
Opposite Party No. 2: Dr. Mahesh Trivedi, consultant general surgeon.
Opposite Party No. 3: Dr. Kavita Rao, consultant anaesthesiologist.
Opposite Party No. 4: SecureCare Health Insurance Ltd.
A CT scan was performed on 13 March 2025.
`.trim()

    const hints = extractDraftFieldHints(
      facts,
      resolveDraftFieldHintContext("india_consumer_complaint", "Consumer"),
    )

    expect(hints.clientName).toBe("Riya Desai")
    expect(hints.opposingParty).toContain("Sunrise Multispeciality Hospital Pvt. Ltd")
    expect(hints.opposingParty).toContain("Dr. Mahesh Trivedi")
    expect(hints.opposingParty).toContain("Dr. Kavita Rao")
    expect(hints.opposingParty).toContain("SecureCare Health Insurance Ltd")
    expect(hints.parties?.plaintiffs).toEqual([
      { name: "Riya Desai", role: "complainant" },
    ])
    expect(hints.parties?.defendants).toHaveLength(4)
    expect(hints.courtName).toBe(
      "District Consumer Disputes Redressal Commission, Ahmedabad",
    )
    expect(hints.courtName?.toLowerCase()).not.toContain("scan")
  })

  it("infers consumer forum for Research memo kinds on consumer-complaint facts", () => {
    const facts = `
Jurisdiction: Ahmedabad, Gujarat, India.
Complainant: Riya Desai, aged 32 years, software engineer, residing at Navrangpura, Ahmedabad.
Opposite Party No. 1: Sunrise Multispeciality Hospital Pvt. Ltd., Ahmedabad.
Opposite Party No. 2: Dr. Mahesh Trivedi, consultant general surgeon.
Opposite Party No. 3: Dr. Kavita Rao, consultant anaesthesiologist.
Opposite Party No. 4: SecureCare Health Insurance Ltd.
Prepare a consumer complaint under the Consumer Protection Act.
A CT scan was performed on 13 March 2025.
`.trim()

    const hints = extractDraftFieldHints(
      facts,
      resolveDraftFieldHintContext("india_legal_research_memo", "Research"),
    )

    expect(hints.clientName).toBe("Riya Desai")
    expect(hints.opposingParty).toContain("Sunrise Multispeciality Hospital Pvt. Ltd")
    expect(hints.parties?.defendants).toHaveLength(4)
    expect(hints.courtName).toBe(
      "District Consumer Disputes Redressal Commission, Ahmedabad",
    )
    expect(hints.courtName?.toLowerCase()).not.toContain("scan")
  })

  it("never treats CT scan prose as a court name", () => {
    const hints = extractDraftFieldHints(
      `A CT scan was performed on 13 March 2025. Jurisdiction\nAhmedabad.`,
      resolveDraftFieldHintContext("india_legal_research_memo", "Research"),
    )
    expect(hints.courtName?.toLowerCase() ?? "").not.toContain("scan")
    expect(hints.courtName?.toLowerCase() ?? "").not.toMatch(/was performed/)
  })

  it("does not swallow Facts heading into opposite party name", () => {
    const hints = extractDraftFieldHints(
      `Complainant: Riya Desai, aged 32.
Opposite Party No. 4: SecureCare Health Insurance Ltd.

Facts
Riya experienced pain.`,
      resolveDraftFieldHintContext("india_consumer_complaint", "Consumer"),
    )
    expect(hints.opposingParty).toBe("SecureCare Health Insurance Ltd")
    expect(hints.opposingParty).not.toMatch(/Facts/i)
  })
})
