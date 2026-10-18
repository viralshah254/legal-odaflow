export type UploadProfile = "document" | "meetingAudio" | "firDocument"

type SignatureCheck = {
  offset: number
  bytes: number[]
}

type ProfileConfig = {
  extensions: readonly string[]
  mimeTypes: readonly string[]
  maxBytes: number
  /** Plain-text extensions skip magic-byte checks. */
  textExtensions?: readonly string[]
  signaturesByExtension: Record<string, SignatureCheck[]>
}

const PDF_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }]
const PNG_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }]
const JPEG_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]
const WEBP_SIG: SignatureCheck[] = [
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
]
const ZIP_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }]
const OLE_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }]
const TIFF_LE_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00] }]
const TIFF_BE_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] }]
const WAV_SIG: SignatureCheck[] = [
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { offset: 8, bytes: [0x57, 0x41, 0x56, 0x45] },
]
const WEBM_SIG: SignatureCheck[] = [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }]
const MP3_SIG: SignatureCheck[] = [
  { offset: 0, bytes: [0x49, 0x44, 0x33] },
  { offset: 0, bytes: [0xff, 0xfb] },
  { offset: 0, bytes: [0xff, 0xf3] },
  { offset: 0, bytes: [0xff, 0xf2] },
]
const MP4_FTYP_SIG: SignatureCheck[] = [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }]

const PROFILES: Record<UploadProfile, ProfileConfig> = {
  document: {
    extensions: ["pdf", "doc", "docx", "txt", "md", "png", "jpg", "jpeg", "webp"],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/webp",
    ],
    maxBytes: 50 * 1024 * 1024,
    textExtensions: ["txt", "md"],
    signaturesByExtension: {
      pdf: PDF_SIG,
      png: PNG_SIG,
      jpg: JPEG_SIG,
      jpeg: JPEG_SIG,
      webp: WEBP_SIG,
      docx: ZIP_SIG,
      doc: OLE_SIG,
    },
  },
  meetingAudio: {
    extensions: ["mp3", "m4a", "wav", "mp4", "webm"],
    mimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/x-m4a",
      "audio/wav",
      "audio/x-wav",
      "audio/webm",
      "video/mp4",
      "video/webm",
    ],
    maxBytes: 500 * 1024 * 1024,
    signaturesByExtension: {
      mp3: MP3_SIG,
      m4a: MP4_FTYP_SIG,
      mp4: MP4_FTYP_SIG,
      wav: WAV_SIG,
      webm: WEBM_SIG,
    },
  },
  firDocument: {
    extensions: ["pdf", "doc", "docx", "txt", "jpg", "jpeg", "png", "webp", "tif", "tiff"],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/tiff",
    ],
    maxBytes: 20 * 1024 * 1024,
    textExtensions: ["txt"],
    signaturesByExtension: {
      pdf: PDF_SIG,
      png: PNG_SIG,
      jpg: JPEG_SIG,
      jpeg: JPEG_SIG,
      webp: WEBP_SIG,
      tif: TIFF_LE_SIG,
      tiff: TIFF_LE_SIG,
      docx: ZIP_SIG,
      doc: OLE_SIG,
    },
  },
}

function getExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const dot = base.lastIndexOf(".")
  if (dot < 0) return ""
  return base.slice(dot + 1).toLowerCase()
}

function matchesSignature(header: Uint8Array, check: SignatureCheck): boolean {
  const end = check.offset + check.bytes.length
  if (header.length < end) return false
  return check.bytes.every((byte, index) => header[check.offset + index] === byte)
}

function matchesAnySignature(header: Uint8Array, checks: SignatureCheck[]): boolean {
  return checks.some((check) => matchesSignature(header, check))
}

function extensionMatchesTiff(header: Uint8Array): boolean {
  return matchesAnySignature(header, TIFF_LE_SIG) || matchesAnySignature(header, TIFF_BE_SIG)
}

async function readFileHeader(file: File, length = 16): Promise<Uint8Array> {
  const slice = file.slice(0, length)
  const buffer = await slice.arrayBuffer()
  return new Uint8Array(buffer)
}

function validateMimeType(file: File, config: ProfileConfig): void {
  const mime = (file.type || "").toLowerCase().trim()
  if (!mime || mime === "application/octet-stream") return
  if (!config.mimeTypes.includes(mime)) {
    throw new Error(`File type "${mime}" is not allowed for this upload.`)
  }
}

function validateMagicBytes(
  header: Uint8Array,
  extension: string,
  config: ProfileConfig,
): void {
  if (config.textExtensions?.includes(extension)) return

  const checks = config.signaturesByExtension[extension]
  if (!checks) {
    throw new Error(`Unsupported file extension ".${extension}".`)
  }

  if (extension === "tif" || extension === "tiff") {
    if (!extensionMatchesTiff(header)) {
      throw new Error("File content does not match a supported TIFF image.")
    }
    return
  }

  if (!matchesAnySignature(header, checks)) {
    throw new Error(
      `File content does not match the ".${extension}" extension. Upload may have been renamed or corrupted.`,
    )
  }
}

/** Defense-in-depth upload validation — server must also verify magic bytes. */
export async function validateUploadFile(
  file: File,
  profile: UploadProfile,
): Promise<void> {
  const config = PROFILES[profile]
  const extension = getExtension(file.name)

  if (!extension || !config.extensions.includes(extension)) {
    throw new Error(
      `Unsupported file type ".${extension || "unknown"}". Allowed: ${config.extensions.map((e) => `.${e}`).join(", ")}`,
    )
  }

  if (file.size <= 0) {
    throw new Error("File is empty.")
  }

  if (file.size > config.maxBytes) {
    const maxMb = Math.round(config.maxBytes / (1024 * 1024))
    throw new Error(`File exceeds the ${maxMb} MB size limit.`)
  }

  validateMimeType(file, config)
  const header = await readFileHeader(file, 16)
  validateMagicBytes(header, extension, config)
}

export function getUploadProfileMaxBytes(profile: UploadProfile): number {
  return PROFILES[profile].maxBytes
}
