"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-media-query"
import { parseHeading, parseInlineTokens, type InlineToken } from "@/lib/drafting/draft-text-formatter"
import { draftHeadingId } from "@/lib/drafting/draft-workspace"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface SmartDraftRendererProps {
  draft: string
  blanks: string[]
  onBlanksChange: (blanks: string[]) => void
}

const LONG_BLANK_THRESHOLD = 36

const blankInputClass = cn(
  "border-0 border-b-2 bg-transparent px-1 py-0.5 w-full max-w-full",
  "text-indigo-700 dark:text-indigo-300 font-semibold",
  "placeholder:text-indigo-400/70 dark:placeholder:text-indigo-600/70 placeholder:font-normal placeholder:italic",
  "focus:outline-none focus:border-indigo-500",
)

/** Render a single inline token — text, bold, italic, or an editable blank input. */
function InlineTokenView({
  token,
  blankIndex,
  blankValue,
  onBlankChange,
  isMobile,
  onMobileTap,
}: {
  token: InlineToken
  blankIndex: number
  blankValue: string
  onBlankChange: (index: number, value: string) => void
  isMobile: boolean
  onMobileTap: (index: number, label: string, value: string) => void
}) {
  if (token.type === "bold") return <strong className="font-semibold">{token.value}</strong>
  if (token.type === "italic") return <em>{token.value}</em>
  if (token.type === "blank") {
    // Mobile: show a tappable pill that opens the BlankSheet
    if (isMobile) {
      return (
        <button
          type="button"
          onClick={() => onMobileTap(blankIndex, token.label, blankValue)}
          className={cn(
            "inline-flex items-center mx-0.5 px-2 py-0.5 rounded-md border-b-2 border-indigo-400",
            "text-indigo-700 dark:text-indigo-300 font-semibold text-sm",
            "bg-indigo-50 dark:bg-indigo-950/50 active:bg-indigo-100 dark:active:bg-indigo-900/50",
            "max-w-full truncate",
          )}
        >
          {blankValue || (
            <span className="italic font-normal text-indigo-400/80 dark:text-indigo-600/80">
              {token.label.length > 22 ? token.label.slice(0, 22) + "…" : token.label}
            </span>
          )}
        </button>
      )
    }

    const isLong = token.label.length > LONG_BLANK_THRESHOLD

    if (isLong) {
      return (
        <span className="block my-1.5 w-full max-w-full">
          <span
            className="block text-[11px] leading-snug text-indigo-500/90 dark:text-indigo-400/80 italic mb-0.5 line-clamp-3 break-words"
            title={token.label}
          >
            {token.label}
          </span>
          <input
            type="text"
            value={blankValue}
            onChange={e => onBlankChange(blankIndex, e.target.value)}
            placeholder="Enter here…"
            aria-label={token.label}
            className={blankInputClass}
          />
        </span>
      )
    }

    const widthCh = Math.min(
      Math.max(blankValue.length || Math.min(token.label.length, 18), 6),
      28,
    )

    return (
      <span className="inline-block align-baseline mx-0.5 max-w-full">
        <input
          type="text"
          value={blankValue}
          onChange={e => onBlankChange(blankIndex, e.target.value)}
          placeholder={token.label}
          aria-label={token.label}
          title={token.label}
          className={cn(blankInputClass, "inline-block min-w-[5rem]")}
          style={{ width: `${widthCh}ch`, maxWidth: "100%" }}
        />
      </span>
    )
  }
  // type === "text"
  return <>{token.value}</>
}

/** Render one line of draft with inline token support. */
function DraftLine({
  tokens,
  blankOffset,
  blanks,
  onBlankChange,
  isMobile,
  onMobileTap,
}: {
  tokens: InlineToken[]
  blankOffset: number
  blanks: string[]
  onBlankChange: (index: number, value: string) => void
  isMobile: boolean
  onMobileTap: (index: number, label: string, value: string) => void
}) {
  let localBlankIndex = 0
  return (
    <>
      {tokens.map((token, i) => {
        const idx = token.type === "blank" ? blankOffset + localBlankIndex++ : 0
        return (
          <InlineTokenView
            key={i}
            token={token}
            blankIndex={idx}
            blankValue={token.type === "blank" ? (blanks[idx] ?? "") : ""}
            onBlankChange={onBlankChange}
            isMobile={isMobile}
            onMobileTap={onMobileTap}
          />
        )
      })}
    </>
  )
}

/** Parse the draft into lines, with pre-calculated blank indices per line. */
function useParsedLines(draft: string) {
  return useMemo(() => {
    const lines = draft.split("\n")
    let blankOffset = 0
    return lines.map(line => {
      const heading = parseHeading(line)
      const tokens = parseInlineTokens(heading ? heading.text : line)
      const blankCount = tokens.filter(t => t.type === "blank").length
      const result = { heading, tokens, blankOffset, blankCount }
      blankOffset += blankCount
      return result
    })
  }, [draft])
}

