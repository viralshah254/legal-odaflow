"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { clientsApi } from "@/lib/mock-api"
import { formatDate } from "@/lib/utils"
import type { Client } from "@/lib/types"
import { Plus, Search } from "lucide-react"

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    async function loadClients() {
      setLoading(true)
      const data = await clientsApi.listClients({ search: searchQuery })
      setClients(data)
      setLoading(false)
    }
    loadClients()
  }, [searchQuery])

  const getKYCStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "default"
      case "UPLOADED":
        return "secondary"
      case "MISSING":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage your clients and their information</p>
        </div>
        <Button onClick={() => router.push("/app/clients/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Client
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading clients...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No clients found</p>
          <Button onClick={() => router.push("/app/clients/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Client
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/app/clients/${client.id}`)}
                >
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.type}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={getKYCStatusColor(client.kycStatus)}>
                      {client.kycStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(client.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/app/clients/${client.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

