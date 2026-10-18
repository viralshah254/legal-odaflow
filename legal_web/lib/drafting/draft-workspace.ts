import { parseHeading } from "@/lib/drafting/draft-text-formatter"

export interface DraftOutlineItem {
  id: string
  level: 1 | 2 | 3 | 4
  text: string
}

export interface ReadinessBlocker {
  raw: string
  section: string
  reason: string
  action: string
}

export function getDraftExportAvailability(input: {
  draftText: string
  systemChecksPassed: boolean
  authorityChecksPassed: boolean
  advocateApproved: boolean
}): { canExportReviewCopy: boolean; canExportForFiling: boolean } {
  return {
    canExportReviewCopy: input.draftText.trim().length > 0,
    canExportForFiling:
      input.systemChecksPassed &&
      input.authorityChecksPassed &&
      input.advocateApproved,
  }
}

export function draftHeadingId(text: string, lineIndex: number): string {
  const slug = text
    .replace(/[*_`[\]]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  return `draft-section-${lineIndex}-${slug || "section"}`
}

export function buildDraftOutline(draft: string): DraftOutlineItem[] {
  return draft.split("\n").flatMap((line, lineIndex) => {
    const heading = parseHeading(line)
    if (!heading) return []
    return [{
      id: draftHeadingId(heading.text, lineIndex),
      level: heading.level,
      text: heading.text.replace(/\*\*/g, "").trim(),
    }]
  })
}

function humanize(value: string): string {
  const text = value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ""
}

function labeledPart(value: string, label: string): string | undefined {
  const match = new RegExp(`(?:^|[|;])\\s*${label}\\s*:\\s*([^|;]+)`, "i").exec(value)
  return match?.[1]?.trim()
}

export function parseReadinessBlocker(blocker: string): ReadinessBlocker {
  const section = labeledPart(blocker, "section")
  const reason = labeledPart(blocker, "reason")
  const action = labeledPart(blocker, "action")

  if (section || reason || action) {
    return {
      raw: blocker,
      section: section || "Document-wide",
      reason: reason || humanize(blocker),
      action: action || "Review and resolve this issue",
    }
  }

  const [possibleSection, ...rest] = blocker.split(":")
  const hasSectionPrefix = rest.length > 0 && possibleSection.trim().length <= 48
  const fallbackReason = humanize(hasSectionPrefix ? rest.join(":") : blocker)

  return {
    raw: blocker,
    section: hasSectionPrefix ? humanize(possibleSection) : "Document-wide",
    reason: fallbackReason,
    action: "Review the cited section, correct the issue, then re-run verification",
  }
}