const headingClass: Record<1 | 2 | 3 | 4, string> = {
  1: "text-base font-bold uppercase tracking-wide text-center mt-5 mb-1 font-sans",
  2: "text-sm font-bold uppercase tracking-wide mt-4 mb-1 font-sans",
  3: "text-sm font-semibold mt-3 mb-0.5 font-sans",
  4: "text-sm font-semibold italic mt-2 font-sans",
}

/** Detects standalone versus / v. party-separator lines. */
function isVersusLine(text: string): boolean {
  return /^\s*(versus|v\.)\s*$/i.test(text)
}

/** Detects numbered/lettered sub-item lines like "(a)", "(i)", "1." at start. */
function isSubItem(text: string): boolean {
  return /^\s*[\[(]?[a-z0-9]{1,3}[\])\.]/.test(text)
}

export function SmartDraftRenderer({ draft, blanks, onBlanksChange }: SmartDraftRendererProps) {
  const parsedLines = useParsedLines(draft)
  const isMobile = useIsMobile()

  // State for the mobile blank-fill Sheet
  const [activeBlank, setActiveBlank] = useState<{ index: number; label: string; draft: string } | null>(null)
  const [sheetValue, setSheetValue] = useState("")

  const openBlankSheet = (index: number, label: string, current: string) => {
    setActiveBlank({ index, label, draft: current })
    setSheetValue(current)
  }

  const commitBlankSheet = () => {
    if (activeBlank === null) return
    const next = [...blanks]
    next[activeBlank.index] = sheetValue
    onBlanksChange(next)
    setActiveBlank(null)
  }

  const updateBlank = (index: number, value: string) => {
    const next = [...blanks]
    next[index] = value
    onBlanksChange(next)
  }

  return (
    <>
      <div className="p-6 text-sm leading-relaxed text-gray-800 dark:text-gray-200 font-serif bg-white dark:bg-gray-950 rounded-md overflow-x-hidden break-words">
        {parsedLines.map((line, i) => {
          if (line.heading) {
            const Tag = (["h1", "h2", "h3", "h4"] as const)[line.heading.level - 1]
            return (
              <Tag
                key={i}
                id={draftHeadingId(line.heading.text, i)}
                className={cn(headingClass[line.heading.level], "scroll-mt-24")}
              >
                <DraftLine
                  tokens={line.tokens}
                  blankOffset={line.blankOffset}
                  blanks={blanks}
                  onBlankChange={updateBlank}
                  isMobile={isMobile}
                  onMobileTap={openBlankSheet}
                />
              </Tag>
            )
          }

          // Empty lines become spacing.
          const isEmpty = line.tokens.length === 0 || (line.tokens.length === 1 && line.tokens[0].type === "text" && line.tokens[0].value.trim() === "")
          if (isEmpty) return <div key={i} className="h-2" />

          // Detect raw text for structural patterns.
          const rawText = line.tokens.map(t => t.type === "text" || t.type === "bold" || t.type === "italic" ? (t.value ?? "") : "").join("")

          // Versus / v. separator — centered italic.
          if (isVersusLine(rawText)) {
            return (
              <p key={i} className="text-center italic my-1 text-gray-500 dark:text-gray-400">
                <DraftLine tokens={line.tokens} blankOffset={line.blankOffset} blanks={blanks} onBlankChange={updateBlank} isMobile={isMobile} onMobileTap={openBlankSheet} />
              </p>
            )
          }

          // Sub-items like (a), (i), 1. — indent slightly.
          if (isSubItem(rawText)) {
            return (
              <p key={i} className="my-0.5 pl-6">
                <DraftLine tokens={line.tokens} blankOffset={line.blankOffset} blanks={blanks} onBlankChange={updateBlank} isMobile={isMobile} onMobileTap={openBlankSheet} />
              </p>
            )
          }

          return (
            <p key={i} className="my-0.5 break-words">
              <DraftLine
                tokens={line.tokens}
                blankOffset={line.blankOffset}
                blanks={blanks}
                onBlankChange={updateBlank}
                isMobile={isMobile}
                onMobileTap={openBlankSheet}
              />
            </p>
          )
        })}
      </div>

      {/* Mobile blank-fill Sheet */}
      <Sheet open={activeBlank !== null} onOpenChange={(open) => { if (!open) setActiveBlank(null) }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe-bottom">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base text-left leading-snug">
              {activeBlank?.label}
            </SheetTitle>
          </SheetHeader>
          <textarea
            value={sheetValue}
            onChange={(e) => setSheetValue(e.target.value)}
            placeholder="Enter value…"
            rows={3}
            autoFocus
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setActiveBlank(null)}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitBlankSheet}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
