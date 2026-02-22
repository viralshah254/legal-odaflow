"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getFirmSettings, updateFirmSettings } from "@/lib/mock/firm-settings"

interface FirmProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
}

export function FirmProfileDialog({ open, onOpenChange, onSave }: FirmProfileDialogProps) {
  const settings = getFirmSettings()
  const [firmName, setFirmName] = useState(settings.firmName)
  const [industry, setIndustry] = useState(settings.industry)
  const [location, setLocation] = useState(settings.location)
  const [description, setDescription] = useState(settings.description || "")

  useEffect(() => {
    if (open) {
      const currentSettings = getFirmSettings()
      setFirmName(currentSettings.firmName)
      setIndustry(currentSettings.industry)
      setLocation(currentSettings.location)
      setDescription(currentSettings.description || "")
    }
  }, [open])

  const handleSave = () => {
    updateFirmSettings({
      firmName,
      industry,
      location,
      description: description || undefined,
    })
    onSave?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Firm Profile</DialogTitle>
          <DialogDescription>Update your firm information and branding</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="firmName">Firm Name *</Label>
            <Input
              id="firmName"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry *</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of your firm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

