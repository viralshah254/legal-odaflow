import type { ApiMatter } from "@/lib/api/types"

/** True when matter should use the dedicated document draft workspace. */
export function isDocumentMatter(matter: Pick<ApiMatter, "matterType" | "practiceArea" | "planningAnswers">): boolean {
  if (matter.matterType === "Drafting") return true
  if (matter.practiceArea === "Contract & Document Drafting") return true
  const pa = matter.planningAnswers
  if (pa && typeof pa === "object" && "documentType" in pa && pa.documentType) return true
  return false
}
