"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import {
  getGovernanceSettings,
  updateGovernanceSettings,
  type GovernanceSettings,
} from "@/lib/api/governance"
import {
  createEthicalWall,
  deleteEthicalWall,
  listEthicalWalls,
  type EthicalWallGroup,
} from "@/lib/api/series-a"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield, Trash2 } from "lucide-react"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import Link from "next/link"

export default function GovernanceSettingsPage() {
  const t = useTranslations("settings")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [wallName, setWallName] = useState("")
  const [matterIds, setMatterIds] = useState("")
  const [userIds, setUserIds] = useState("")
  const [wallBusy, setWallBusy] = useState(false)

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["governance-settings", activeTenantId],
    queryFn: () => getGovernanceSettings(activeTenantId!),
    enabled: !!activeTenantId,
  })

  const { data: walls = [], isLoading: wallsLoading } = useQuery({
    queryKey: ["ethical-walls", activeTenantId],
    queryFn: () => listEthicalWalls(activeTenantId!),
    enabled: !!activeTenantId && Boolean(settings?.ethicalWallsEnabled),
  })

  const [form, setForm] = useState<GovernanceSettings | null>(null)
  const values = form ?? settings

  const handleSave = async () => {
    if (!activeTenantId || !values) return
    setSaving(true)
    try {
      await updateGovernanceSettings(activeTenantId, {
        ethicalWallsEnabled: values.ethicalWallsEnabled,
        aiTrainingOptOut: values.aiTrainingOptOut,
        requireMatterApprovalForSharing: values.requireMatterApprovalForSharing,
        dataRetentionDays: values.dataRetentionDays,
      })
      await refetch()
    } finally {
      setSaving(false)
    }
  }

  const handleCreateWall = async () => {
    if (!activeTenantId || !wallName.trim()) return
    setWallBusy(true)
    try {
      await createEthicalWall(activeTenantId, {
        name: wallName.trim(),
        matterIds: matterIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
        userIds: userIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      })
      setWallName("")
      setMatterIds("")
      setUserIds("")
      await queryClient.invalidateQueries({ queryKey: ["ethical-walls", activeTenantId] })
    } finally {
      setWallBusy(false)
    }
  }

  const handleDeleteWall = async (wall: EthicalWallGroup) => {
    if (!activeTenantId) return
    if (!confirm(`Remove ethical wall "${wall.name}"?`)) return
    setWallBusy(true)
    try {
      await deleteEthicalWall(activeTenantId, wall.id)
      await queryClient.invalidateQueries({ queryKey: ["ethical-walls", activeTenantId] })
    } finally {
      setWallBusy(false)
    }
  }

  if (isLoading || !values) {
    return (
      <div className="p-6">
        <PageSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("governance")}</h1>
          <p className="text-muted-foreground">{t("firm_policies_ethical_walls_and_ai_usage_rules")}</p>
        </div>
        <OpenCopilotButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("policy_controls")}</CardTitle>
          <CardDescription>{t("compliance-by-design_defaults_for_your_tenant")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="ethical-walls">{t("ethical_walls")}</Label>
            <Switch
              id="ethical-walls"
              checked={values.ethicalWallsEnabled}
              onCheckedChange={(v) =>
                setForm({ ...values, ethicalWallsEnabled: v })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-optout">{t("no_training_on_firm_data_ai_opt-out")}</Label>
            <Switch
              id="ai-optout"
              checked={values.aiTrainingOptOut}
              onCheckedChange={(v) =>
                setForm({ ...values, aiTrainingOptOut: v })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="share-approval">{t("require_approval_for_matter_sharing")}</Label>
            <Switch
              id="share-approval"
              checked={values.requireMatterApprovalForSharing}
              onCheckedChange={(v) =>
                setForm({ ...values, requireMatterApprovalForSharing: v })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retention">{t("data_retention_days")}</Label>
            <Input
              id="retention"
              type="number"
              value={values.dataRetentionDays}
              onChange={(e) =>
                setForm({
                  ...values,
                  dataRetentionDays: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save policies"}
          </Button>
        </CardContent>
      </Card>

      {values.ethicalWallsEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Ethical walls
            </CardTitle>
            <CardDescription>
              Restrict listed users from accessing specific matters (comma-separated IDs).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wall-name">{t("wall_name")}</Label>
              <Input
                id="wall-name"
                value={wallName}
                onChange={(e) => setWallName(e.target.value)}
                placeholder={t("eg_acme_spin-off_conflict")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matter-ids">{t("matter_ids")}</Label>
              <Input
                id="matter-ids"
                value={matterIds}
                onChange={(e) => setMatterIds(e.target.value)}
                placeholder={t("matterid1_matterid2")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-ids">{t("restricted_user_ids")}</Label>
              <Input
                id="user-ids"
                value={userIds}
                onChange={(e) => setUserIds(e.target.value)}
                placeholder={t("userid1_userid2")}
              />
            </div>
            <Button onClick={() => void handleCreateWall()} disabled={wallBusy || !wallName.trim()}>
              {wallBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create ethical wall
            </Button>

            {wallsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : walls.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_ethical_walls_configured_yet")}</p>
            ) : (
              <ul className="space-y-3">
                {walls.map((wall) => (
                  <li key={wall.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{wall.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {wall.matterIds?.length ?? 0} matter(s) · {wall.userIds?.length ?? 0} restricted user(s)
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void handleDeleteWall(wall)}
                        disabled={wallBusy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(wall.matterIds ?? []).slice(0, 3).map((id) => (
                        <Badge key={id} variant="outline" className="text-[10px]">
                          {id}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        <Link href="/app/settings/data-consent" className="text-primary hover:underline">
          Firm training opt-in
        </Link>
        {" · "}
        <Link href="/app/settings/ai-policy" className="text-primary hover:underline">
          AI policy
        </Link>
        {" · "}
        <Link href="/app/settings/compliance" className="text-primary hover:underline">
          Compliance & audit logs
        </Link>
        .
      </p>
    </div>
  )
}
