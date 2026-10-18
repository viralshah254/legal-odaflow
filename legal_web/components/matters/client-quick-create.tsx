"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"

import { createClient } from "@/lib/api/clients"
import type { ApiClient, CountryCode } from "@/lib/api/types"
import { ApiClientError } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ClientQuickCreate({
  tenantId,
  countryCode,
  onCreated,
}: {
  tenantId: string
  countryCode: CountryCode
  onCreated: (client: ApiClient) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const client = await createClient(tenantId, {
        name: name.trim(),
        email: email.trim() || undefined,
        countryCode,
      })
      onCreated(client)
      setName("")
      setEmail("")
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create client")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create client</DialogTitle>
          <DialogDescription>
            Add the minimum client details now. You can complete the profile later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-client-name">Client name</Label>
            <Input
              id="quick-client-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name or organisation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-client-email">Email (optional)</Label>
            <Input
              id="quick-client-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="client@example.com"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
