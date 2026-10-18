"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { apiFetch } from "@/lib/api/client"
import { listMatters } from "@/lib/api/matters"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileSignature, Loader2, Plus } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface ESignEnvelope {
  id: string
  documentName: string
  subject: string
  status: string
  matterId?: string | null
  sentAt?: string | null
  completedAt?: string | null
}

export default function ESignPage() {
  const { activeTenantId } = useTenant()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [matterId, setMatterId] = useState(searchParams.get("matterId") ?? "")
  const [docName, setDocName] = useState("")
  const [signerEmail, setSignerEmail] = useState("")
  const [signerName, setSignerName] = useState("")
  const [creating, setCreating] = useState(false)

  const { data: matters = [] } = useApiData(
    ["esign-matters", activeTenantId],
    {
      apiFn: () => listMatters(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: envelopes = [], refetch, isLoading } = useApiData<ESignEnvelope[]>(
    ["esign-envelopes", activeTenantId, matterId],
    {
      apiFn: () =>
        apiFetch<ESignEnvelope[]>(
          `/esign/envelopes${matterId ? `?matterId=${matterId}` : ""}`,
          { tenantId: activeTenantId! },
        ),
      enabled: !!activeTenantId,
    },
  )

  const createEnvelope = async () => {
    if (!activeTenantId || !docName || !signerEmail) return
    setCreating(true)
    try {
      await apiFetch("/esign/envelopes", {
        method: "POST",
        tenantId: activeTenantId,
        body: {
          matterId: matterId || undefined,
          documentName: docName,
          subject: `Please sign: ${docName}`,
          signers: [{ name: signerName || signerEmail, email: signerEmail }],
        },
      })
      toast({ title: "Envelope sent" })
      setDocName("")
      refetch()
    } catch {
      toast({ title: "Failed to send envelope", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileSignature className="h-6 w-6" />
          eSign envelopes
        </h1>
        <p className="text-muted-foreground mt-1">Send documents for signature across all matters.</p>
      </div>

      <Card data-tour="esign-create">
        <CardHeader>
          <CardTitle className="text-base">New envelope</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Matter (optional)</Label>
            <Select value={matterId || "__none__"} onValueChange={(v) => setMatterId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All matters" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No matter</SelectItem>
                {matters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document name</Label>
            <Input value={docName} onChange={(e) => setDocName(e.target.value)} />
          </div>
          <div>
            <Label>Signer name</Label>
            <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
          </div>
          <div>
            <Label>Signer email</Label>
            <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={createEnvelope} disabled={creating || !docName || !signerEmail}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Send for signature
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envelopes</CardTitle>
          <CardDescription>{isLoading ? "Loading…" : `${envelopes.length} envelope(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {envelopes.map((env) => (
            <div key={env.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div>
                <p className="font-medium text-sm">{env.documentName}</p>
                <p className="text-xs text-muted-foreground">{env.subject}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline">{env.status}</Badge>
                {env.sentAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(env.sentAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
