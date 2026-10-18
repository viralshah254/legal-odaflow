"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminStats, getAdminPresence, type AdminStats, type AdminPresence } from "@/lib/api/admin"
import { Globe } from "lucide-react"

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/50 px-3 py-2 text-center">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</span>
    </div>
  )
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function displaySessionSeconds(
  user: AdminPresence["users"][number],
  now: number,
  presenceFetchedAt: number,
): number {
  if (!user.isOnline) return user.sessionSeconds
  const elapsed = Math.floor((now - presenceFetchedAt) / 1000)
  return user.sessionSeconds + elapsed
}

export function AdminLiveSnapshot() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [presence, setPresence] = useState<AdminPresence | null>(null)
  const [presenceFetchedAt, setPresenceFetchedAt] = useState(() => Date.now())
  const [presenceNow, setPresenceNow] = useState(() => Date.now())

  const loadPresence = useCallback(() => {
    getAdminPresence()
      .then((data) => {
        setPresence(data)
        setPresenceFetchedAt(Date.now())
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {})
    loadPresence()
    const iv = setInterval(loadPresence, 30_000)
    return () => clearInterval(iv)
  }, [loadPresence])

  useEffect(() => {
    const hasOnline = presence?.users.some((u) => u.isOnline)
    if (!hasOnline) return
    const iv = setInterval(() => setPresenceNow(Date.now()), 1_000)
    return () => clearInterval(iv)
  }, [presence?.users])

  const topCountries = presence
    ? Object.entries(presence.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 4)
    : []

  const onlineUsers = (presence?.users.filter((u) => u.isOnline) ?? []).slice(0, 5)

  return (
    <div className="space-y-3">
      {/* Live users */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse"
                aria-hidden="true"
              />
              Live — {presence?.onlineCount ?? 0} online
            </CardTitle>
            <span className="text-[10px] text-muted-foreground">refreshes every 30s</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {onlineUsers.length > 0 && (
            <ul className="space-y-1.5">
              {onlineUsers.map((user) => (
                <li
                  key={user.userId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate font-medium">
                    {user.name?.trim() || user.email}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {fmtDuration(
                      displaySessionSeconds(user, presenceNow, presenceFetchedAt),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {topCountries.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topCountries.map(([country, count]) => (
                <span
                  key={country}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  {country} · {count}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active sessions right now.</p>
          )}
        </CardContent>
      </Card>

      {/* KPI strip */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill label="Total Users" value={stats.totalUsers.toLocaleString()} />
          <StatPill label="Law Firms" value={stats.totalTenants.toLocaleString()} />
          <StatPill label="Matters" value={stats.totalMatters.toLocaleString()} />
          <StatPill label="AI Requests" value={stats.totalAiUsageLogs.toLocaleString()} />
        </div>
      )}
    </div>
  )
}
