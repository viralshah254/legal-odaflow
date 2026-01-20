"use client"

import { useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { mockClients, Client } from "@/lib/mock/clients"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Users, Building2, User, FileText, AlertCircle } from "lucide-react"
import Link from "next/link"
import { getKycChecklist } from "@/lib/mock/kyc"
import { cn } from "@/lib/utils"

export default function ClientsPage() {
  const { currentRole } = useRole()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredClients = mockClients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getClientTypeIcon = (type: Client["type"]) => {
    switch (type) {
      case "Company":
        return <Building2 className="h-4 w-4" />
      case "Individual":
        return <User className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getKycStatusBadge = (status: Client["kycStatus"]) => {
    const variants: Record<Client["kycStatus"], { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      VERIFIED: { variant: "default", className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" },
      PENDING_VERIFICATION: { variant: "secondary", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
      INCOMPLETE: { variant: "destructive", className: "" },
      EXPIRED: { variant: "destructive", className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
    }
    return variants[status]
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Clients</h1>
          <p className="text-muted-foreground">Manage your client relationships</p>
        </div>
        <Link href="/app/clients/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No clients found</p>
            <Link href="/app/clients/new">
              <Button>Add Your First Client</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const kycChecklist = getKycChecklist(client.id)
            const missingKyc = kycChecklist?.documents.filter((d) => d.status === "MISSING").length || 0
            const statusBadge = getKycStatusBadge(client.kycStatus)

            return (
              <Link key={client.id} href={`/app/clients/${client.id}`}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {getClientTypeIcon(client.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{client.name}</CardTitle>
                          <CardDescription className="text-xs">{client.type}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={statusBadge.variant} className={cn("text-xs shrink-0", statusBadge.className)}>
                        {client.kycStatus.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {client.email && (
                        <div className="text-muted-foreground truncate">{client.email}</div>
                      )}
                      {client.phone && (
                        <div className="text-muted-foreground">{client.phone}</div>
                      )}
                      {missingKyc > 0 && (
                        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mt-3 pt-3 border-t">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">{missingKyc} KYC document{missingKyc > 1 ? "s" : ""} missing</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
