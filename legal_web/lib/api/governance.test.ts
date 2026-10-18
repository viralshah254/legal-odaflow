import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from "./client"
import {
  getGovernanceSettings,
  updateGovernanceSettings,
  type PrivacyAssessment,
} from "./governance"

const assessment: PrivacyAssessment = {
  sensitiveDataHandled: false,
  crossBorderTransfers: false,
  transferSafeguard: "NOT_APPLICABLE",
  residencyConfirmed: true,
  dpiaCompleted: false,
}

describe("governance privacy API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue({})
  })

  it("loads settings through the tenant-scoped governance endpoint", async () => {
    await getGovernanceSettings("tenant-1")
    expect(apiFetch).toHaveBeenCalledWith("/governance/settings", {
      tenantId: "tenant-1",
    })
  })

  it("persists auditable privacy assessment fields", async () => {
    await updateGovernanceSettings("tenant-1", { privacyAssessment: assessment })
    expect(apiFetch).toHaveBeenCalledWith("/governance/settings", {
      method: "PATCH",
      tenantId: "tenant-1",
      body: { privacyAssessment: assessment },
    })
  })
})
