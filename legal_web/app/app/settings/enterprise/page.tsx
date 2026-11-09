"use client"

import { useState } from "react"
import { EnterpriseSetupWizard } from "@/components/settings/enterprise-setup-wizard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileText,
  Info,
  Lock,
  Mail,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  Table2,
  Wrench,
} from "lucide-react"

interface EnterpriseStatus {
  addin: {
    wordAddinInstalled: boolean
    outlookAddinInstalled: boolean
    manifestUrl: string
    allowedRoles: string[]
  }
  monitors: {
    enabled: boolean
    activeCount: number
    defaultFrequency: string
    notificationRouting: string
  }
  tabularReview: {
    enabled: boolean
    defaultExportFormat: string
  }
  soc2: {
    encryptionStatus: { covered: boolean; coveragePercent: number }
    lastAccessReview: string | null
    auditLogCoverage: number
    dataRetentionConfigured: boolean
    auditExportUrl: string
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <Badge
      variant={ok ? "default" : "secondary"}
      className={cn(
        "gap-1 text-xs",
        ok ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200" : "",
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label ?? (ok ? "Active" : "Not set up")}
    </Badge>
  )
}

export default function EnterpriseSettingsPage() {
  const { activeTenantId } = useTenant()
  const { toast } = useToast()

  const { data: status, isLoading, refetch } = useApiData(
    ["enterprise-status", activeTenantId],
    {
      apiFn: () => apiFetch<EnterpriseStatus>("/admin/enterprise/status", { tenantId: activeTenantId ?? undefined }),
      enabled: !!activeTenantId,
      placeholderData: {
        addin: {
          wordAddinInstalled: false,
          outlookAddinInstalled: false,
          manifestUrl: `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.yourdomain.com"}/add-in/manifest.xml`,
          allowedRoles: ["PARTNER_ADMIN", "ASSOCIATE"],
        },
        monitors: { enabled: true, activeCount: 0, defaultFrequency: "DAILY", notificationRouting: "both" },
        tabularReview: { enabled: true, defaultExportFormat: "CSV" },
        soc2: {
          encryptionStatus: { covered: true, coveragePercent: 98 },
          lastAccessReview: null,
          auditLogCoverage: 100,
          dataRetentionConfigured: false,
          auditExportUrl: "/admin/audit/logs/export",
        },
      },
    },
  )

  const [monitorsEnabled, setMonitorsEnabled] = useState(true)
  const [tabularEnabled, setTabularEnabled] = useState(true)
  const [monitorFreq, setMonitorFreq] = useState("DAILY")
  const [notifRouting, setNotifRouting] = useState("both")

  const copyManifestUrl = () => {
    navigator.clipboard.writeText(status?.addin.manifestUrl ?? "")
    toast({ title: "Manifest URL copied" })
  }

  const handlePatch = async (path: string, body: Record<string, unknown>) => {
    try {
      await apiFetch(path, { method: "PATCH", body, tenantId: activeTenantId ?? undefined })
      toast({ title: "Settings updated" })
      refetch?.()
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" })
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Enterprise Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Configure enterprise features, Office Add-Ins, regulatory monitors, and SOC 2 compliance controls.
          Only Partner Admins can access this page.
        </p>
      </div>

      {status && (
        <EnterpriseSetupWizard
          status={{
            addin: { wordAddinInstalled: status.addin.wordAddinInstalled, manifestUrl: status.addin.manifestUrl },
            monitors: { activeCount: status.monitors.activeCount },
          }}
          onRefresh={() => refetch?.()}
        />
      )}

      <Tabs defaultValue="addins">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-1 flex-wrap">
          {[
            { value: "addins", icon: Wrench, label: "Office Add-Ins" },
            { value: "monitors", icon: Radio, label: "Monitors" },
            { value: "tabular", icon: Table2, label: "Tabular Review" },
            { value: "soc2", icon: Shield, label: "SOC 2 / Compliance" },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2 gap-2"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Office Add-Ins ─────────────────────────────────────────── */}
        <TabsContent value="addins" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Word Add-In
              </CardTitle>
              <CardDescription>
                AI clause assist, matter linking, and copilot chat inside Microsoft Word (desktop + Word Online).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <StatusBadge ok={status?.addin.wordAddinInstalled ?? false} label={status?.addin.wordAddinInstalled ? "Installed" : "Not installed"} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm">Manifest URL (share with IT admin)</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    {status?.addin.manifestUrl}
                  </code>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copyManifestUrl}>
                    <ClipboardCopy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <details className="rounded-lg border bg-muted/30 p-3">
                <summary className="text-sm font-medium cursor-pointer">Installation instructions for IT admins</summary>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p><strong>Option 1 — Microsoft 365 Admin Centre (recommended):</strong></p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Open Microsoft 365 Admin Centre → Settings → Integrated apps</li>
                    <li>{'Click "Upload custom apps" → paste the Manifest URL above'}</li>
                    <li>Deploy to your chosen user groups</li>
                  </ol>
                  <p className="mt-2"><strong>Option 2 — Sideload for testing:</strong></p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Download the manifest XML from the URL above</li>
                    <li>In Word, go to Insert → Get Add-ins → Manage My Add-ins → Upload My Add-in</li>
                    <li>Select the downloaded manifest file</li>
                  </ol>
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Outlook Add-In
              </CardTitle>
              <CardDescription>
                Convert emails to matters, link emails to existing matters, and AI-draft replies from Outlook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <StatusBadge ok={status?.addin.outlookAddinInstalled ?? false} label={status?.addin.outlookAddinInstalled ? "Installed" : "Not installed"} />
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                The Outlook Add-In uses the same manifest and authentication as the Word Add-In.
                Deploy it via the Microsoft 365 Admin Centre using the same steps above, selecting the Outlook manifest.
              </p>
              <Button variant="outline" size="sm" className="gap-1" asChild>
                <a href="https://docs.microsoft.com/en-us/office/dev/add-ins/outlook/quick-start" target="_blank" rel="noopener noreferrer">
                  Microsoft Docs <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Monitors ──────────────────────────────────────────────── */}
        <TabsContent value="monitors" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                Regulatory Monitors
              </CardTitle>
              <CardDescription>
                Global settings for the firm&apos;s always-on regulatory intelligence scanning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable Monitors globally</p>
                  <p className="text-xs text-muted-foreground">Turn off to pause all scans for the firm</p>
                </div>
                <Switch
                  checked={monitorsEnabled}
                  onCheckedChange={async (v) => {
                    setMonitorsEnabled(v)
                    await handlePatch("/admin/enterprise/monitors", { enabled: v })
                  }}
                />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Default scan frequency</Label>
                  <Select
                    value={monitorFreq}
                    onValueChange={async (v) => {
                      setMonitorFreq(v)
                      await handlePatch("/admin/enterprise/monitors", { defaultFrequency: v })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Notification routing</Label>
                  <Select
                    value={notifRouting}
                    onValueChange={async (v) => {
                      setNotifRouting(v)
                      await handlePatch("/admin/enterprise/monitors", { notificationRouting: v })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_app">In-app only</SelectItem>
                      <SelectItem value="email">Email only</SelectItem>
                      <SelectItem value="both">In-app + Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                {status?.monitors.activeCount ?? 0} active monitor{(status?.monitors.activeCount ?? 0) !== 1 ? "s" : ""} across the firm.
                Individual monitors are managed on the <a href="/app/monitors" className="text-primary underline">Monitors page</a>.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tabular Review ────────────────────────────────────────── */}
        <TabsContent value="tabular" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-primary" />
                Tabular Review
              </CardTitle>
              <CardDescription>
                Side-by-side clause comparison for M&amp;A and contract-heavy practices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable Tabular Review</p>
                  <p className="text-xs text-muted-foreground">Show the Tabular Review mode on the Document Review page</p>
                </div>
                <Switch
                  checked={tabularEnabled}
                  onCheckedChange={async (v) => {
                    setTabularEnabled(v)
                    await handlePatch("/admin/enterprise/tabular-review", { enabled: v })
                  }}
                />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-sm">Default export format</Label>
                <Select
                  defaultValue="CSV"
                  onValueChange={(v) => handlePatch("/admin/enterprise/tabular-review", { defaultExportFormat: v })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CSV">CSV spreadsheet</SelectItem>
                    <SelectItem value="DOCX">DOCX redline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SOC 2 / Compliance ────────────────────────────────────── */}
        <TabsContent value="soc2" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                SOC 2 Compliance Dashboard
              </CardTitle>
              <CardDescription>
                Read-only compliance status panel for evidence collection and auditor reporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Encryption status */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Encryption at rest & transit</p>
                    <p className="text-xs text-muted-foreground">AES-256-GCM for sensitive fields, TLS 1.3 in transit</p>
                  </div>
                </div>
                <StatusBadge
                  ok={status?.soc2.encryptionStatus.covered ?? false}
                  label={`${status?.soc2.encryptionStatus.coveragePercent ?? 0}% covered`}
                />
              </div>
              <Separator />

              {/* Audit log coverage */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Audit log coverage</p>
                    <p className="text-xs text-muted-foreground">All POST/PATCH/DELETE actions are logged with user, IP, and resource</p>
                  </div>
                </div>
                <StatusBadge ok={(status?.soc2.auditLogCoverage ?? 0) >= 95} label={`${status?.soc2.auditLogCoverage ?? 0}%`} />
              </div>
              <Separator />

              {/* Last access review */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last access review</p>
                    <p className="text-xs text-muted-foreground">Weekly automated review flags stale tokens, inactive admins, missing MFA</p>
                  </div>
                </div>
                <StatusBadge
                  ok={!!status?.soc2.lastAccessReview}
                  label={status?.soc2.lastAccessReview
                    ? new Date(status.soc2.lastAccessReview).toLocaleDateString()
                    : "Never run"}
                />
              </div>
              <Separator />

              {/* Data retention */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Data retention policy</p>
                    <p className="text-xs text-muted-foreground">Audit logs 7yr, documents tenant-configured, AI logs 2yr</p>
                  </div>
                </div>
                <StatusBadge ok={status?.soc2.dataRetentionConfigured ?? false} label={status?.soc2.dataRetentionConfigured ? "Configured" : "Default"} />
              </div>
              <Separator />

              {/* Export audit logs */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm font-medium">Audit log export (for auditor evidence)</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    const url = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/admin/audit/logs/export`
                    window.open(url, "_blank")
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                SOC 2 Type II audit readiness requires an external auditor engagement. This panel tracks technical controls only.
                Review the policy documents in <code className="bg-muted px-1 rounded">docs/soc2/</code> in your repository
                and the <code className="bg-muted px-1 rounded">evidence-collection-runbook.md</code> for guidance.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
