export type LeadNextTool = "retrieve" | "section_finder" | "draft" | "strategy"

export type LeadNextCta = {
  tool: LeadNextTool
  label: string
  href: string
  missingSlot?: string
}

export function resolveLeadNextCta(input: {
  recommendedNextTool?: LeadNextTool | null
  toolPlan?: LeadNextTool[] | null
  missingSlots?: string[] | null
  facts?: string | null
  issueType?: string | null
  countryCode?: string | null
  convertedMatterId?: string | null
}): LeadNextCta {
  const missingSlot = input.missingSlots?.find((slot) => slot.trim())
  const tool =
    input.recommendedNextTool ??
    input.toolPlan?.[0] ??
    (missingSlot ? "retrieve" : "strategy")

  const query = [input.issueType, input.facts].filter(Boolean).join(" — ").slice(0, 400)
  const country = input.countryCode ?? "IN"
  const matterId = input.convertedMatterId

  if (missingSlot && tool !== "draft") {
    return {
      tool,
      missingSlot,
      label: `Complete missing slot: ${missingSlot}`,
      href: "#lead-case-context",
    }
  }

  if (tool === "draft") {
    const params = new URLSearchParams({
      kind: "india_form_catalog",
      label: input.issueType ?? "Draft",
      details: query,
    })
    if (matterId) params.set("matterId", matterId)
    return {
      tool: "draft",
      label: "Draft this vehicle",
      href: `/app/india-drafting/draft?${params.toString()}`,
    }
  }

  const researchParams = new URLSearchParams()
  if (query) researchParams.set("q", query)
  if (country) researchParams.set("country", country)
  if (matterId) researchParams.set("matterId", matterId)

  if (tool === "section_finder") {
    return {
      tool,
      label: "Find governing sections",
      href: `/app/section-finder?${researchParams.toString()}`,
    }
  }

  return {
    tool,
    label: tool === "retrieve" ? "Research this issue" : "Open strategy research",
    href: `/app/research?${researchParams.toString()}`,
  }
}
