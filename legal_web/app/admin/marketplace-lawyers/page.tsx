"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listAdminMarketplaceLawyers,
  updateAdminMarketplaceLawyerVerification,
  type AdminMarketplaceLawyer,
} from "@/lib/api/admin"
import { CheckCircle2, Loader2, Search, ShieldCheck, ShieldOff, Scale } from "lucide-react"

const COUNTRY_OPTIONS = [
  { value: "all", label: "All countries" },
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "KE", label: "Kenya" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending verification" },
  { value: "verified", label: "Verified" },
]

function practiceAreaLabels(areas: unknown): string {
  if (!Array.isArray(areas)) return "—"
  return areas.slice(0, 3).join(", ") || "—"
}

export default function AdminMarketplaceLawyersPage() {
  const [profiles, setProfiles] = useState<AdminMarketplaceLawyer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState("all")
  const [status, setStatus] = useState("pending")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const rows = await listAdminMarketplaceLawyers({
        countryCode: country === "all" ? undefined : country,
        verified: status === "verified" ? true : status === "pending" ? false : undefined,
        q: query.trim() || undefined,
      })
      setProfiles(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load marketplace lawyers")
    } finally {
      setLoading(false)
    }
  }, [country, status, query])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  const stats = useMemo(() => {
    const verified = profiles.filter((p) => p.verified).length
    const pending = profiles.filter((p) => !p.verified).length
    return { verified, pending, total: profiles.length }
  }, [profiles])

  const handleToggleVerification = async (profile: AdminMarketplaceLawyer) => {
    setUpdatingId(profile.id)
    setError("")
    try {
      await updateAdminMarketplaceLawyerVerification(profile.id, {
        verified: !profile.verified,
      })
      await loadProfiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update verification")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Marketplace Lawyers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verify law firm profiles so they appear in consumer Find a Lawyer.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Shown in list</p>
            <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Verified (directory visible)</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{stats.verified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Pending verification</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or bar number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No marketplace lawyer profiles match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Lawyer</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Firm</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Country</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Practice areas</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{profile.user.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{profile.user.email}</div>
                    {profile.barNumber ? (
                      <div className="text-xs text-muted-foreground mt-0.5">Bar: {profile.barNumber}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>{profile.tenant?.name ?? "—"}</div>
                    {!profile.acceptsLeads && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Not accepting leads
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">{profile.countryCode}</td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {practiceAreaLabels(profile.practiceAreas)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {profile.verified ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" variant="outline">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                        {profile.verificationStatus}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <Button
                      size="sm"
                      variant={profile.verified ? "outline" : "default"}
                      disabled={updatingId === profile.id}
                      onClick={() => void handleToggleVerification(profile)}
                    >
                      {updatingId === profile.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : profile.verified ? (
                        <>
                          <ShieldOff className="h-4 w-4 mr-1.5" />
                          Unverify
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-1.5" />
                          Verify
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
