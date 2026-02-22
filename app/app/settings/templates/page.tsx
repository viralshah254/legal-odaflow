"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, Edit, Trash2, FileText, CheckSquare, Folder } from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"

const mockMatterTypes = [
  { id: "1", name: "M&A Transaction", description: "Mergers and acquisitions", taskCount: 15, docCount: 8 },
  { id: "2", name: "Contract Dispute", description: "Commercial contract disputes", taskCount: 12, docCount: 6 },
  { id: "3", name: "Estate Planning", description: "Wills, trusts, and estate planning", taskCount: 10, docCount: 5 },
  { id: "4", name: "Employment Dispute", description: "Employment law matters", taskCount: 8, docCount: 4 },
  { id: "5", name: "Corporate Formation", description: "Company incorporation and setup", taskCount: 6, docCount: 3 },
]

const mockTaskTemplates = [
  { id: "1", name: "Initial Client Meeting", description: "Schedule and conduct initial consultation", category: "Client Relations" },
  { id: "2", name: "Document Review", description: "Review all relevant documents", category: "Review" },
  { id: "3", name: "Draft Agreement", description: "Draft legal agreement", category: "Drafting" },
  { id: "4", name: "File Court Documents", description: "Prepare and file court documents", category: "Filing" },
  { id: "5", name: "KYC Verification", description: "Complete KYC verification process", category: "Compliance" },
]

export default function TemplatesPage() {
  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Templates</h1>
            <p className="text-muted-foreground">Matter types, workflows, task templates, and document folders</p>
          </div>
        </div>

        <Tabs defaultValue="matter-types" className="w-full">
          <TabsList>
            <TabsTrigger value="matter-types">Matter Types</TabsTrigger>
            <TabsTrigger value="task-templates">Task Templates</TabsTrigger>
            <TabsTrigger value="document-folders">Document Folders</TabsTrigger>
          </TabsList>

          <TabsContent value="matter-types" className="space-y-4 mt-6">
            <div className="flex justify-end">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Matter Type
              </Button>
            </div>
            <div className="grid gap-4">
              {mockMatterTypes.map((type) => (
                <Card key={type.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{type.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{type.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{type.taskCount} tasks</span>
                          <span>{type.docCount} documents</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="task-templates" className="space-y-4 mt-6">
            <div className="flex justify-end">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Task Template
              </Button>
            </div>
            <div className="grid gap-4">
              {mockTaskTemplates.map((template) => (
                <Card key={template.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckSquare className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{template.name}</h3>
                          <Badge variant="outline">{template.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="document-folders" className="space-y-4 mt-6">
            <div className="flex justify-end">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Folder Structure
              </Button>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Folder className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Default Document Structure</h3>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Contracts</p>
                  <p>• Correspondence</p>
                  <p>• Court Documents</p>
                  <p>• KYC Documents</p>
                  <p>• Financial Records</p>
                </div>
                <Button variant="outline" className="mt-4" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Structure
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RoleGate>
  )
}




