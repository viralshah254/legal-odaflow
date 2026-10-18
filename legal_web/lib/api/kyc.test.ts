import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from "./client"
import {
  apiKycChecklistToDisplay,
  updateKycDocument,
  type ApiKycDocument,
} from "./kyc"
import { getKycDocStatusLabel } from "@/lib/types/kyc"

const apiDocument: ApiKycDocument = {
  id: "document-1",
  clientId: "client-1",
  docType: "ID_PASSPORT",
  label: "ID / Passport",
  status: "pending",
}

describe("KYC API mapping", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue(apiDocument)
  })

  it("normalizes display status and expiry fields for the API", async () => {
    const expiryDate = new Date("2027-08-15T00:00:00.000Z")

    await updateKycDocument("tenant-1", "client-1", "ID_PASSPORT", {
      status: "RECEIVED",
      expiryDate,
    })

    expect(apiFetch).toHaveBeenCalledWith(
      "/kyc/clients/client-1/documents/ID_PASSPORT",
      {
        method: "PATCH",
        tenantId: "tenant-1",
        body: {
          status: "pending",
          expiresAt: expiryDate.toISOString(),
        },
      },
    )
  })

  it("maps pending API documents to friendly received display status", () => {
    const checklist = apiKycChecklistToDisplay({
      clientId: "client-1",
      overallStatus: "pending",
      documents: [apiDocument],
    })

    expect(checklist.documents[0].status).toBe("RECEIVED")
    expect(getKycDocStatusLabel(checklist.documents[0].status)).toBe("Received")
  })
})
