"use client"

import { LegalIssueCheckerWizard } from "@/components/issue-checker/legal-issue-checker-wizard"

// All users reaching /app/intake are authenticated firm/lawyer users.
// Lock to FIRM_INTAKE so the "Who is this for?" role-picker step is skipped.
export default function IntakePage() {
  return (
    <div data-tour="intake-wizard">
      <LegalIssueCheckerWizard layout="app" lockedMode="FIRM_INTAKE" />
    </div>
  )
}
