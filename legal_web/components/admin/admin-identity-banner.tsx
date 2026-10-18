"use client"

import { Badge } from "@/components/ui/badge"
import type { AdminMe, SuperAdminUser } from "@/lib/api/admin"
import { ShieldCheck, Users2 } from "lucide-react"

const PROFILE_COLORS: Record<string, string> = {
  CTO: "bg-teal-500/10 text-teal-600 border-teal-200",
  CFO_CMO: "bg-blue-500/10 text-blue-600 border-blue-200",
}

const CATEGORY_COLOR: Record<string, string> = {
  CTO: "from-teal-600 to-teal-800",
  CFO_CMO: "from-blue-600 to-blue-800",
}

interface Props {
  me: AdminMe
  peers: SuperAdminUser[]
}

export function AdminIdentityBanner({ me, peers }: Props) {
  const color = PROFILE_COLORS[me.adminProfile ?? ""] ?? "bg-primary/10 text-primary border-primary/20"
  const gradient = CATEGORY_COLOR[me.adminProfile ?? ""] ?? "from-primary to-primary/80"

  const otherAdmins = peers.filter((p) => p.id !== me.id && p.isActive)

  return (
    <div className={`rounded-xl bg-gradient-to-r ${gradient} p-5 text-white shadow-md`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              Super Admin
            </p>
            <h2 className="text-lg font-bold text-white leading-tight">
              {me.name ?? me.email}
            </h2>
            <p className="text-sm text-white/80">{me.displayTitle}</p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Badge
            variant="outline"
            className={`${color} border font-semibold text-xs`}
          >
            {me.adminProfile ?? "SUPER_ADMIN"}
          </Badge>
          <p className="text-xs text-white/60">{me.email}</p>
        </div>
      </div>

      {otherAdmins.length > 0 && (
        <div className="mt-4 flex items-center gap-2 border-t border-white/20 pt-3">
          <Users2 className="h-3.5 w-3.5 text-white/60" />
          <p className="text-xs text-white/60">
            Team:{" "}
            {otherAdmins.map((a) => a.name ?? a.email).join(", ")}
          </p>
        </div>
      )}
    </div>
  )
}
