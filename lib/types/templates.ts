export interface DocumentTemplate {
  id: string
  name: string
  content: string // Rich text/HTML content
  category: "CLIENT_DOCUMENT" | "GENERAL_TEMPLATE"
  clientId?: string
  clientName?: string
  matterId?: string
  matterTitle?: string
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
  tags?: string[]
  description?: string
}

export interface TemplateCategory {
  name: string
  templates: DocumentTemplate[]
}




