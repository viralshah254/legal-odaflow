import { describe, expect, it, vi } from "vitest"
import { ApiClientError } from "@/lib/api/client"
import { CLOUDFLARE_CHALLENGE_ERROR } from "@/lib/api/cloudflare-challenge"
import { withIntakeSaveRetry } from "./firm-intake-save"

describe("withIntakeSaveRetry", () => {
  it("retries a Cloudflare drop once, then succeeds", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new ApiClientError(CLOUDFLARE_CHALLENGE_ERROR, 403, { challenge: true }))
      .mockResolvedValueOnce({ leadId: "lead-1" })

    await expect(withIntakeSaveRetry(run, { delayMs: 0 })).resolves.toEqual({ leadId: "lead-1" })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("does not retry a real server failure", async () => {
    const run = vi.fn().mockRejectedValue(new ApiClientError("Internal Server Error", 500))
    await expect(withIntakeSaveRetry(run, { delayMs: 10 })).rejects.toThrow("Internal Server Error")
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("reloads an existing lead instead of creating a duplicate", async () => {
    const run = vi
      .fn()
      .mockRejectedValue(new ApiClientError(CLOUDFLARE_CHALLENGE_ERROR, 403, { challenge: true }))
    const recover = vi.fn().mockResolvedValue({ leadId: "lead-existing" })
    await expect(withIntakeSaveRetry(run, { delayMs: 0, recover })).resolves.toEqual({
      leadId: "lead-existing",
    })
    expect(run).toHaveBeenCalledTimes(1)
    expect(recover).toHaveBeenCalledTimes(1)
  })
})
