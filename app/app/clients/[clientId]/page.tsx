"use client"

import { use } from "react"
import { getClientById, mockClients, Client } from "@/lib/mock/clients"
import { getKycChecklist, updateKycDocument } from "@/lib/mock/kyc"
import { getMattersByOwner, mockMatters } from "@/lib/mock/matters"
import { KycChecklistCard } from "@/components/dashboard/kyc-checklist-card"
import { KycUploadTable } from "@/components/dashboard/kyc-upload-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MattersTableMini } from "@/components/dashboard/matters-table-mini"
import { Building2, User, Mail, Phone, MapPin, FileText } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const client = getClientById(clientId)
  
  if (!client) {
    notFound()
  }

  const kycChecklist = getKycChecklist(clientId)
  const clientMatters = mockMatters.filter((m) => m.clientId === clientId)

  const handleKycUpdate = (docId: string, updates: Partial<import("@/lib/types/kyc").KycDocument>) => {
    updateKycDocument(clientId, docId, updates)
    // Force re-render by updating state (in a real app, this would be handled by state management)
    window.location.reload()
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{client.name}</h1>
        <p className="text-muted-foreground">{client.type} Client</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kyc">KYC & Compliance</TabsTrigger>
          <TabsTrigger value="matters">Matters</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Type</div>
                    <div className="font-medium">{client.type}</div>
                  </div>
                </div>
                {client.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Email</div>
                      <div className="font-medium">{client.email}</div>
                    </div>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Phone</div>
                      <div className="font-medium">{client.phone}</div>
                    </div>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Address</div>
                      <div className="font-medium">{client.address}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {kycChecklist && (
              <KycChecklistCard checklist={kycChecklist} clientName={client.name} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="kyc" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>KYC Documents</CardTitle>
              <CardDescription>
                Upload and manage KYC documents for {client.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kycChecklist ? (
                <KycUploadTable
                  documents={kycChecklist.documents}
                  onUpdate={handleKycUpdate}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No KYC checklist found. Please initialize KYC for this client.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matters" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Related Matters</CardTitle>
              <CardDescription>All matters associated with this client</CardDescription>
            </CardHeader>
            <CardContent>
              {clientMatters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No matters found for this client
                </div>
              ) : (
                <MattersTableMini matters={clientMatters} showOwner={true} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
