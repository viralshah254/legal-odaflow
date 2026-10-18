"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Database } from "lucide-react"
import {
  getMiTaxonomyCoverage,
  listMiMetadataAssets,
  updateMiMetadataAsset,
  type MiMetadataAsset,
  type MiTaxonomyCoverage,
} from "@/lib/api/mi-metadata"

export default function MiMetadataAdminPage() {
  const [assets, setAssets] = useState<MiMetadataAsset[]>([])
  const [coverage, setCoverage] = useState<MiTaxonomyCoverage | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    Promise.all([listMiMetadataAssets({ pageSize: 50 }), getMiTaxonomyCoverage()])
      .then(([assetRes, cov]) => {
        setAssets(assetRes.items)
        setCoverage(cov)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = assets.filter(
    (a) =>
      !filter ||
      a.formName.toLowerCase().includes(filter.toLowerCase()) ||
      a.practiceArea.toLowerCase().includes(filter.toLowerCase()),
  )

  const handleSave = async (asset: MiMetadataAsset, raw: string) => {
    setSavingId(asset.id)
    try {
      const metadata = JSON.parse(raw) as Record<string, unknown>
      await updateMiMetadataAsset(asset.id, metadata)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">MI Metadata</h1>
          <p className="text-sm text-muted-foreground">
            Tag editor and taxonomy coverage for legal asset retrieval
          </p>
        </div>
      </div>

      {coverage && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Coverage</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{coverage.coverage.pctFull}%</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Untagged forms</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{coverage.untaggedCount}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Template kinds</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {coverage.templateKindOverrides}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Missing cells</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{coverage.lowConfidenceCount}</CardContent>
          </Card>
        </div>
      )}

      <Input
        placeholder="Filter by form name or practice area..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-md"
      />

      <div className="space-y-4">
        {filtered.map((asset) => (
          <Card key={asset.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{asset.formName}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {asset.countryCode} · {asset.practiceArea}
                {asset.jurisdiction ? ` · ${asset.jurisdiction}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                className="w-full min-h-[80px] rounded-md border bg-background p-2 text-xs font-mono"
                defaultValue={JSON.stringify(asset.metadata ?? {}, null, 2)}
                id={`meta-${asset.id}`}
              />
              <Button
                size="sm"
                disabled={savingId === asset.id}
                onClick={() => {
                  const el = document.getElementById(`meta-${asset.id}`) as HTMLTextAreaElement
                  void handleSave(asset, el.value)
                }}
              >
                {savingId === asset.id ? "Saving…" : "Save & re-embed"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
