"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Bolt,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { QuestionnaireField, FieldType } from "@/lib/india-drafting/questionnaire-data"
import {
  mergeTemplate,
  countUnfilledPlaceholders,
  extractPlaceholders,
} from "@/lib/india-drafting/template-bodies"
import { fillBlanks, editIndiaDraft, EditInstruction } from "@/lib/api/india-drafting"
import { escapeHtml, sanitizeDocumentHtml } from "@/lib/security/sanitize-html"

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  documentKind: string
  template: string
  fields: QuestionnaireField[]
}

// ─── AI command panel options ─────────────────────────────────────────────────

const AI_COMMANDS: { id: EditInstruction; label: string; icon: React.ReactNode }[] = [
  { id: "strengthen", label: "Strengthen grounds", icon: <Bolt className="h-3.5 w-3.5" /> },
  { id: "make_formal", label: "Make formal", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "make_concise", label: "Make concise", icon: <ZoomIn className="h-3.5 w-3.5" /> },
  { id: "expand_grounds", label: "Expand grounds", icon: <ZoomOut className="h-3.5 w-3.5" /> },
  { id: "add_citations", label: "Add citations", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "check_law", label: "Check law (BNS/BNSS)", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { id: "rephrase", label: "Rephrase", icon: <Wand2 className="h-3.5 w-3.5" /> },
  { id: "fix_grammar", label: "Fix grammar", icon: <Pencil className="h-3.5 w-3.5" /> },
]

// ─── Questionnaire helpers ────────────────────────────────────────────────────

function groupFields(fields: QuestionnaireField[]) {
  const groups: Record<string, QuestionnaireField[]> = {}
  for (const f of fields) {
    const g = f.group ?? "General"
    if (!groups[g]) groups[g] = []
    groups[g].push(f)
  }
  return groups
}

// ─── Merge preview ────────────────────────────────────────────────────────────

function mergedWithHighlights(template: string, values: Record<string, string>) {
  const highlighted = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const val = values[key]
    if (val) {
      return `<mark class="bg-amber-100 dark:bg-amber-900/40 rounded px-0.5 not-italic">${escapeHtml(val)}</mark>`
    }
    return `<span class="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded px-0.5 font-mono text-xs">${escapeHtml(match)}</span>`
  })
  return sanitizeDocumentHtml(highlighted)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IndiaDraftEditor({ documentKind, template, fields }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Phase: "questionnaire" → "editor"
  const [phase, setPhase] = useState<"questionnaire" | "editor">("questionnaire")

  // Form values
  const [values, setValues] = useState<Record<string, string>>({})

  // Generated document text
  const [docText, setDocText] = useState("")

  // Editor ref (contenteditable)
  const editorRef = useRef<HTMLDivElement>(null)

  // AI fill blanks state
  const [isFilling, setIsFilling] = useState(false)
  const [fillError, setFillError] = useState<string | null>(null)

  // Selection-based AI edit
  const [selectedText, setSelectedText] = useState("")
  const [selectionRange, setSelectionRange] = useState<Range | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editResult, setEditResult] = useState<{
    revisedText: string
    explanation: string
  } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [activeCommand, setActiveCommand] = useState<EditInstruction | null>(null)

  // Collapsed questionnaire groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Copy state
  const [copied, setCopied] = useState(false)

  const groups = groupFields(fields)
  const requiredFields = fields.filter((f) => f.required).map((f) => f.id)
  const allRequiredFilled = requiredFields.every((id) => values[id]?.trim())
  const unfilledCount = countUnfilledPlaceholders(mergeTemplate(template, values))
  const filledCount = Object.values(values).filter(Boolean).length

  // ── Questionnaire handlers ──────────────────────────────────────────────────

  const handleFieldChange = useCallback(
    (id: string, val: string) => {
      setValues((prev) => ({ ...prev, [id]: val }))
    },
    [],
  )

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  // ── AI: fill blanks ─────────────────────────────────────────────────────────

  const handleFillBlanks = async () => {
    const allPlaceholders = extractPlaceholders(template)
    const emptyFields = allPlaceholders.filter(
      (p) => !values[p]?.trim(),
    )
    if (emptyFields.length === 0) return

    setIsFilling(true)
    setFillError(null)
    try {
      const res = await fillBlanks({
        documentKind,
        context: values,
        emptyFields,
      })
      setValues((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(res.suggestions).filter(([, v]) => v),
        ),
      }))
    } catch {
      setFillError("AI fill failed. Please fill remaining fields manually.")
    } finally {
      setIsFilling(false)
    }
  }

  // ── Proceed to editor ───────────────────────────────────────────────────────

  const handleGenerate = () => {
    const merged = mergeTemplate(template, values)
    setDocText(merged)
    setPhase("editor")
  }

  // ── Keep editor in sync ─────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === "editor" && editorRef.current && docText) {
      editorRef.current.innerText = docText
    }
  }, [phase, docText])

  // ── Selection detection ─────────────────────────────────────────────────────

  const handleEditorMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      setSelectedText("")
      setSelectionRange(null)
      setEditResult(null)
      return
    }
    const text = sel.toString().trim()
    if (text.length < 10) return
    setSelectedText(text)
    setSelectionRange(sel.getRangeAt(0).cloneRange())
    setEditResult(null)
    setEditError(null)
    setActiveCommand(null)
  }

  // ── AI edit selection ───────────────────────────────────────────────────────

  const handleAiEdit = async (instruction: EditInstruction) => {
    if (!selectedText) return
    setIsEditing(true)
    setEditError(null)
    setActiveCommand(instruction)
    setEditResult(null)
    try {
      const res = await editIndiaDraft({
        documentKind,
        selectedText,
        instruction,
        context: selectedText, // simplified context
      })
      setEditResult(res)
    } catch {
      setEditError("AI edit failed. Please try again.")
    } finally {
      setIsEditing(false)
    }
  }

  // ── Apply AI edit to editor ─────────────────────────────────────────────────

  const applyEditResult = () => {
    if (!editResult || !selectionRange || !editorRef.current) return
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(selectionRange)
      document.execCommand("insertText", false, editResult.revisedText)
    }
    setEditResult(null)
    setSelectedText("")
    setSelectionRange(null)
    setActiveCommand(null)
  }

  // ── Copy to clipboard ───────────────────────────────────────────────────────

  const handleCopy = async () => {
    const text = editorRef.current?.innerText ?? docText
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Export (simple browser print for PDF) ──────────────────────────────────

  const handleExport = () => {
    const text = editorRef.current?.innerText ?? docText
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head><title>${documentKind}</title>
<style>body{font-family:"Times New Roman",serif;font-size:12pt;margin:2cm;line-height:1.6}pre{white-space:pre-wrap;font-family:inherit}</style>
</head><body><pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-20 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (phase === "editor" ? setPhase("questionnaire") : router.back())}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {phase === "editor" ? "Back to form" : "Back"}
        </Button>

        <div className="h-4 w-px bg-border" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {documentKind
              .replace(/^india_/, "")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())}
          </h1>
          <p className="text-xs text-muted-foreground">
            {phase === "questionnaire"
              ? `${filledCount} of ${fields.length} fields filled`
              : `${unfilledCount === 0 ? "All fields filled" : `${unfilledCount} placeholder${unfilledCount !== 1 ? "s" : ""} remaining`}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {phase === "editor" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </>
          )}
          {phase === "questionnaire" && (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!allRequiredFilled}
              className="gap-1.5"
            >
              Generate Draft
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Body */}
      {phase === "questionnaire" ? (
        <QuestionnairePhase
          groups={groups}
          values={values}
          collapsedGroups={collapsedGroups}
          isFilling={isFilling}
          fillError={fillError}
          unfilledCount={unfilledCount}
          template={template}
          onFieldChange={handleFieldChange}
          onToggleGroup={toggleGroup}
          onFillBlanks={handleFillBlanks}
          onGenerate={handleGenerate}
          allRequiredFilled={allRequiredFilled}
        />
      ) : (
        <EditorPhase
          editorRef={editorRef}
          selectedText={selectedText}
          isEditing={isEditing}
          activeCommand={activeCommand}
          editResult={editResult}
          editError={editError}
          onMouseUp={handleEditorMouseUp}
          onAiEdit={handleAiEdit}
          onApplyEdit={applyEditResult}
          onDismissEdit={() => {
            setEditResult(null)
            setSelectedText("")
            setSelectionRange(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Questionnaire Phase ──────────────────────────────────────────────────────

interface QPhaseProps {
  groups: Record<string, QuestionnaireField[]>
  values: Record<string, string>
  collapsedGroups: Set<string>
  isFilling: boolean
  fillError: string | null
  unfilledCount: number
  template: string
  onFieldChange: (id: string, val: string) => void
  onToggleGroup: (g: string) => void
  onFillBlanks: () => void
  onGenerate: () => void
  allRequiredFilled: boolean
}

function QuestionnairePhase({
  groups,
  values,
  collapsedGroups,
  isFilling,
  fillError,
  unfilledCount,
  template,
  onFieldChange,
  onToggleGroup,
  onFillBlanks,
  onGenerate,
  allRequiredFilled,
}: QPhaseProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Form */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r overflow-y-auto">
        <div className="p-4 space-y-1.5 border-b bg-muted/40 flex-shrink-0">
          <p className="text-sm font-medium">Fill in the document details</p>
          <p className="text-xs text-muted-foreground">
            Required fields are marked with <span className="text-rose-500">*</span>.
            Use AI to suggest values for any blank.
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onFillBlanks}
              disabled={isFilling || unfilledCount === 0}
              className="gap-1.5 flex-1"
            >
              {isFilling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isFilling ? "AI filling…" : `AI fill ${unfilledCount} blank${unfilledCount !== 1 ? "s" : ""}`}
            </Button>
            <Button
              size="sm"
              onClick={onGenerate}
              disabled={!allRequiredFilled}
              className="gap-1.5"
            >
              Generate
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {fillError && (
            <p className="text-xs text-destructive mt-1">{fillError}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(groups).map(([group, groupFields]) => (
            <GroupSection
              key={group}
              group={group}
              fields={groupFields}
              values={values}
              collapsed={collapsedGroups.has(group)}
              onToggle={() => onToggleGroup(group)}
              onFieldChange={onFieldChange}
            />
          ))}
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs text-muted-foreground mb-3">
            Live preview — <span className="text-amber-600 dark:text-amber-400">highlighted</span> = filled,{" "}
            <span className="text-rose-600 dark:text-rose-400">red</span> = blank
          </p>
          <div className="bg-white dark:bg-gray-950 border rounded-lg shadow-sm p-8">
            <pre
              className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-gray-900 dark:text-gray-100"
              dangerouslySetInnerHTML={{
                __html: mergedWithHighlights(template, values),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Group Section ────────────────────────────────────────────────────────────

function GroupSection({
  group,
  fields,
  values,
  collapsed,
  onToggle,
  onFieldChange,
}: {
  group: string
  fields: QuestionnaireField[]
  values: Record<string, string>
  collapsed: boolean
  onToggle: () => void
  onFieldChange: (id: string, val: string) => void
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
      >
        <span>{group}</span>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {!collapsed && (
        <div className="p-3 space-y-3">
          {fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={values[field.id] ?? ""}
              onChange={(v) => onFieldChange(field.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Field Input ──────────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: QuestionnaireField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={field.id} className="text-xs font-medium flex flex-wrap items-start gap-x-1 gap-y-0.5 leading-snug break-words">
        <span className="flex-1 min-w-0">{field.label}</span>
        {field.required && <span className="text-rose-500 shrink-0">*</span>}
        {field.aiCanFill && (
          <Badge variant="secondary" className="text-[9px] py-0 px-1 shrink-0">
            <Sparkles className="h-2 w-2 mr-0.5" />
            AI
          </Badge>
        )}
      </Label>

      {field.type === "textarea" ? (
        <Textarea
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? field.hint ?? ""}
          className="text-xs min-h-[60px] resize-none"
          rows={3}
        />
      ) : field.type === "select" && field.options ? (
        <select
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={field.id}
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? field.hint ?? ""}
          className="text-xs h-7"
        />
      )}

      {field.hint && field.type !== "textarea" && (
        <p className="text-[10px] text-muted-foreground leading-snug break-words line-clamp-3">{field.hint}</p>
      )}
    </div>
  )
}

// ─── Editor Phase ─────────────────────────────────────────────────────────────

interface EPhaseProps {
  editorRef: React.RefObject<HTMLDivElement>
  selectedText: string
  isEditing: boolean
  activeCommand: EditInstruction | null
  editResult: { revisedText: string; explanation: string } | null
  editError: string | null
  onMouseUp: () => void
  onAiEdit: (cmd: EditInstruction) => void
  onApplyEdit: () => void
  onDismissEdit: () => void
}

function EditorPhase({
  editorRef,
  selectedText,
  isEditing,
  activeCommand,
  editResult,
  editError,
  onMouseUp,
  onAiEdit,
  onApplyEdit,
  onDismissEdit,
}: EPhaseProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main editor */}
      <div className="flex-1 overflow-y-auto bg-muted/20 p-6">
        <div className="max-w-[794px] mx-auto">
          {selectedText && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-200">
              <span className="font-medium">Selected:</span>{" "}
              <span className="italic line-clamp-1">&ldquo;{selectedText}&rdquo;</span>
              <span className="text-muted-foreground ml-1">— choose an AI command →</span>
            </div>
          )}

          {/* A4 paper */}
          <div className="bg-white dark:bg-gray-950 border shadow-sm rounded-sm min-h-[1122px]">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onMouseUp={onMouseUp}
              onKeyUp={onMouseUp}
              className={cn(
                "p-16 min-h-full outline-none",
                "font-mono text-[12px] leading-[1.8] text-gray-900 dark:text-gray-100",
                "whitespace-pre-wrap",
                "selection:bg-blue-200 dark:selection:bg-blue-700",
              )}
              spellCheck={false}
              data-gramm="false"
              aria-label="Document editor"
            />
          </div>
        </div>
      </div>

      {/* Right: AI command panel */}
      <div className="w-72 flex-shrink-0 border-l bg-background overflow-y-auto flex flex-col">
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Commands
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select text in the document, then click a command.
          </p>
        </div>

        {/* Command buttons */}
        <div className="p-3 space-y-1.5 flex-shrink-0">
          {AI_COMMANDS.map((cmd) => (
            <Button
              key={cmd.id}
              variant={activeCommand === cmd.id ? "default" : "outline"}
              size="sm"
              className="w-full justify-start gap-2 text-xs h-8"
              disabled={!selectedText || isEditing}
              onClick={() => onAiEdit(cmd.id)}
            >
              {isEditing && activeCommand === cmd.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                cmd.icon
              )}
              {cmd.label}
            </Button>
          ))}
        </div>

        {/* Result panel */}
        {(editResult ?? editError) && (
          <div className="border-t p-3 flex-1 flex flex-col gap-2 overflow-y-auto">
            {editError ? (
              <div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
                {editError}
              </div>
            ) : editResult ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Revised passage</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={onDismissEdit}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs bg-muted rounded p-2 whitespace-pre-wrap border">
                  {editResult.revisedText}
                </div>
                {editResult.explanation && (
                  <p className="text-[10px] text-muted-foreground italic">
                    {editResult.explanation}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={onApplyEdit}
                  >
                    <Check className="h-3 w-3" />
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onDismissEdit}
                  >
                    Discard
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Tips */}
        {!selectedText && !editResult && !editError && (
          <div className="p-3 flex-1 flex items-start">
            <div className="text-[10px] text-muted-foreground space-y-2">
              <p className="font-medium text-xs">How to use:</p>
              <p>1. Click and drag to select any text in the document.</p>
              <p>2. Choose an AI command from the list above.</p>
              <p>3. Review the suggestion and click Apply to insert it.</p>
              <p className="mt-2 font-medium">Tip:</p>
              <p>
                Any <span className="font-mono text-rose-500">{"{{placeholder}}"}</span> still visible means that field was not filled. Go back to fill it or use AI.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
