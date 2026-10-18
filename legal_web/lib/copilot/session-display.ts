import { format, isValid } from "date-fns"
import type { CopilotSessionApi } from "@/lib/api/copilot"

export function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*+/g, "")
    .replace(/[#_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function getFirstUserMessage(session: CopilotSessionApi): string | null {
  const msg = (session.messages ?? []).find((m) => m.role === "user")
  return msg?.content?.trim() ?? null
}

export function getLastAssistantMessage(session: CopilotSessionApi): string | null {
  const assistants = (session.messages ?? []).filter((m) => m.role === "assistant")
  return assistants.at(-1)?.content?.trim() ?? null
}

export function extractHeadingTitle(content: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/)
    if (heading) return stripMarkdownInline(heading[1])
    const subject = trimmed.match(/^Subject:\s*(.+)$/i)
    if (subject) return subject[1].trim()
    const re = trimmed.match(/^RE:\s*(.+)$/i)
    if (re) return re[1].trim()
  }
  return null
}

/** Prefer the user's prompt — it best distinguishes sessions on the same matter. */
export function getSessionTitle(session: CopilotSessionApi, untitledLabel: string): string {
  const userPrompt = getFirstUserMessage(session)
  if (userPrompt) {
    const cleaned = stripMarkdownInline(userPrompt)
    if (cleaned.length >= 3) {
      return cleaned.length <= 88 ? cleaned : `${cleaned.slice(0, 85)}…`
    }
  }

  const assistant = getLastAssistantMessage(session)
  if (assistant) {
    const heading = extractHeadingTitle(assistant)
    if (heading && heading.length > 3) return heading
  }

  return untitledLabel
}

export function getSessionSubtitle(session: CopilotSessionApi): string | null {
  const userPrompt = getFirstUserMessage(session)
  const assistant = getLastAssistantMessage(session)
  const title = getSessionTitle(session, "")

  if (assistant) {
    const heading = extractHeadingTitle(assistant)
    if (heading && stripMarkdownInline(heading).toLowerCase() !== title.toLowerCase()) {
      return heading
    }
  }

  if (userPrompt) {
    const cleaned = stripMarkdownInline(userPrompt)
    if (cleaned.toLowerCase() !== title.toLowerCase()) return cleaned
  }

  return null
}

export function getSessionPreview(session: CopilotSessionApi, emptyLabel: string): string {
  const assistant = getLastAssistantMessage(session)
  if (!assistant) {
    const userPrompt = getFirstUserMessage(session)
    if (!userPrompt) return emptyLabel
    const cleaned = stripMarkdownInline(userPrompt)
    return cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned
  }

  const lines = assistant.split("\n").map((line) => line.trim()).filter(Boolean)
  const bodyLines = lines.filter(
    (line) =>
      !/^#{1,3}\s/.test(line) &&
      !/^Subject:/i.test(line) &&
      !/^---+/.test(line) &&
      !/^>\s/.test(line),
  )
  const body = stripMarkdownInline(bodyLines.join(" "))
  if (!body) return emptyLabel
  return body.length > 140 ? `${body.slice(0, 137)}…` : body
}

export function getSessionMeta(session: CopilotSessionApi): {
  matter: string | null
  client: string | null
} {
  const ctx = session.context as Record<string, unknown> | null
  return {
    matter: (ctx?.matterTitle as string) ?? null,
    client: (ctx?.clientName as string) ?? null,
  }
}

export function formatSessionTimestamp(value: string): string {
  const date = new Date(value)
  if (!isValid(date)) return "—"
  return format(date, "MMM d, yyyy · h:mm a")
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_, nested) => (typeof nested === "bigint" ? nested.toString() : nested), 2)
  } catch {
    return String(value)
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function getAuditPayloadSummary(payload: unknown): string | null {
  if (!isRecord(payload)) return null
  for (const key of ["message", "title", "subject", "query", "name"]) {
    const value = payload[key]
    if (typeof value === "string" && value.trim()) {
      const cleaned = value.trim()
      return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned
    }
  }
  const keys = Object.keys(payload)
  if (keys.length === 0) return null
  const compact = safeJsonStringify(payload).replace(/\s+/g, " ")
  return compact.length > 120 ? `${compact.slice(0, 117)}…` : compact
}

export function formatToolName(toolName: string | null | undefined): string {
  if (!toolName || toolName === "unknown") return "Unknown tool"
  return toolName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
