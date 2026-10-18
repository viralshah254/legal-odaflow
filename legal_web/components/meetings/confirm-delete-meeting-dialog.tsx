"use client"

import { useTranslations } from "next-intl"
import { Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmDeleteMeetingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meetingTitle?: string
  onConfirm: () => void | Promise<void>
  deleting?: boolean
}

export function ConfirmDeleteMeetingDialog({
  open,
  onOpenChange,
  meetingTitle,
  onConfirm,
  deleting = false,
}: ConfirmDeleteMeetingDialogProps) {
  const t = useTranslations("common")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-4 sm:flex-row sm:items-start sm:text-left">
          <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 sm:mx-0">
            <Trash2 className="h-6 w-6 text-destructive" aria-hidden />
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <DialogTitle>{t("delete_meeting_title")}</DialogTitle>
            <DialogDescription className="text-pretty">
              {meetingTitle ? (
                <>
                  <span className="font-medium text-foreground">{meetingTitle}</span>
                  {" — "}
                </>
              ) : null}
              {t("delete_meeting_description")}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={deleting}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
