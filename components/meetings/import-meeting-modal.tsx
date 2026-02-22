"use client"

import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Video, Settings } from "lucide-react"

interface ImportMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportMeetingModal({ open, onOpenChange }: ImportMeetingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Import from Zoom / Meet / Teams
          </DialogTitle>
          <DialogDescription>
            Connect your calendar and meeting providers in Settings to import recordings. After a call, you can pull the
            recording into Legal by OdaFlow and we’ll generate the transcript and notes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild>
            <Link href="/app/settings" onClick={() => onOpenChange(false)}>
              <Settings className="mr-2 h-4 w-4" />
              Open Settings
            </Link>
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
