import { authorizedFetch, getApiBaseUrl, resolveAccessToken } from "@/lib/api/client"
import { localeHeaders } from "@/lib/i18n/api-locale"

/** MediaRecorder slice interval — small slices for smooth capture. */
export const RECORDER_TIMESLICE_MS = 2500

/** S3 multipart minimum part size (except the final part). */
export const UPLOAD_PART_MIN_BYTES = 5 * 1024 * 1024

export interface ChunkedUploadProgress {
  percent: number
  partsUploaded: number
  bytesUploaded: number
  bytesTotal: number
  uploading: boolean
}

type ProgressCallback = (progress: ChunkedUploadProgress) => void

export class ChunkedRecordingUpload {
  private pending: Blob[] = []
  private pendingBytes = 0
  private partNumber = 0
  private uploadChain: Promise<void> = Promise.resolve()
  private bytesUploaded = 0
  private bytesTotal = 0
  private inflight = 0
  private failed = false
  private finalized = false

  constructor(
    private readonly tenantId: string,
    private readonly meetingId: string,
    private readonly mimeType: string,
    private readonly onProgress?: ProgressCallback,
  ) {}

  absorbSlice(blob: Blob): void {
    if (this.failed || this.finalized || blob.size === 0) return
    this.pending.push(blob)
    this.pendingBytes += blob.size
    this.bytesTotal += blob.size
    this.emitProgress()

    if (this.pendingBytes >= UPLOAD_PART_MIN_BYTES) {
      this.uploadChain = this.uploadChain.then(async () => {
        await this.flushPart(false)
      })
    }
  }

  async finalize(
    durationMs: number,
    draftTranscript?: string,
  ): Promise<{ status: string }> {
    this.finalized = true
    await this.uploadChain
    if (this.failed) throw new Error("Chunk upload failed")

    if (this.pendingBytes > 0 || this.partNumber === 0) {
      return this.flushPart(true, durationMs, draftTranscript)
    }

    if (this.partNumber > 0) {
      return this.completeSession(durationMs, draftTranscript)
    }

    throw new Error("No recording data to upload")
  }

  private async completeSession(
    durationMs: number,
    draftTranscript?: string,
  ): Promise<{ status: string }> {
    const response = await authorizedFetch(`/meetings/${this.meetingId}/recording-complete`, {
      method: "POST",
      tenantId: this.tenantId,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationMs,
        draftTranscript,
      }),
    })
    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { message?: string }
      throw new Error(err.message ?? `Complete upload failed (${response.status})`)
    }
    this.emitProgress()
    return (await response.json()) as { status: string }
  }

  private async flushPart(
    isLast: boolean,
    durationMs?: number,
    draftTranscript?: string,
  ): Promise<{ status: string }> {
    if (this.pendingBytes === 0 && !isLast) return { status: "uploading" }

    const blob = new Blob(this.pending, { type: this.mimeType })
    this.pending = []
    this.pendingBytes = 0

    const nextPart = this.partNumber + 1
    const result = await this.postPart(blob, nextPart, isLast, durationMs, draftTranscript)
    this.partNumber = nextPart
    this.bytesUploaded += blob.size
    this.emitProgress()
    return result
  }

  private async postPart(
    blob: Blob,
    partNumber: number,
    isLast: boolean,
    durationMs?: number,
    draftTranscript?: string,
  ): Promise<{ status: string }> {
    this.inflight += 1
    this.emitProgress()

    const form = new FormData()
    form.append("chunk", blob, `part-${partNumber}.webm`)
    form.append("partNumber", String(partNumber))
    form.append("mimeType", this.mimeType)
    form.append("isLast", isLast ? "true" : "false")
    if (isLast && durationMs != null) form.append("durationMs", String(durationMs))
    if (isLast && draftTranscript) form.append("draftTranscript", draftTranscript)

    try {
      const response = await authorizedFetch(`/meetings/${this.meetingId}/recording-chunks`, {
        method: "POST",
        tenantId: this.tenantId,
        body: form,
      })

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(err.message ?? `Chunk upload failed (${response.status})`)
      }

      return (await response.json()) as { status: string }
    } catch (e) {
      this.failed = true
      throw e
    } finally {
      this.inflight -= 1
      this.emitProgress()
    }
  }

  private emitProgress(): void {
    if (!this.onProgress) return
    const total = Math.max(this.bytesTotal, 1)
    const percent =
      this.finalized && this.inflight === 0
        ? 100
        : Math.min(99, Math.round((this.bytesUploaded / total) * 100))
    this.onProgress({
      percent,
      partsUploaded: this.partNumber,
      bytesUploaded: this.bytesUploaded,
      bytesTotal: this.bytesTotal,
      uploading: this.inflight > 0,
    })
  }
}

export async function syncRecordingDuration(
  tenantId: string,
  meetingId: string,
  durationMs: number,
): Promise<void> {
  await authorizedFetch(`/meetings/${meetingId}/recording-progress`, {
    method: "PATCH",
    tenantId,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationMs }),
  }).catch(() => undefined)
}

export async function uploadMeetingAudioWithProgress(
  tenantId: string,
  meetingId: string,
  audioBlob: Blob,
  durationMs: number,
  draftTranscript: string | undefined,
  onProgress: (percent: number) => void,
): Promise<{ status: string }> {
  const form = new FormData()
  form.append("audio", audioBlob, "recording.webm")
  form.append("durationMs", String(durationMs))
  if (draftTranscript) form.append("draftTranscript", draftTranscript)

  const token = await resolveAccessToken()
  const url = `${getApiBaseUrl()}/api/v1/meetings/${meetingId}/process`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("X-Tenant-Id", tenantId)
    Object.entries(localeHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v))

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { status: string })
        } catch {
          resolve({ status: "processing" })
        }
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.send(form)
  })
}
