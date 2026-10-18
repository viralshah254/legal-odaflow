"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import {
  createMonitor,
  MONITOR_TOPICS,
  MONITOR_JURISDICTIONS,
  type CreateMonitorPayload,
} from "@/lib/api/monitors"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useToast } from "@/hooks/use-toast"

interface CreateMonitorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateMonitorDialog({ open, onOpenChange, onCreated }: CreateMonitorDialogProps) {
  const { activeTenantId } = useTenant()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<CreateMonitorPayload>>({
    frequency: "DAILY",
    topics: [],
  })

  const toggleTopic = (topicId: string) => {
    const current = form.topics ?? []
    setForm((f) => ({
      ...f,
      topics: current.includes(topicId)
        ? current.filter((t) => t !== topicId)
        : [...current, topicId],
    }))
  }

  const handleSubmit = async () => {
    if (!activeTenantId || !form.name || !form.jurisdiction || !form.topics?.length) {
      toast({ title: "Please fill in all required fields", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      await createMonitor(activeTenantId, form as CreateMonitorPayload)
      toast({ title: "Monitor created", description: "First scan will run within 24 hours." })
      onCreated()
      onOpenChange(false)
      setForm({ frequency: "DAILY", topics: [] })
    } catch {
      toast({ title: "Failed to create monitor", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Regulatory Monitor</DialogTitle>
          <DialogDescription>
            Set up an always-on scan for regulatory changes in a jurisdiction and topic area.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Monitor name *</Label>
            <Input
              placeholder="e.g. India Data Privacy Updates"
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Optional context about what this monitor is tracking"
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Jurisdiction *</Label>
              <Select
                value={form.jurisdiction ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, jurisdiction: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {MONITOR_JURISDICTIONS.map((j) => (
                    <SelectItem key={j.code} value={j.code}>{j.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Scan frequency</Label>
              <Select
                value={form.frequency ?? "DAILY"}
                onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as "DAILY" | "WEEKLY" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Topics * <span className="text-muted-foreground text-xs">(select at least one)</span></Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {MONITOR_TOPICS.map((topic) => (
                <div key={topic.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`topic-${topic.id}`}
                    checked={(form.topics ?? []).includes(topic.id)}
                    onCheckedChange={() => toggleTopic(topic.id)}
                  />
                  <label
                    htmlFor={`topic-${topic.id}`}
                    className="text-sm cursor-pointer leading-tight"
                  >
                    {topic.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create monitor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
