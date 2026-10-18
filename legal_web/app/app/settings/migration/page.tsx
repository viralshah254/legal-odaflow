"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getClioMigrationJob, importClioCsv, type ClioMigrationJob } from "@/lib/api/migration"
import { Upload, Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function MigrationSettingsPage() {
  const { activeTenantId } = useTenant()
  const { toast } = useToast()
  const [fileName, setFileName] = useState("")
  const [csvContent, setCsvContent] = useState("")
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [job, setJob] = useState<ClioMigrationJob | null>(null)

  useEffect(() => {
    if (!activeTenantId || !job?.agentJobId) return
    if (job.status === "COMPLETED" || job.status === "FAILED") return

    const timer = setInterval(async () => {
      try {
        const updated = await getClioMigrationJob(activeTenantId, job.agentJobId)
        setJob(updated)
        if (updated.status === "COMPLETED") {
          toast({ title: "Clio import completed" })
        } else if (updated.status === "FAILED") {
          toast({ title: "Clio import failed", variant: "destructive" })
        }
      } catch {
        // ignore transient poll errors
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [activeTenantId, job?.agentJobId, job?.status, toast])

  const onFileChange = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setCsvContent(text)
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    setRowCount(Math.max(0, lines.length - 1))
  }

  const submit = async () => {
    if (!activeTenantId || !csvContent.trim()) return
    setLoading(true)
    try {
      const result = await importClioCsv(activeTenantId, {
        fileName: fileName || "clio-export.csv",
        csvContent,
        rowCount,
        entityTypes: ["clients", "matters", "contacts"],
      })
      setJob(result)
      toast({
        title: result.status === "FAILED" ? "Validation failed" : "Import queued",
        variant: result.status === "FAILED" ? "destructive" : "default",
      })
    } catch {
      toast({ title: "Import failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const refreshJob = async () => {
    if (!activeTenantId || !job?.agentJobId) return
    try {
      setJob(await getClioMigrationJob(activeTenantId, job.agentJobId))
    } catch {
      toast({ title: "Could not refresh job status", variant: "destructive" })
    }
  }

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data migration</h1>
        <p className="text-muted-foreground mt-1">
          Upload a Clio CSV export to import clients, matters, and contacts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clio CSV import</CardTitle>
          <CardDescription>
            Required headers: id, display_name, type. Import runs via BullMQ worker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="clio-csv">CSV file</Label>
            <Input
              id="clio-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
          {rowCount > 0 && (
            <p className="text-sm text-muted-foreground">{rowCount} data rows detected</p>
          )}
          <Button onClick={submit} disabled={loading || !csvContent.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Import from Clio
          </Button>

          {job && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p><strong>Job:</strong> {job.agentJobId || job.jobId}</p>
                {job.agentJobId && job.status !== "COMPLETED" && job.status !== "FAILED" && (
                  <Button variant="ghost" size="sm" onClick={refreshJob}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p><strong>Status:</strong> {job.status}</p>
              <p>{job.message}</p>
              {job.result && (
                <p className="text-muted-foreground">
                  {String(job.result.clientsCreated ?? 0)} clients,{" "}
                  {String(job.result.mattersCreated ?? 0)} matters imported
                </p>
              )}
              {job.validationErrors.length > 0 && (
                <ul className="list-disc pl-4 text-destructive">
                  {job.validationErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
