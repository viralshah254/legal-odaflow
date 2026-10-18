"use client"

import type { ReactNode } from "react"
import { MapPin, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  formatJurisdictionLocation,
  type JurisdictionChoice,
  type JurisdictionLocation,
} from "@/lib/geo/jurisdiction-mismatch"
import { cn } from "@/lib/utils"

interface JurisdictionMismatchDialogProps {
  open: boolean
  profile: JurisdictionLocation
  ip: JurisdictionLocation
  onChoose: (choice: JurisdictionChoice) => void
  onDismiss: () => void
}

function LocationCard({
  icon,
  label,
  location,
  emphasized,
}: {
  icon: ReactNode
  label: string
  location: JurisdictionLocation
  emphasized?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition-colors",
        emphasized
          ? "border-primary/40 bg-primary/5"
          : "border-border/70 bg-muted/30",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-foreground">
        {formatJurisdictionLocation(location)}
      </p>
    </div>
  )
}

export function JurisdictionMismatchDialog({
  open,
  profile,
  ip,
  onChoose,
  onDismiss,
}: JurisdictionMismatchDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm research jurisdiction</DialogTitle>
          <DialogDescription>
            Your profile jurisdiction differs from your current location. Choose which
            one to use for this research session.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <LocationCard
            icon={<UserRound className="h-3.5 w-3.5" />}
            label="Profile default"
            location={profile}
            emphasized
          />
          <LocationCard
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Current location"
            location={ip}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onChoose("ip")}
          >
            Use current location
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => onChoose("profile")}
          >
            Use profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
