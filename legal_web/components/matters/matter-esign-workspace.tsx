"use client"

import { useState } from "react"
import { format } from "date-fns"
import { FileSignature, Loader2, Plus, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api/client"
import { useApiData } from "@/lib/hooks/use-api-data"

interface ESignEnvelope {
  id: string
  documentName: string
  subject: string
  status: string
  sentAt?: string | null
}

export function MatterESignWorkspace({
  tenantId,
  matterId,
  initialDocumentName = "",
}: {
  tenantId: string
  matterId: string
  initialDocumentName?: string
}) {
  const { toast } = useToast()
  const [documentName, setDocumentName] = useState(initialDocumentName)
  const [signerEmail, setSignerEmail] = useState("")
  const [signerName, setSignerName] = useState("")
  const [creating, setCreating] = useState(false)
  const {
    data: envelopes = [],
    isLoading,
    isError,
    refetch,
  } = useApiData<ESignEnvelope[]>(["esign-envelopes", tenantId, matterId], {
    apiFn: () =>
      apiFetch<ESignEnvelope[]>(`/esign/envelopes?matterId=${encodeURIComponent(matterId)}`, {
        tenantId,
      }),
    enabled: !!tenantId && !!matterId,
  })

  const createEnvelope = async () => {
    if (!documentName.trim() || !signerEmail.trim()) return
    setCreating(true)
    try {
      await apiFetch("/esign/envelopes", {
        method: "POST",
        tenantId,
        body: {
          matterId,
          documentName: documentName.trim(),
          subject: `Please sign: ${documentName.trim()}`,
          signers: [{ name: signerName.trim() || signerEmail.trim(), email: signerEmail.trim() }],
        },
      })
      setDocumentName("")
      setSignerEmail("")
      setSignerName("")
      await refetch()
      toast({ title: "Envelope sent" })
    } catch {
      toast({ title: "Failed to send envelope", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            New envelope
          </CardTitle>
          <CardDescription>Send a document from this matter for signature.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="esign-document-name">Document name</Label>
            <Input
              id="esign-document-name"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="esign-signer-name">Signer name</Label>
            <Input
              id="esign-signer-name"
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="esign-signer-email">Signer email</Label>
            <Input
              id="esign-signer-email"
              type="email"
              value={signerEmail}
              onChange={(event) => setSignerEmail(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              onClick={() => void createEnvelope()}
              disabled={creating || !documentName.trim() || !signerEmail.trim()}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Send for signature
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envelopes</CardTitle>
          <CardDescription>{isLoading ? "Loading envelopes…" : `${envelopes.length} envelope(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2" aria-label="Loading signature envelopes">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-14" />)}
            </div>
          ) : isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive">Signature envelopes could not be loaded.</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : envelopes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No signature envelopes for this matter yet.
            </p>
          ) : (
            <div className="space-y-3">
              {envelopes.map((envelope) => (
                <div
                  key={envelope.id}
                  className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{envelope.documentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{envelope.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <Badge variant="outline">{envelope.status}</Badge>
                    {envelope.sentAt && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(envelope.sentAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
