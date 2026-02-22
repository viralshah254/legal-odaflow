"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { User, Lock, Edit } from "lucide-react"
import { mockUsers } from "@/lib/mock/users"
import { shareMatter, getMatterShares, removeMatterShare, updateMatterShareAccess } from "@/lib/mock/matter-sharing"
import type { MatterShare, MatterAccessLevel } from "@/lib/types/matter-sharing"
import { useRole } from "@/lib/contexts/role-context"
import { format } from "date-fns"

interface ShareMatterDialogProps {
  matterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onShareComplete: () => void
}

export function ShareMatterDialog({ matterId, open, onOpenChange, onShareComplete }: ShareMatterDialogProps) {
  const { currentUser } = useRole()
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [accessLevel, setAccessLevel] = useState<MatterAccessLevel>("READ_ONLY")
  const [shares, setShares] = useState<MatterShare[]>([])

  useEffect(() => {
    if (open) {
      setShares(getMatterShares(matterId))
    }
  }, [matterId, open])

  const availableUsers = mockUsers.filter((u) => u.id !== currentUser?.id)

  const handleShare = () => {
    if (!selectedUserId || !currentUser) return

    const user = mockUsers.find((u) => u.id === selectedUserId)
    if (!user) return

    shareMatter(matterId, selectedUserId, user.name, accessLevel, currentUser.id, currentUser.name)
    setShares(getMatterShares(matterId))
    setSelectedUserId("")
    setAccessLevel("READ_ONLY")
    onShareComplete()
  }

  const handleRemoveShare = (shareId: string) => {
    removeMatterShare(shareId)
    setShares(getMatterShares(matterId))
    onShareComplete()
  }

  const handleUpdateAccess = (shareId: string, newLevel: MatterAccessLevel) => {
    updateMatterShareAccess(shareId, newLevel)
    setShares(getMatterShares(matterId))
    onShareComplete()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Matter</DialogTitle>
          <DialogDescription>Grant access to team members with read-only or write permissions</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Add New Share */}
          <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team member" />
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
              <Label htmlFor="access">Access Level</Label>
              <Select value={accessLevel} onValueChange={(value) => setAccessLevel(value as MatterAccessLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="READ_ONLY">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>Read Only - View only, no edits</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="WRITE">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      <span>Write - Can edit and update</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleShare} disabled={!selectedUserId} className="w-full">
              Share Matter
            </Button>
          </div>

          {/* Existing Shares */}
          {shares.length > 0 && (
            <div className="space-y-2">
              <Label>Shared With</Label>
              <div className="space-y-2">
                {shares.map((share) => {
                  const user = mockUsers.find((u) => u.id === share.userId)
                  return (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{share.userName}</div>
                          <div className="text-xs text-muted-foreground">
                            Shared by {share.sharedByName} on {format(share.sharedAt, "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={share.accessLevel}
                          onValueChange={(value) => handleUpdateAccess(share.id, value as MatterAccessLevel)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="READ_ONLY">Read Only</SelectItem>
                            <SelectItem value="WRITE">Write</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveShare(share.id)}
                          className="text-destructive"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




