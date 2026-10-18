"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { apiFetch } from "@/lib/api/client"
import { getBackendPublicOrigin } from "@/lib/api/api-base"
import { ArrowLeft, Loader2, Shield } from "lucide-react"

const DATA_REGIONS = [
  { value: "us-east-1", label: "US East" },
  { value: "eu-west-2", label: "EU West (London)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "af-south-1", label: "Africa (Cape Town)" },
]

export default function SsoSettingsPage() {
  const t = useTranslations("settings")
  const { activeTenant, activeTenantId, refreshTenants } = useTenant()
  const tenant = activeTenant?.tenant

  const existingSso =
    (tenant as { ssoConfig?: Record<string, unknown> } | undefined)?.ssoConfig ?? {}

  const [enabled, setEnabled] = useState(Boolean(existingSso.enabled))
  const [idpEntityId, setIdpEntityId] = useState(String(existingSso.idpEntityId ?? ""))
  const [ssoUrl, setSsoUrl] = useState(String(existingSso.ssoUrl ?? ""))
  const [idpCert, setIdpCert] = useState(String(existingSso.idpCert ?? ""))
  const [scimEnabled, setScimEnabled] = useState(Boolean(existingSso.scimEnabled))
  const [scimBearerToken, setScimBearerToken] = useState(String(existingSso.scimBearerToken ?? ""))
  const [dataRegion, setDataRegion] = useState(tenant?.dataRegion ?? "us-east-1")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apiOrigin = getBackendPublicOrigin()
  const acsUrl = `${apiOrigin}/api/v1/auth/saml/acs`
  const spEntityId = activeTenantId
    ? `${apiOrigin}/api/v1/auth/saml/sp/${activeTenantId}`
    : null
  const scimEndpoint = activeTenantId
    ? `${apiOrigin}/api/v1/auth/scim/v2/${activeTenantId}/Users`
    : null

  const generateScimToken = () => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    setScimBearerToken(hex)
  }

  const handleSave = async () => {
    if (!activeTenantId) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await apiFetch(`/tenants/${activeTenantId}`, {
        method: "PATCH",
        body: {
          dataRegion,
          ssoConfig: {
            enabled,
            provider: "saml",
            idpEntityId: idpEntityId.trim() || undefined,
            ssoUrl: ssoUrl.trim() || undefined,
            idpCert: idpCert.trim() || undefined,
            scimEnabled,
            scimBearerToken: scimBearerToken.trim() || undefined,
          },
        },
      })
      await refreshTenants?.()
      setMessage("SSO and data region settings saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/app/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Enterprise SSO
            </h1>
            <p className="text-muted-foreground">
              SAML SSO and data residency for {tenant?.name ?? "your firm"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("single_sign-on_saml")}</CardTitle>
            <CardDescription>
              Configure your identity provider. Contact support to complete SCIM provisioning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sso-enabled">{t("enable_saml_sso")}</Label>
              <Switch
                id="sso-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity-id">{t("idp_entity_id")}</Label>
              <Input
                id="entity-id"
                value={idpEntityId}
                onChange={(e) => setIdpEntityId(e.target.value)}
                placeholder="https://idp.example.com/entity"
                disabled={!enabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sso-url">{t("sso_url")}</Label>
              <Input
                id="sso-url"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
                placeholder="https://idp.example.com/sso/saml"
                disabled={!enabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idp-cert">IdP signing certificate (PEM)</Label>
              <textarea
                id="idp-cert"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={idpCert}
                onChange={(e) => setIdpCert(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Required for SAML signature verification. Paste the IdP X.509 certificate from your identity provider.
              </p>
            </div>
            {enabled && spEntityId && (
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium">Configure your IdP with these service provider values:</p>
                <p>
                  <span className="text-muted-foreground">ACS URL:</span> {acsUrl}
                </p>
                <p>
                  <span className="text-muted-foreground">SP Entity ID:</span> {spEntityId}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SCIM provisioning</CardTitle>
            <CardDescription>
              Automated user provisioning from your identity provider (requires bearer token).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="scim-enabled">Enable SCIM</Label>
              <Switch
                id="scim-enabled"
                checked={scimEnabled}
                onCheckedChange={setScimEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scim-token">SCIM bearer token</Label>
              <div className="flex gap-2">
                <Input
                  id="scim-token"
                  type="password"
                  value={scimBearerToken}
                  onChange={(e) => setScimBearerToken(e.target.value)}
                  placeholder="Minimum 32 characters"
                  disabled={!scimEnabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateScimToken}
                  disabled={!scimEnabled}
                >
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this token in your IdP SCIM integration. Treat it like an API key.
              </p>
            </div>
            {scimEnabled && scimEndpoint && (
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium">SCIM endpoint for your IdP:</p>
                <p className="break-all">{scimEndpoint}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("data_region")}</CardTitle>
            <CardDescription>
              Document storage is enforced to match this region on upload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={dataRegion} onValueChange={setDataRegion}>
              <SelectTrigger>
                <SelectValue placeholder={t("select_region")} />
              </SelectTrigger>
              <SelectContent>
                {DATA_REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {message && (
          <p className="text-sm text-primary">{message}</p>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save enterprise settings"
          )}
        </Button>
      </div>
    </RoleGate>
  )
}
