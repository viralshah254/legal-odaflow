"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRole } from "@/lib/contexts/role-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2, FileText, Folder, Search } from "lucide-react"
import {
  mockTemplates,
  getTemplatesByCategory,
  getTemplatesByClient,
  getTemplatesByMatter,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  checkTemplateNameExists,
} from "@/lib/mock/templates"
import type { DocumentTemplate } from "@/lib/types/templates"
import { mockClients } from "@/lib/mock/clients"
import { mockMatters } from "@/lib/mock/matters"
import { RichTextEditor } from "@/components/editor/simple-rich-text-editor"
import { format } from "date-fns"
import { useRole as useRoleContext } from "@/lib/contexts/role-context"

export default function TemplatesPage() {
  const router = useRouter()
  const { currentUser } = useRoleContext()
  const [templates, setTemplates] = useState(mockTemplates)
  const [searchQuery, setSearchQuery] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)
  const [activeTab, setActiveTab] = useState<"general" | "client">("general")

  const generalTemplates = getTemplatesByCategory("GENERAL_TEMPLATE")
  const clientTemplates = getTemplatesByCategory("CLIENT_DOCUMENT")

  const filteredGeneralTemplates = generalTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredClientTemplates = clientTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreate = () => {
    setEditingTemplate(null)
    setCreateDialogOpen(true)
  }

  const handleEdit = (template: DocumentTemplate) => {
    setEditingTemplate(template)
    setEditDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplate(id)
      setTemplates([...mockTemplates])
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">Create and manage document templates</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "general" | "client")}>
        <TabsList>
          <TabsTrigger value="general">General Templates</TabsTrigger>
          <TabsTrigger value="client">Client Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-6">
          {filteredGeneralTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No general templates found</p>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGeneralTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      </div>
                      <Badge variant="outline">General</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Created by {template.createdByName}
                        <br />
                        {format(template.createdAt, "MMM d, yyyy")}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/app/templates/${template.id}/edit`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="client" className="space-y-4 mt-6">
          {filteredClientTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No client documents found</p>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Client Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClientTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {template.clientName}
                          {template.matterTitle && ` • ${template.matterTitle}`}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">Client</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Created by {template.createdByName}
                        <br />
                        {format(template.createdAt, "MMM d, yyyy")}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/app/templates/${template.id}/edit`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSave={() => {
          setTemplates([...mockTemplates])
          setCreateDialogOpen(false)
        }}
      />
    </div>
  )
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}) {
  const { currentUser } = useRoleContext()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<"CLIENT_DOCUMENT" | "GENERAL_TEMPLATE">("GENERAL_TEMPLATE")
  const [clientId, setClientId] = useState<string>("")
  const [matterId, setMatterId] = useState<string>("")
  const [content, setContent] = useState("<p></p>")
  const [nameError, setNameError] = useState("")

  const handleSave = () => {
    if (!name.trim()) {
      setNameError("Name is required")
      return
    }

    if (checkTemplateNameExists(name, category)) {
      setNameError("A template with this name already exists in this category")
      return
    }

    if (!currentUser) return

    const templateData = {
      name: name.trim(),
      content,
      category,
      clientId: category === "CLIENT_DOCUMENT" ? clientId : undefined,
      clientName: category === "CLIENT_DOCUMENT" && clientId
        ? mockClients.find((c) => c.id === clientId)?.name
        : undefined,
      matterId: category === "CLIENT_DOCUMENT" ? matterId : undefined,
      matterTitle: category === "CLIENT_DOCUMENT" && matterId
        ? mockMatters.find((m) => m.id === matterId)?.title
        : undefined,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      tags: [],
      description: description.trim() || undefined,
    }

    createTemplate(templateData)
    setName("")
    setDescription("")
    setCategory("GENERAL_TEMPLATE")
    setClientId("")
    setMatterId("")
    setContent("<p></p>")
    setNameError("")
    onSave()
  }

  const selectedClientMatters = matterId ? mockMatters.filter((m) => m.clientId === clientId) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>Create a new document template or client document</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError("")
              }}
              placeholder="e.g., Client Engagement Letter"
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL_TEMPLATE">General Template</SelectItem>
                <SelectItem value="CLIENT_DOCUMENT">Client Document</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {category === "CLIENT_DOCUMENT" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {clientId && (
                <div className="space-y-2">
                  <Label htmlFor="matter">Matter (Optional)</Label>
                  <Select value={matterId} onValueChange={setMatterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select matter (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {selectedClientMatters.map((matter) => (
                        <SelectItem key={matter.id} value={matter.id}>
                          {matter.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the template"
            />
          </div>

          <div className="space-y-2">
            <Label>Content *</Label>
            <RichTextEditor content={content} onChange={setContent} placeholder="Start typing your template content..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || (category === "CLIENT_DOCUMENT" && !clientId)}>
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

