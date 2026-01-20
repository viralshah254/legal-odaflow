"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient, ClientType } from "@/lib/mock/clients"
import { initializeKycForClient, updateKycDocument } from "@/lib/mock/kyc"
import { getRequiredKycDocsForClientType, KycDocType } from "@/lib/types/kyc"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KycUploadTable } from "@/components/dashboard/kyc-upload-table"
import { ArrowLeft, ArrowRight, Save } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function NewClientPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [clientType, setClientType] = useState<ClientType>("Individual")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    country: "Kenya",
  })
  const [kycChecklist, setKycChecklist] = useState<ReturnType<typeof initializeKycForClient> | null>(null)

  const handleClientTypeChange = (type: ClientType) => {
    setClientType(type)
    // Initialize KYC checklist when type changes
    const tempClientId = "temp"
    const checklist = initializeKycForClient(tempClientId, type)
    setKycChecklist(checklist)
  }

  const handleKycUpdate = (docId: string, updates: Partial<import("@/lib/types/kyc").KycDocument>) => {
    if (!kycChecklist) return
    const tempClientId = "temp"
    updateKycDocument(tempClientId, docId, updates)
    const updated = initializeKycForClient(tempClientId, clientType)
    setKycChecklist(updated)
  }

  const handleSubmit = () => {
    // Create client
    const newClient = createClient({
      ...formData,
      type: clientType,
    })

    // Initialize KYC for the new client
    initializeKycForClient(newClient.id, clientType)
    
    // Copy KYC documents from temp checklist if any were uploaded
    if (kycChecklist) {
      kycChecklist.documents.forEach((doc) => {
        if (doc.status !== "MISSING") {
          updateKycDocument(newClient.id, doc.id.replace("temp", newClient.id), {
            docType: doc.docType,
            fileName: doc.fileName,
            uploadedAt: doc.uploadedAt,
            status: doc.status,
          })
        }
      })
    }

    router.push(`/app/clients/${newClient.id}`)
  }

  const canProceedToKyc = formData.name.trim() !== ""

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/app/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold mb-2">Add New Client</h1>
          <p className="text-muted-foreground">Create a new client profile with mandatory KYC</p>
        </div>
      </div>

      <Tabs value={step.toString()} onValueChange={(v) => setStep(parseInt(v))} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="1" disabled={step < 1}>Client Details</TabsTrigger>
          <TabsTrigger value="2" disabled={step < 2 || !canProceedToKyc}>Contacts</TabsTrigger>
          <TabsTrigger value="3" disabled={step < 3 || !canProceedToKyc}>KYC Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="1" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>Basic client details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-type">Client Type *</Label>
                <Select value={clientType} onValueChange={(value) => handleClientTypeChange(value as ClientType)}>
                  <SelectTrigger id="client-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="NGO">NGO</SelectItem>
                    <SelectItem value="Partnership">Partnership</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter client name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!canProceedToKyc}>
                  Next: Contacts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="2" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Client contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+254 700 000 000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Street address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setStep(3)}>
                  Next: KYC Checklist
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="3" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>KYC Checklist (Required)</CardTitle>
              <CardDescription>
                Upload required KYC documents for {clientType} client type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {kycChecklist ? (
                <KycUploadTable
                  documents={kycChecklist.documents}
                  onUpdate={handleKycUpdate}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Please select a client type first
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleSubmit}>
                  <Save className="mr-2 h-4 w-4" />
                  Create Client
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
