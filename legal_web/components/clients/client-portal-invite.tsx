import { Copy, Link2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface ClientPortalInviteActionProps {
  loading: boolean
  label: string
  onCreate: () => void
  compact?: boolean
}

export function ClientPortalInviteAction({
  loading,
  label,
  onCreate,
  compact = false,
}: ClientPortalInviteActionProps) {
  return (
    <Button
      type="button"
      variant={compact ? "ghost" : "outline"}
      size="sm"
      onClick={onCreate}
      disabled={loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </Button>
  )
}

interface ClientPortalInviteBannerProps {
  url: string
  title: string
  description: string
  inputLabel: string
  copyLabel: string
  onCopy: () => void
}

export function ClientPortalInviteBanner({
  url,
  title,
  description,
  inputLabel,
  copyLabel,
  onCopy,
}: ClientPortalInviteBannerProps) {
  if (!url) return null

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Input
          aria-label={inputLabel}
          readOnly
          value={url}
          className="font-mono text-xs lg:max-w-md"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" size="sm" onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          {copyLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
