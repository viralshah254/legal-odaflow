"use client"

import { useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import { getMatterById } from "@/lib/mock/matters"
import { createAssistanceRequest } from "@/lib/mock/assistance"
import { addTimelineEvent } from "@/lib/mock/timeline"
import { AssistanceType, AssistanceAccessScope, getAssistanceTypeLabel, getAccessScopeLabel } from "@/lib/types/assistance"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Users } from "lucide-react"

interface RequestAssistanceDialogProps {
  matterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestComplete: () => void
}

export function RequestAssistanceDialog({
  matterId,
  open,
  onOpenChange,
  onRequestComplete,
}: RequestAssistanceDialogProps) {
  const { currentUser, currentRole } = useRole()
  const [helperIds, setHelperIds] = useState<string[]>([])
  const [assistanceType, setAssistanceType] = useState<AssistanceType>("DRAFTING")
  const [accessScope, setAccessScope] = useState<AssistanceAccessScope>("MATTER_CLIENT_DOCS")
  const [dueDate, setDueDate] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  const matter = getMatterById(matterId)
  if (!matter) return null

  // Filter available helpers (exclude current owner)
  const availableHelpers = mockUsers.filter(
    (u) => u.id !== matter.ownerId && (currentRole === "PARTNER_ADMIN" || u.teamId === currentUser?.teamId)
  )

  const toggleHelper = (userId: string) => {
    setHelperIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = () => {
    if (helperIds.length === 0 || !currentUser || !matter) return

    const helperNames = mockUsers
      .filter((u) => helperIds.includes(u.id))
      .map((u) => u.name)

    createAssistanceRequest({
      matterId,
      matterTitle: matter.title,
      requestedBy: currentUser.id,
      requestedByName: currentUser.name,
      requestedAt: new Date(),
      helperIds,
      helperNames,
      assistanceType,
      accessScope,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes || undefined,
      status: "PENDING",
    })

    // Add timeline event
    addTimelineEvent({
      matterId,
      type: "ASSISTANCE_GRANTED",
      title: "Assistance requested",
      description: `${currentUser.name} requested assistance from ${helperNames.join(", ")}`,
      userId: currentUser.id,
      userName: currentUser.name,
      createdAt: new Date(),
      metadata: {
        helperIds,
        helperNames,
        assistanceType,
        accessScope,
      },
    })

    onRequestComplete()
    onOpenChange(false)
    // Reset form
    setHelperIds([])
    setAssistanceType("DRAFTING")
    setAccessScope("MATTER_CLIENT_DOCS")
    setDueDate("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Request Assistance</DialogTitle>
          <DialogDescription>
            Request help from team members on "{matter.title}".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Helper(s)</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {availableHelpers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available helpers
                </p>
              ) : (
                availableHelpers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`helper-${user.id}`}
                      checked={helperIds.includes(user.id)}
                      onCheckedChange={() => toggleHelper(user.id)}
                    />
                    <Label
                      htmlFor={`helper-${user.id}`}
                      className="text-sm font-normal cursor-pointer flex items-center gap-2 flex-1"
                    >
                      <Users className="h-4 w-4" />
                      {user.name} ({user.role})
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistance-type">Assistance Type</Label>
            <Select value={assistanceType} onValueChange={(value) => setAssistanceType(value as AssistanceType)}>
              <SelectTrigger id="assistance-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["LEGAL_RESEARCH", "DRAFTING", "FILING", "CLIENT_COMMUNICATION", "NEGOTIATION", "OTHER"] as AssistanceType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {getAssistanceTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Access Scope</Label>
            <RadioGroup value={accessScope} onValueChange={(value) => setAccessScope(value as AssistanceAccessScope)}>
              {(["MATTER_ONLY", "MATTER_CLIENT_DOCS", "FULL_CASE_SUPPORT"] as AssistanceAccessScope[]).map((scope) => (
                <div key={scope} className="flex items-center space-x-2">
                  <RadioGroupItem value={scope} id={scope} />
                  <Label htmlFor={scope} className="text-sm font-normal cursor-pointer">
                    {getAccessScopeLabel(scope)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional details about the assistance needed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={helperIds.length === 0}>
            Request Assistance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

