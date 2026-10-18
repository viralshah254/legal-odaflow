"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, GitCompare, Eye, EyeOff } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface DocumentVersion {
  id: string
  version: number
  fileName: string
  createdAt: string
  htmlContent?: string | null
}

interface DiffSegment {
  type: "unchanged" | "added" | "removed"
  text: string
}

function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)

  // LCS-based word-level diff
  const m = oldWords.length
  const n = newWords.length

  // Use Myers-style simple diff for word level
  const segments: DiffSegment[] = []

  // Build LCS table (limit to first 2000 words for performance)
  const MAX = 2000
  const oldW = oldWords.slice(0, MAX)
  const newW = newWords.slice(0, MAX)

  const lcs: number[][] = Array.from({ length: oldW.length + 1 }, () =>
    new Array(newW.length + 1).fill(0)
  )

  for (let i = 1; i <= oldW.length; i++) {
    for (let j = 1; j <= newW.length; j++) {
      if (oldW[i - 1] === newW[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }

  // Trace back LCS
  let i = oldW.length
  let j = newW.length
  const raw: DiffSegment[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldW[i - 1] === newW[j - 1]) {
      raw.unshift({ type: "unchanged", text: oldW[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      raw.unshift({ type: "added", text: newW[j - 1] })
      j--
    } else {
      raw.unshift({ type: "removed", text: oldW[i - 1] })
      i--
    }
  }

  // If text was truncated, append remaining as unchanged
  if (m > MAX || n > MAX) {
    raw.push({ type: "unchanged", text: "… (document truncated for performance)" })
  }

  // Merge consecutive segments of same type
  for (const seg of raw) {
    const last = segments[segments.length - 1]
    if (last && last.type === seg.type) {
      last.text += seg.text
    } else {
      segments.push({ ...seg })
    }
  }

  return segments
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

interface DocumentRedlineProps {
  documentId: string
  tenantId: string
  currentVersion: number
  currentHtml?: string | null
}

export function DocumentRedline({ documentId, currentVersion, currentHtml }: DocumentRedlineProps) {
  const t = useTranslations("common")
  const tErr = useTranslations("errors")
  const { toast } = useToast()
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [compareVersion, setCompareVersion] = useState<string>("")
  const [diff, setDiff] = useState<DiffSegment[] | null>(null)
  const [showUnchanged, setShowUnchanged] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(true)

  useEffect(() => {
    async function fetchVersions() {
      setLoadingVersions(true)
      try {
        const data = await apiFetch<{ versions: DocumentVersion[] }>(
          `/documents/${documentId}/versions`
        )
        setVersions(data.versions ?? [])
      } catch {
        // Versions endpoint may not exist yet — show empty state gracefully
        setVersions([])
      } finally {
        setLoadingVersions(false)
      }
    }
    fetchVersions()
  }, [documentId])

  const handleCompare = async () => {
    if (!compareVersion || !currentHtml) {
      toast({ title: t("select_a_version_to_compare"), variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const target = versions.find((v) => v.id === compareVersion)
      if (!target) throw new Error("Version not found")

      // Fetch the older version HTML if not already loaded
      let oldHtml = target.htmlContent
      if (!oldHtml) {
        const data = await apiFetch<{ htmlContent: string | null }>(
          `/documents/${compareVersion}/content`
        )
        oldHtml = data.htmlContent
      }

      if (!oldHtml) {
        toast({ title: t("no_content_in_selected_version"), variant: "destructive" })
        return
      }

      const oldText = stripHtml(oldHtml)
      const newText = stripHtml(currentHtml)
      setDiff(computeDiff(oldText, newText))
    } catch {
      toast({ title: tErr("toast.comparisonFailed"), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const addedCount = diff?.filter((s) => s.type === "added").length ?? 0
  const removedCount = diff?.filter((s) => s.type === "removed").length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Redline / Compare
        </CardTitle>
        <CardDescription>
          Compare this version against an earlier version to see tracked changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Compare v{currentVersion} against:</span>
            {loadingVersions ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : versions.filter((v) => v.version !== currentVersion).length === 0 ? (
              <span className="text-sm text-muted-foreground italic">{t("no_other_versions")}</span>
            ) : (
              <Select value={compareVersion} onValueChange={setCompareVersion}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("select_version")} />
                </SelectTrigger>
                <SelectContent>
                  {versions
                    .filter((v) => v.version !== currentVersion)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version} — {new Date(v.createdAt).toLocaleDateString()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={!compareVersion || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <GitCompare className="h-4 w-4 mr-1" />}
            Compare
          </Button>
        </div>

        {diff && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">+{addedCount} additions</Badge>
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{removedCount} deletions</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnchanged(!showUnchanged)}
                className="gap-1.5 ml-auto"
              >
                {showUnchanged ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showUnchanged ? "Hide unchanged" : "Show unchanged"}
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm font-mono leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words">
              {diff.map((seg, i) => {
                if (!showUnchanged && seg.type === "unchanged") return null
                return (
                  <span
                    key={i}
                    className={cn(
                      seg.type === "added" && "bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200",
                      seg.type === "removed" && "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200 line-through",
                      seg.type === "unchanged" && "text-muted-foreground"
                    )}
                  >
                    {seg.text}
                  </span>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
