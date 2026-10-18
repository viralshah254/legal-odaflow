"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  X,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle,
  Crown,
  RefreshCw,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getUserDraftStyle,
  uploadDraftStyleSample,
  removeDraftStyleSample,
  analyzeMyDraftStyle,
  resetMyDraftStyle,
  STYLE_ANALYSIS_CREDITS,
  type UserDraftStyleState,
} from "@/lib/api/user-draft-style"

type Step = "setup" | "confirm" | "processing" | "done" | "manage"
const MAX_SAMPLES = 4

interface SampleSlot {
  name: string
  size: number
  uploading: boolean
  error?: string
}

interface DraftingStyleSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStyleReady?: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DraftingStyleSetupDialog({
  open,
  onOpenChange,
  onStyleReady,
}: DraftingStyleSetupDialogProps) {
  const [step, setStep] = useState<Step>("setup")
  const [styleState, setStyleState] = useState<UserDraftStyleState | null>(null)
  const [slots, setSlots] = useState<(SampleSlot | null)[]>(
    Array(MAX_SAMPLES).fill(null),
  )
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const filledCount = slots.filter((s) => s && !s.uploading && !s.error).length
  const hasUploading = slots.some((s) => s?.uploading)
  const hasEnoughToAnalyze = filledCount >= 1
  const balance = styleState?.creditBalance ?? 0
  const canAfford = balance >= STYLE_ANALYSIS_CREDITS

  const syncSlotsFromCount = (count: number) => {
    setSlots((prev) => {
      const next: (SampleSlot | null)[] = Array(MAX_SAMPLES).fill(null)
      for (let i = 0; i < Math.min(count, MAX_SAMPLES); i++) {
        next[i] = prev[i] ?? {
          name: `Sample ${i + 1}`,
          size: 0,
          uploading: false,
        }
      }
      return next
    })
  }

  const fetchState = useCallback(async () => {
    try {
      const s = await getUserDraftStyle()
      setStyleState(s)
      return s
    } catch {
      return null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const s = await fetchState()
      if (s?.status === "ready") {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setStep("done")
        onStyleReady?.()
      }
    }, 3000)
  }, [fetchState, onStyleReady])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchState().then((s) => {
      if (!s) return
      if (s.status === "ready") {
        setStep("manage")
      } else if (s.status === "processing") {
        setStep("processing")
        startPolling()
      } else {
        setStep("setup")
        if (s.documentCount > 0) syncSlotsFromCount(s.documentCount)
        else setSlots(Array(MAX_SAMPLES).fill(null))
      }
    })
    return () => stopPolling()
  }, [open, fetchState, startPolling, stopPolling])

  const firstEmptyIndex = () => slots.findIndex((s) => s === null)

  const uploadFile = async (file: File, slotIndex: number) => {
    setError(null)
    setSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = { name: file.name, size: file.size, uploading: true }
      return next
    })

    try {
      await uploadDraftStyleSample(file)
      setSlots((prev) => {
        const next = [...prev]
        next[slotIndex] = { name: file.name, size: file.size, uploading: false }
        return next
      })
      await fetchState()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      setSlots((prev) => {
        const next = [...prev]
        next[slotIndex] = { name: file.name, size: file.size, uploading: false, error: msg }
        return next
      })
    }
  }

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    let slotIdx = firstEmptyIndex()
    for (const file of list) {
      if (slotIdx === -1) {
        setError("Maximum 4 samples. Remove one to add another.")
        break
      }
      await uploadFile(file, slotIdx)
      slotIdx = firstEmptyIndex()
    }
  }

  const handleRemove = async (index: number) => {
    try {
      await removeDraftStyleSample(index)
      setSlots((prev) => {
        const filled = prev.filter((s): s is SampleSlot => s !== null)
        filled.splice(index, 1)
        const next: (SampleSlot | null)[] = Array(MAX_SAMPLES).fill(null)
        filled.forEach((s, i) => { next[i] = s })
        return next
      })
      await fetchState()
    } catch {
      setError("Failed to remove sample.")
    }
  }

  const handleAnalyze = async () => {
    setError(null)
    setAnalyzing(true)
    try {
      await analyzeMyDraftStyle()
      setStep("processing")
      startPolling()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed"
      setError(msg)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReset = async () => {
    try {
      await resetMyDraftStyle()
      setSlots(Array(MAX_SAMPLES).fill(null))
      setStyleState(null)
      setStep("setup")
    } catch {
      setError("Failed to reset style.")
    }
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    void handleFiles(files)
    e.target.value = ""
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          multiple
          onChange={handleInputChange}
        />

        {step === "setup" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-5 w-5 text-amber-500" />
                <DialogTitle>Your Drafting Style</DialogTitle>
              </div>
              <DialogDescription>
                Upload 3–4 of your past drafts. The AI learns your tone, structure, and phrasing —
                then every draft sounds like you wrote it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              {/* 4-slot grid with drag-and-drop */}
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed p-3 transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/20",
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="grid grid-cols-2 gap-2.5">
                  {slots.map((slot, i) => (
                    <SampleSlotCard
                      key={i}
                      index={i}
                      slot={slot}
                      isDragging={isDragging}
                      onPick={() => slot === null && openFilePicker()}
                      onRemove={() => void handleRemove(i)}
                    />
                  ))}
                </div>

                <div
                  className={cn(
                    "mt-3 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs transition-colors cursor-pointer",
                    isDragging
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                  onClick={() => firstEmptyIndex() !== -1 && openFilePicker()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {isDragging
                    ? "Drop to add your drafts"
                    : "Drag & drop files here, or click any empty slot"}
                </div>
              </div>

              {/* Progress + cost row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{filledCount} of {MAX_SAMPLES} samples</span>
                    <span>{filledCount >= 3 ? "Great — ready to analyze" : filledCount >= 1 ? "Add more for better accuracy" : "At least 1 required"}</span>
                  </div>
                  <Progress value={(filledCount / MAX_SAMPLES) * 100} className="h-1.5" />
                </div>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                  {STYLE_ANALYSIS_CREDITS} credits
                </Badge>
              </div>

              {error && (
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
                  Maybe later
                </Button>
                <Button
                  className="flex-1"
                  disabled={!hasEnoughToAnalyze || hasUploading}
                  onClick={() => setStep("confirm")}
                >
                  Analyze my style
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm style analysis</DialogTitle>
              <DialogDescription>
                This will analyze your {filledCount} sample{filledCount !== 1 ? "s" : ""} and build your personal style profile.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                {slots.filter(Boolean).map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate text-muted-foreground">{slot!.name}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credit cost</span>
                  <span className="font-semibold">{STYLE_ANALYSIS_CREDITS} credits</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your balance</span>
                  <span className={canAfford ? "text-foreground" : "text-destructive font-medium"}>
                    {balance} credits
                  </span>
                </div>
                <div className="border-t pt-3 flex items-center justify-between text-sm font-medium">
                  <span>Balance after</span>
                  <span className={canAfford ? "" : "text-destructive"}>
                    {canAfford ? balance - STYLE_ANALYSIS_CREDITS : "Insufficient"} credits
                  </span>
                </div>
              </div>

              {!canAfford && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  You need at least {STYLE_ANALYSIS_CREDITS} credits. Top up your account to continue.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep("setup")}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canAfford || analyzing}
                  onClick={() => void handleAnalyze()}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    "Confirm & analyze"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "processing" && (
          <>
            <DialogHeader>
              <DialogTitle>Studying your drafting style…</DialogTitle>
              <DialogDescription>
                Reading your {filledCount} sample{filledCount !== 1 ? "s" : ""} and building your personal style profile.
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Crown className="absolute inset-0 m-auto h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Analysing tone, structure, vocabulary, and phrasing patterns…
              </p>
            </div>
          </>
        )}

        {step === "done" && styleState && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <DialogTitle>Your style is ready</DialogTitle>
              </div>
              <DialogDescription>
                The AI will now draft in your personal style. Switch styles anytime from the drafting toolbar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {styleState.styleProfile && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground leading-relaxed max-h-40 overflow-y-auto">
                  {styleState.styleProfile}
                </div>
              )}
              {styleState.styleKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {styleState.styleKeywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
              <Button className="w-full" onClick={() => onOpenChange(false)}>
                Start drafting in my style
              </Button>
            </div>
          </>
        )}

        {step === "manage" && styleState && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-5 w-5 text-amber-500" />
                <DialogTitle>My Drafting Style</DialogTitle>
              </div>
              <DialogDescription>
                Active — your drafts are generated in your personal style.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {styleState.styleProfile && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground leading-relaxed max-h-36 overflow-y-auto">
                  {styleState.styleProfile}
                </div>
              )}
              {styleState.styleKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {styleState.styleKeywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                <span>{styleState.documentCount} sample{styleState.documentCount !== 1 ? "s" : ""} · Version {styleState.styleVersion}</span>
                <button
                  type="button"
                  className="flex items-center gap-1 text-destructive hover:underline"
                  onClick={() => void handleReset()}
                >
                  <RefreshCw className="h-3 w-3" /> Reset style
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    syncSlotsFromCount(styleState.documentCount)
                    setStep("setup")
                  }}
                >
                  Update samples
                </Button>
                <Button className="flex-1" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SampleSlotCard({
  index,
  slot,
  isDragging,
  onPick,
  onRemove,
}: {
  index: number
  slot: SampleSlot | null
  isDragging: boolean
  onPick: () => void
  onRemove: () => void
}) {
  if (!slot) {
    return (
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 min-h-[88px] transition-colors text-left w-full",
          isDragging
            ? "border-primary/60 bg-primary/5 text-primary cursor-copy"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30 text-muted-foreground cursor-pointer",
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60">
          <Plus className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-medium">Sample {index + 1}</span>
        <span className="text-[10px] opacity-70">PDF · DOCX · TXT</span>
      </button>
    )
  }

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 rounded-lg border p-3 min-h-[88px] transition-colors",
        slot.error
          ? "border-destructive/40 bg-destructive/5"
          : slot.uploading
            ? "border-primary/30 bg-primary/5"
            : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-2">
        {slot.uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
        ) : slot.error ? (
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        ) : (
          <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate leading-tight">{slot.name}</p>
          {slot.size > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{formatFileSize(slot.size)}</p>
          )}
          {slot.error && (
            <p className="text-[10px] text-destructive mt-0.5 line-clamp-2">{slot.error}</p>
          )}
          {slot.uploading && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Uploading…</p>
          )}
        </div>
        {!slot.uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={`Remove ${slot.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {!slot.uploading && !slot.error && (
        <Badge variant="outline" className="self-start text-[9px] py-0 h-4 border-primary/30 text-primary">
          Sample {index + 1}
        </Badge>
      )}
    </div>
  )
}
