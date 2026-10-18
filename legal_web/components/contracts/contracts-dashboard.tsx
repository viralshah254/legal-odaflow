"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Plus,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ReviewWorkspace } from "@/components/document-review/review-workspace"

// ── Types ──────────────────────────────────────────────────────────────────

type ContractStatus = "active" | "expired" | "expiring_soon" | "draft"

interface ContractSummary {
  id: string
  workspaceId: string
  title: string
  parties: string[]
  status: ContractStatus
  expiryDate?: string
  obligationCounts?: { active: number; overdue: number; total: number }
  riskLevel?: "low" | "medium" | "high" | "critical"
  createdAt: string
}

interface ContractsListResponse {
  contracts: ContractSummary[]
  total: number
}

// ── Status badge ────────────────────────────────────────────────────────────

function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, { cls: string; label: string; icon: React.ReactNode }> = {
    active: {
      cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
      label: "Active",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    expired: {
      cls: "bg-secondary text-secondary-foreground",
      label: "Expired",
      icon: <Clock className="h-3 w-3" />,
    },
    expiring_soon: {
      cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
      label: "Expiring Soon",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    draft: {
      cls: "bg-secondary text-secondary-foreground",
      label: "Draft",
      icon: <FileText className="h-3 w-3" />,
    },
  }
  const { cls, label, icon } = map[status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", cls)}>
      {icon}
      {label}
    </span>
  )
}

function RiskDot({ level }: { level?: "low" | "medium" | "high" | "critical" }) {
  if (!level) return null
  const map: Record<string, string> = {
    low: "bg-emerald-500",
    medium: "bg-amber-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  }
  return (
    <span
      className={cn("h-2 w-2 rounded-full shrink-0", map[level])}
      title={`Risk: ${level}`}
    />
  )
}

// ── Contract row ────────────────────────────────────────────────────────────

function ContractRow({
  contract,
  selected,
  onClick,
}: {
  contract: ContractSummary
  selected: boolean
  onClick: () => void
}) {
  const expiry = contract.expiryDate ? new Date(contract.expiryDate) : null
  const daysUntilExpiry = expiry
    ? Math.ceil((expiry.getTime() - Date.now()) / 86400_000)
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/40 transition-colors border-b last:border-b-0",
        selected ? "bg-primary/5 border-l-2 border-l-primary" : "",
      )}
    >
      <RiskDot level={contract.riskLevel} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{contract.title}</p>
        {contract.parties.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {contract.parties.join(" · ")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {contract.obligationCounts && contract.obligationCounts.overdue > 0 && (
          <span className="text-xs text-red-600 font-medium">
            {contract.obligationCounts.overdue} overdue
          </span>
        )}
        {daysUntilExpiry !== null && daysUntilExpiry <= 90 && daysUntilExpiry >= 0 && (
          <span className={cn(
            "text-xs",
            daysUntilExpiry <= 30 ? "text-red-600 font-medium" : "text-amber-600",
          )}>
            {daysUntilExpiry}d left
          </span>
        )}
        <ContractStatusBadge status={contract.status} />
      </div>
    </button>
  )
}

// ── Upload modal ────────────────────────────────────────────────────────────

function UploadContractButton({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("tenantId", tenantId)
      formData.append("documentType", "CONTRACT")
      return apiFetch<{ workspaceId: string }>("/platform/document-review/upload", {
        method: "POST",
        body: formData,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contracts", tenantId] })
      toast({ title: "Contract uploaded and review started." })
    },
    onError: () => {
      toast({ title: "Upload failed.", variant: "destructive" })
    },
  })

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) uploadMutation.mutate(file)
      e.target.value = ""
    },
    [uploadMutation],
  )

  return (
    <label className="cursor-pointer">
      <Button size="sm" asChild disabled={uploadMutation.isPending}>
        <span>
          {uploadMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1.5" />
          )}
          Upload Contract
        </span>
      </Button>
      <input
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.doc,.txt"
        onChange={handleFileChange}
      />
    </label>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function ContractsDashboard({ tenantId }: { tenantId: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["contracts", tenantId, statusFilter],
    queryFn: () =>
      apiFetch<ContractsListResponse>(
        `/platform/document-review/contracts?tenantId=${tenantId}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`,
      ),
  })

  const filteredContracts = (data?.contracts ?? []).filter(
    (c) =>
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.parties.some((p) => p.toLowerCase().includes(search.toLowerCase())),
  )

  const stats = {
    total: data?.total ?? 0,
    active: data?.contracts.filter((c) => c.status === "active").length ?? 0,
    expiringSoon: data?.contracts.filter((c) => c.status === "expiring_soon").length ?? 0,
    totalOverdue: data?.contracts.reduce((sum, c) => sum + (c.obligationCounts?.overdue ?? 0), 0) ?? 0,
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-tour="contracts-dashboard">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold">Contracts</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.total} contract{stats.total !== 1 ? "s" : ""}
                {stats.expiringSoon > 0 && ` · ${stats.expiringSoon} expiring soon`}
                {stats.totalOverdue > 0 && ` · `}
                {stats.totalOverdue > 0 && (
                  <span className="text-red-600 font-medium">{stats.totalOverdue} overdue obligations</span>
                )}
              </p>
            </div>
            <UploadContractButton tenantId={tenantId} />
          </div>

          {/* Summary stat pills */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {[
              { label: `${stats.active} active`, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
              { label: `${stats.expiringSoon} expiring`, cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
              { label: `${stats.totalOverdue} overdue`, cls: stats.totalOverdue > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-secondary text-secondary-foreground" },
            ].map((s) => (
              <span key={s.label} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", s.cls)}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Contract list */}
        <div className={cn(
          "flex flex-col border-r",
          selectedWorkspaceId ? "hidden lg:flex w-80 xl:w-96 shrink-0" : "flex-1",
        )}>
          {/* Filters */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
            <Input
              placeholder="Search contracts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
                <FileText className="h-8 w-8 opacity-30 mx-auto" />
                <p>No contracts found.</p>
                <p className="text-xs">Upload a contract to get started.</p>
              </div>
            ) : (
              filteredContracts.map((contract) => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  selected={selectedWorkspaceId === contract.workspaceId}
                  onClick={() =>
                    setSelectedWorkspaceId((prev) =>
                      prev === contract.workspaceId ? null : contract.workspaceId,
                    )
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Review workspace panel */}
        {selectedWorkspaceId && (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <ReviewWorkspace workspaceId={selectedWorkspaceId} tenantId={tenantId} />
          </div>
        )}

        {!selectedWorkspaceId && filteredContracts.length > 0 && (
          <div className="hidden lg:flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a contract to view its review workspace
          </div>
        )}
      </div>
    </div>
  )
}
