"use client"

import { useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import { getMatterById, mockMatters } from "@/lib/mock/matters"
import { addTimelineEvent } from "@/lib/mock/timeline"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle } from "lucide-react"

interface TransferCaseDialogProps {
  matterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onTransferComplete: () => void
}

export function TransferCaseDialog({
  matterId,
  open,
  onOpenChange,
  onTransferComplete,
}: TransferCaseDialogProps) {
  const { currentUser, currentRole } = useRole()
  const [newOwnerId, setNewOwnerId] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [keepAsWatcher, setKeepAsWatcher] = useState(true)

  const matter = getMatterById(matterId)
  if (!matter) return null

  // Filter users who can be assigned (exclude current owner)
  const availableUsers = mockUsers.filter(
    (u) => u.id !== matter.ownerId && (currentRole === "PARTNER_ADMIN" || u.teamId === currentUser?.teamId)
  )

  const handleTransfer = () => {
    if (!newOwnerId || !matter) return

    const newOwner = mockUsers.find((u) => u.id === newOwnerId)
    if (!newOwner) return

    // Update matter owner
    const matterIndex = mockMatters.findIndex((m) => m.id === matterId)
    if (matterIndex !== -1) {
      const previousOwner = matter.ownerName
      mockMatters[matterIndex].ownerId = newOwnerId
      mockMatters[matterIndex].ownerName = newOwner.name
      
      // Add watcher if requested
      if (keepAsWatcher && matter.ownerId) {
        if (!mockMatters[matterIndex].watchers) {
          mockMatters[matterIndex].watchers = []
        }
        if (!mockMatters[matterIndex].watchers.includes(matter.ownerId)) {
          mockMatters[matterIndex].watchers.push(matter.ownerId)
        }
      }

      // Add timeline event
      addTimelineEvent({
        matterId,
        type: "CASE_TRANSFERRED",
        title: "Case transferred",
        description: `Transferred from ${previousOwner} to ${newOwner.name}`,
        userId: currentUser?.id || "1",
        userName: currentUser?.name || "System",
        createdAt: new Date(),
        metadata: {
          fromUserId: matter.ownerId,
          fromUserName: previousOwner,
          toUserId: newOwnerId,
          toUserName: newOwner.name,
          reason,
        },
      })
    }

    onTransferComplete()
    onOpenChange(false)
    // Reset form
    setNewOwnerId("")
    setReason("")
    setKeepAsWatcher(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer Case</DialogTitle>
          <DialogDescription>
            Transfer ownership of "{matter.title}" to another team member.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-owner">New Owner</Label>
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger id="new-owner">
                <SelectValue placeholder="Select new owner" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Transfer</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you're transferring this case..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="watcher"
              checked={keepAsWatcher}
              onCheckedChange={(checked) => setKeepAsWatcher(checked === true)}
            />
            <Label htmlFor="watcher" className="text-sm font-normal cursor-pointer">
              Keep me as a watcher on this matter
            </Label>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              This action will transfer full ownership. The new owner will have complete control over this matter.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!newOwnerId}>
            Transfer Case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

