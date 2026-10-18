"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useTenant } from "@/lib/contexts/tenant-context"
import { updateTenant } from "@/lib/api/tenants"
import { uploadFileViaPresignedUrl } from "@/lib/api/documents"
import { getFirmProfile, updateFirmProfile, type FirmProfileData } from "@/lib/api/governance"
import { useQueryClient } from "@tanstack/react-query"
import { Upload, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FirmProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
}

export function FirmProfileDialog({ open, onOpenChange, onSave }: FirmProfileDialogProps) {
  const t = useTranslations("settings")
  const tBilling = useTranslations("billing")
  const { activeTenant, activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tenant = activeTenant?.tenant

  const [firmName, setFirmName] = useState(tenant?.name ?? "")
  const [industry, setIndustry] = useState("Legal Services")
  const [location, setLocation] = useState(tenant?.primaryCountry ?? "")
  const [description, setDescription] = useState("")
  const [firmProfile, setFirmProfile] = useState<FirmProfileData | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showLogoOnExports, setShowLogoOnExports] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && tenant) {
      setFirmName(tenant.name)
      setLocation(tenant.primaryCountry)
    }
  }, [open, tenant])

  useEffect(() => {
    if (!open || !activeTenantId) return
    getFirmProfile(activeTenantId)
      .then((profile) => {
        setFirmProfile(profile)
        setLogoUrl(profile?.logoUrl ?? null)
        setShowLogoOnExports(profile?.documentBranding?.showLogoOnExports ?? false)
      })
      .catch(() => {})
  }, [open, activeTenantId])

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeTenantId) return
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("File must be under 2 MB")
      return
    }
    setLogoUploading(true)
    setLogoError(null)
    try {
      const { fileUrl } = await uploadFileViaPresignedUrl(activeTenantId, file)
      setLogoUrl(fileUrl)
    } catch {
      setLogoError(t("logo_upload_error"))
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!activeTenantId || !firmName.trim()) return
    setSaving(true)
    try {
      await updateTenant(activeTenantId, { name: firmName.trim() })
      await updateFirmProfile(activeTenantId, {
        displayName: firmName.trim(),
        logoUrl: logoUrl ?? null,
        documentBranding: { showLogoOnExports },
      })
      await queryClient.invalidateQueries({ queryKey: ["my-tenants"] })
      await queryClient.invalidateQueries({ queryKey: ["firm-profile", activeTenantId] })
      onSave?.()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit_firm_profile")}</DialogTitle>
          <DialogDescription>{t("update_your_firm_information_and_branding")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          {/* Firm name */}
          <div className="space-y-2">
            <Label htmlFor="firmName">{t("firm_name")}</Label>
            <Input
              id="firmName"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
            />
          </div>
          {/* Industry */}
          <div className="space-y-2">
            <Label htmlFor="industry">{t("industry")}</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">{t("location")}</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{tBilling("description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t("brief_description_of_your_firm")}
            />
          </div>

          {/* Firm logo */}
          <div className="space-y-3 pt-1 border-t">
            <div>
              <Label className="text-sm font-medium">{t("firm_logo")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t("firm_logo_description")}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Preview */}
              <div
                className={cn(
                  "h-16 w-32 rounded-md border border-dashed border-border flex items-center justify-center bg-muted/30 shrink-0 overflow-hidden",
                  logoUrl && "border-solid border-border/60",
                )}
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Firm logo"
                    width={120}
                    height={56}
                    className="max-h-14 w-auto max-w-[120px] object-contain"
                    unoptimized
                  />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground/50" />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="sr-only"
                  onChange={handleLogoSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  {logoUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {logoUploading
                    ? t("logo_uploading")
                    : logoUrl
                      ? t("change_logo")
                      : t("upload_logo")}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl(null)}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("remove_logo")}
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground">{t("logo_hint")}</p>
              </div>
            </div>

            {logoError && (
              <p className="text-xs text-destructive">{logoError}</p>
            )}
          </div>

          {/* Show logo on exports toggle */}
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="showLogoToggle" className="text-sm font-medium cursor-pointer">
                {t("show_logo_on_exports")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("show_logo_on_exports_description")}
              </p>
            </div>
            <Switch
              id="showLogoToggle"
              checked={showLogoOnExports}
              onCheckedChange={setShowLogoOnExports}
              disabled={!logoUrl}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !firmName.trim()}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
