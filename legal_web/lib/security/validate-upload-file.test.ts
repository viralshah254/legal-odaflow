import { describe, expect, it } from "vitest"
import { validateUploadFile } from "./validate-upload-file"

function makeFile(bytes: number[], name: string, type?: string): File {
  return new File([Uint8Array.from(bytes)], name, {
    type: type ?? "application/octet-stream",
  })
}

describe("validateUploadFile", () => {
  it("accepts a valid PDF for document profile", async () => {
    const file = makeFile(
      [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34],
      "contract.pdf",
      "application/pdf",
    )
    await expect(validateUploadFile(file, "document")).resolves.toBeUndefined()
  })

  it("rejects an executable renamed to .pdf", async () => {
    const file = makeFile(
      [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00],
      "malware.pdf",
      "application/pdf",
    )
    await expect(validateUploadFile(file, "document")).rejects.toThrow(
      /does not match/i,
    )
  })

  it("rejects oversize files", async () => {
    const file = makeFile([0x25, 0x50, 0x44, 0x46], "big.pdf", "application/pdf")
    Object.defineProperty(file, "size", { value: 51 * 1024 * 1024 })
    await expect(validateUploadFile(file, "document")).rejects.toThrow(/size limit/i)
  })

  it("accepts valid webm for meeting audio", async () => {
    const bytes = [
      0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]
    const file = makeFile(bytes, "recording.webm", "video/webm")
    await expect(validateUploadFile(file, "meetingAudio")).resolves.toBeUndefined()
  })

  it("accepts plain text FIR uploads without magic bytes", async () => {
    const file = new File(["Sample FIR text"], "fir.txt", { type: "text/plain" })
    await expect(validateUploadFile(file, "firDocument")).resolves.toBeUndefined()
  })

  it("accepts generated Markdown research documents", async () => {
    const file = new File(["# Legal research\n\nMemo"], "research.md", {
      type: "text/markdown",
    })
    await expect(validateUploadFile(file, "document")).resolves.toBeUndefined()
  })
})
