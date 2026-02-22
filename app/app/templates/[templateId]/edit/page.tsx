"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RichTextEditor } from "@/components/editor/simple-rich-text-editor"
import { getTemplateById, updateTemplate, checkTemplateNameExists } from "@/lib/mock/templates"
import type { DocumentTemplate } from "@/lib/types/templates"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.templateId as string

  const [template, setTemplate] = useState<DocumentTemplate | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [content, setContent] = useState("<p></p>")
  const [nameError, setNameError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const found = getTemplateById(templateId)
    if (found) {
      setTemplate(found)
      setName(found.name)
      setDescription(found.description || "")
      setContent(found.content || "<p></p>")
    }
  }, [templateId])

  const handleSave = () => {
    if (!name.trim()) {
      setNameError("Name is required")
      return
    }

    if (template && name !== template.name && checkTemplateNameExists(name, template.category, templateId)) {
      setNameError("A template with this name already exists in this category")
      return
    }

    if (!template) return

    setSaving(true)
    try {
      updateTemplate(templateId, {
        name: name.trim(),
        description: description.trim() || undefined,
        content,
      })
      router.push("/app/templates")
    } catch (error: any) {
      setNameError(error.message || "Failed to update template")
    } finally {
      setSaving(false)
    }
  }

  if (!template) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Template not found</p>
            <Link href="/app/templates">
              <Button variant="outline" className="mt-4">
                Back to Templates
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Template</h1>
            <p className="text-muted-foreground">{template.name}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setNameError("")
                  }}
                  placeholder="Template name"
                />
                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>Edit your template content using the rich text editor</CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor content={content} onChange={setContent} placeholder="Start typing..." />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <div className="mt-1">
                  <Badge variant="outline">
                    {template.category === "GENERAL_TEMPLATE" ? "General Template" : "Client Document"}
                  </Badge>
                </div>
              </div>
              {template.clientName && (
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p className="mt-1 font-medium">{template.clientName}</p>
                </div>
              )}
              {template.matterTitle && (
                <div>
                  <Label className="text-muted-foreground">Matter</Label>
                  <p className="mt-1 font-medium">{template.matterTitle}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Created By</Label>
                <p className="mt-1 font-medium">{template.createdByName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created At</Label>
                <p className="mt-1 text-sm">{format(template.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Last Updated</Label>
                <p className="mt-1 text-sm">{format(template.updatedAt, "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

