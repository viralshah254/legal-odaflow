import type { JurisdictionForm } from "@/lib/api/legal-forms"
import { appendReturnTo } from "@/lib/drafting/draft-navigation"
import { INDIA_DRAFT_FORMATS } from "@/lib/india-drafting/formats"
import { legalFormsPracticeAreaSlugs } from "@/lib/taxonomy/platform-taxonomy"

/** Map catalog form codes / reference numbers to curated India drafting kinds. */
const IN_REFERENCE_KIND: Record<string, string> = {
  "MCA-DIR-12": "india_mca_dir12_appointment",
  "MCA-MGT-7": "india_mca_mgt7_annual_return",
  "MCA-AOC-4": "india_mca_aoc4_financials",
  "NCLT-CIRP": "india_nclt_cirp_real_estate",
  "NCLT-IBC-7": "india_nclt_cirp_real_estate",
  "DRT-OA": "india_drt_oa",
  "GST-REG-01": "india_gst_registration_application",
  "BAIL-APP": "india_regular_bail_bnss_480",
  "QUASHING-PET": "india_quashing_petition_bnss_528",
  "WRIT-PET-A226": "india_writ_petition_hc",
  "SLP-SC": "india_slp_draft",
  "RENT-PETITION": "india_eviction_suit",
  "STAMP-ADJ": "india_stamp_duty_adjudication",
  "SEBI-LODR": "india_sebi_lodr_disclosure",
}

const IN_TEMPLATE_SUFFIX_KIND: Record<string, string> = {
  BAIL: "india_regular_bail_bnss_480",
  "CIV-SUIT": "india_civil_suit_money_recovery",
  RENT: "india_eviction_suit",
  "CRIM-CMP": "india_fir_complaint",
  "WRIT-226": "india_writ_petition_hc",
  SLP: "india_slp_draft",
  "GST-REG": "india_gst_registration_application",
  STAMP: "india_stamp_duty_adjudication",
  "REG-DEED": "india_sale_deed",
  "NCLT-APP": "india_nclt_cirp_real_estate",
  "DRT-OA": "india_drt_oa",
  MAINT: "india_maintenance_application_bnss_144",
  CONSUMER: "india_consumer_complaint",
  RTI: "india_rti_application",
  MACT: "india_mact_claim_petition",
  ARBT: "india_arbitration_notice_s21",
}

const INDIA_KIND_IDS = new Set(INDIA_DRAFT_FORMATS.map((f) => f.id))

function resolveIndiaDraftKind(form: JurisdictionForm): string {
  const num = form.formNumber ?? ""
  if (IN_REFERENCE_KIND[num]) return IN_REFERENCE_KIND[num]

  const templateMatch = num.match(/^IN-[A-Z]{2,3}-([A-Z0-9-]+)$/)
  if (templateMatch?.[1] && IN_TEMPLATE_SUFFIX_KIND[templateMatch[1]]) {
    return IN_TEMPLATE_SUFFIX_KIND[templateMatch[1]]
  }

  const slug = num.toLowerCase().replace(/[^a-z0-9]+/g, "_")
  if (slug.startsWith("india_") && INDIA_KIND_IDS.has(slug)) return slug

  const name = form.formName.toLowerCase()
  if (name.includes("bail")) return "india_regular_bail_bnss_480"
  if (name.includes("writ")) return "india_writ_petition_hc"
  if (name.includes("quashing")) return "india_quashing_petition_bnss_528"
  if (name.includes("consumer")) return "india_consumer_complaint"
  if (name.includes("arbitration")) return "india_arbitration_notice_s21"
  if (name.includes("rent") || name.includes("eviction")) return "india_eviction_suit"
  if (name.includes("probate")) return "india_probate_petition"
  if (name.includes("divorce") || name.includes("maintenance")) return "india_maintenance_application_bnss_144"

  return "india_form_catalog"
}

export function legalFormDraftLink(form: JurisdictionForm): string | null {
  if (form.countryCode === "IN") {
    const kind = resolveIndiaDraftKind(form)
    const params = new URLSearchParams({
      kind,
      label: form.formName,
      subtitle: form.authority,
    })
    if (kind === "india_form_catalog") {
      if (form.formNumber) params.set("formNumber", form.formNumber)
      params.set("formTitle", form.formName)
      params.set("authority", form.authority)
      if (form.jurisdiction) params.set("jurisdiction", form.jurisdiction)
      if (form.practiceArea) params.set("practiceArea", form.practiceArea)
    }
    return appendReturnTo(`/app/india-drafting/draft?${params.toString()}`)
  }

  if (form.countryCode === "US" || form.countryCode === "GB" || form.countryCode === "KE") {
    const params = new URLSearchParams({
      kind: "us_form_catalog",
      label: form.formName,
      subtitle: form.formNumber ?? form.authority,
      jurisdiction: form.countryCode === "US" ? "Federal" : form.countryCode,
      requiresState: "false",
    })
    if (form.formNumber) params.set("formNumber", form.formNumber)
    if (form.jurisdiction && form.countryCode === "US") {
      params.set("stateCode", form.jurisdiction)
      params.set("requiresState", "true")
      params.set("boundState", form.jurisdiction)
    }
    params.set("formTitle", form.formName)
    params.set("formCountry", form.countryCode)
    return appendReturnTo(`/app/us-drafting/draft?${params.toString()}`)
  }

  return null
}

export const LEGAL_FORMS_COUNTRY_OPTIONS = [
  { code: "ALL", label: "All countries" },
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "KE", label: "Kenya" },
] as const

export const LEGAL_FORMS_PRACTICE_AREAS = legalFormsPracticeAreaSlugs() as readonly string[]
