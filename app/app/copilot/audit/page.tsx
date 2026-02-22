"use client"

import { useState, useEffect } from "react"
import { getAuditLog } from "@/lib/mock/copilot"
import type { CopilotAuditEntry } from "@/lib/types/copilot"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function CopilotAuditPage() {
  const [entries, setEntries] = useState<CopilotAuditEntry[]>([])
  const [selected, setSelected] = useState<CopilotAuditEntry | null>(null)

  useEffect(() => {
    setEntries(getAuditLog(100))
  }, [])

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Copilot Audit Log</h1>
              <p className="text-muted-foreground">Action history for Copilot (proposed, approved, executed)</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent actions</CardTitle>
            <CardDescription>All Copilot tool executions and approvals. Click a row for details.</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No audit entries yet. Use Copilot to create tasks or events and they will appear here.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelected(e)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant={e.action === "executed" ? "default" : e.action === "failed" ? "destructive" : "secondary"}>
                          {e.action}
                        </Badge>
                        <span className="font-medium text-sm">{e.toolName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {e.userId} · {format(e.timestamp, "PPp")}
                      </span>
                    </div>
                    {e.payload && Object.keys(e.payload).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {JSON.stringify(e.payload)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Audit entry: {selected?.id}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Action:</span> {selected.action}
                </div>
                <div>
                  <span className="text-muted-foreground">Tool:</span> {selected.toolName}
                </div>
                <div>
                  <span className="text-muted-foreground">User:</span> {selected.userId}
                </div>
                <div>
                  <span className="text-muted-foreground">Time:</span> {format(selected.timestamp, "PPpp")}
                </div>
                {selected.payload && Object.keys(selected.payload).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Payload:</span>
                    <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-auto max-h-40">
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </div>
                )}
                {selected.result !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Result:</span>
                    <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-auto max-h-40">
                      {JSON.stringify(selected.result, null, 2)}
                    </pre>
                  </div>
                )}
                {selected.error && (
                  <div className="text-destructive">
                    <span className="text-muted-foreground">Error:</span> {selected.error}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
