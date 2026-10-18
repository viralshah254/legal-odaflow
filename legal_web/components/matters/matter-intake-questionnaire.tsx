"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect, useCallback } from "react"
import { apiFetch } from "@/lib/api/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, ClipboardList, FileText, Loader2, Save, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface PracticeAreaQuestion {
  id: string
  question: string
  type: "select" | "multiselect" | "text" | "boolean"
  options?: string[]
  required: boolean
  helpText?: string
}

interface Props {
  matterId: string
  practiceArea: string
  savedAnswers?: Record<string, unknown> | null
  canEdit?: boolean
}

function EmptyQuestionnaireState({
  practiceArea,
  matterId,
  canEdit,
}: {
  practiceArea: string
  matterId: string
  canEdit: boolean
}) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSaveNotes = async () => {
    if (!notes.trim()) return
    setSaving(true)
    try {
      await apiFetch(`/matters/${matterId}/questionnaire`, {
        method: "POST",
        body: JSON.stringify({ answers: { _manualNotes: notes.trim() } }),
      })
      setSaved(true)
      toast({ title: "Notes saved", description: "Intake notes recorded for this matter." })
    } catch {
      toast({ title: "Save failed", description: "Could not save notes.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-10">
        <div className="flex flex-col items-center text-center gap-3 max-w-sm mx-auto">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">No questions configured yet</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Practice area questionnaires help auto-fill documents and speed up client intake. Configure one for{" "}
              <span className="font-medium">{practiceArea}</span> in Settings → Templates.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-1 w-full justify-center">
            <a
              href="/app/settings/templates"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              <Settings className="h-3.5 w-3.5" />
              Set up questionnaire
            </a>
            {canEdit && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                <FileText className="h-3.5 w-3.5" />
                Add intake notes manually
              </button>
            )}
          </div>
        </div>
        {expanded && canEdit && (
          <div className="mt-6 space-y-2 max-w-lg mx-auto">
            <Label htmlFor="manual-intake-notes" className="text-sm font-medium">
              Intake notes
            </Label>
            <Textarea
              id="manual-intake-notes"
              rows={5}
              placeholder="Add context, evidence, or instructions…"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveNotes} disabled={saving || !notes.trim()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                {saved ? "Saved" : "Save notes"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MatterIntakeQuestionnaire({ matterId, practiceArea, savedAnswers, canEdit = true }: Props) {
  const t = useTranslations("matters")
  const { toast } = useToast()
  const [questions, setQuestions] = useState<PracticeAreaQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch<{ practiceArea: string; questions: PracticeAreaQuestion[] }>(
        `/matters/questionnaire/${encodeURIComponent(practiceArea)}`,
      )
      setQuestions(data.questions ?? [])
    } catch {
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [practiceArea])

  useEffect(() => {
    if (practiceArea) fetchQuestions()
  }, [practiceArea, fetchQuestions])

  // Pre-fill from saved answers
  useEffect(() => {
    if (savedAnswers && Object.keys(savedAnswers).length > 0) {
      const { _savedAt: _, ...rest } = savedAnswers as Record<string, unknown>
      setAnswers(rest)
    }
  }, [savedAnswers])

  function setAnswer(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setSaved(false)
  }

  function toggleMultiselect(id: string, option: string) {
    const current = (answers[id] as string[] | undefined) ?? []
    const next = current.includes(option) ? current.filter((v) => v !== option) : [...current, option]
    setAnswer(id, next)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiFetch(`/matters/${matterId}/questionnaire`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      })
      setSaved(true)
      toast({ title: t("intake_answers_saved"), description: t("questionnaire_saved") })
    } catch {
      toast({ title: t("save_failed"), description: t("could_not_save_answers"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const completedCount = questions.filter((q) => {
    const val = answers[q.id]
    return val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0)
  }).length

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loading_questionnaire")}
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <EmptyQuestionnaireState practiceArea={practiceArea} matterId={matterId} canEdit={canEdit} />
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{t("intake_questionnaire")}</CardTitle>
          <CardDescription>
            {t("answered_progress", { answered: completedCount, total: questions.length })}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {completedCount === questions.length && (
            <Badge variant="default" className="text-xs">
              <CheckCircle2 className="mr-1 h-3 w-3" /> {t("complete_badge")}
            </Badge>
          )}
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {saved ? t("saved") : t("save_answers")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q) => (
          <Card key={q.id} className={cn("transition-colors", answers[q.id] !== undefined && answers[q.id] !== "" ? "border-primary/30" : "")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-start gap-1.5 text-sm font-medium">
                {q.required && <span className="mt-0.5 text-destructive">*</span>}
                {q.question}
              </CardTitle>
              {q.helpText && <CardDescription className="text-xs">{q.helpText}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-2">
              {q.type === "text" && (
                <Textarea
                  disabled={!canEdit}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder={t("enter_your_answer")}
                  className="text-sm min-h-[72px]"
                />
              )}

              {q.type === "select" && (
                <Select
                  disabled={!canEdit}
                  value={(answers[q.id] as string) ?? ""}
                  onValueChange={(v) => setAnswer(q.id, v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder={t("select_an_option")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(q.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {q.type === "multiselect" && (
                <div className="flex flex-wrap gap-2">
                  {(q.options ?? []).map((opt) => {
                    const checked = ((answers[q.id] as string[]) ?? []).includes(opt)
                    return (
                      <label
                        key={opt}
                        className={cn(
                          "flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border cursor-pointer select-none transition-colors",
                          checked ? "bg-primary/10 border-primary/40 text-primary" : "border-border",
                          !canEdit && "opacity-60 cursor-not-allowed",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!canEdit}
                          onCheckedChange={() => canEdit && toggleMultiselect(q.id, opt)}
                          className="h-3.5 w-3.5"
                        />
                        {opt}
                      </label>
                    )
                  })}
                </div>
              )}

              {q.type === "boolean" && (
                <RadioGroup
                  disabled={!canEdit}
                  value={answers[q.id] === true ? "yes" : answers[q.id] === false ? "no" : ""}
                  onValueChange={(v) => setAnswer(q.id, v === "yes")}
                  className="flex gap-4"
                >
                  {["yes", "no"].map((v) => (
                    <div key={v} className="flex items-center gap-1.5">
                      <RadioGroupItem value={v} id={`${q.id}-${v}`} />
                      <Label htmlFor={`${q.id}-${v}`} className="text-sm capitalize">
                        {v}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        ))}

        {canEdit && questions.length > 0 && (
          <div className="flex justify-end pt-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saved ? t("saved") : t("save_answers")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
