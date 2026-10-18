const FULL_REPORT_CREDITS = 20
const ISSUE_CHECK_CREDITS = 1

export function getCreditPackValueHint(credits: number): string {
  if (credits <= 0) return ""

  const fullReports = Math.floor(credits / FULL_REPORT_CREDITS)
  const remainder = credits % FULL_REPORT_CREDITS
  const issueChecks = Math.floor(credits / ISSUE_CHECK_CREDITS)

  if (fullReports >= 2) {
    return `≈ ${issueChecks} issue checks, or ${fullReports} full reports`
  }
  if (fullReports === 1 && remainder > 0) {
    return `≈ ${issueChecks} issue checks, or 1 full report + extras`
  }
  if (fullReports === 1) {
    return `≈ 1 full report (${FULL_REPORT_CREDITS} credits)`
  }
  return `≈ ${issueChecks} issue check${issueChecks === 1 ? "" : "s"} or preview reports`
}
