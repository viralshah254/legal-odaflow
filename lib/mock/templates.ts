import { DocumentTemplate } from "@/lib/types/templates"

export const mockTemplates: DocumentTemplate[] = [
  {
    id: "template-1",
    name: "Client Engagement Letter",
    content: "<h1>Client Engagement Letter</h1><p>Dear [Client Name],</p><p>This letter confirms our engagement...</p>",
    category: "GENERAL_TEMPLATE",
    createdBy: "1",
    createdByName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    tags: ["engagement", "letter", "client"],
    description: "Standard client engagement letter template",
  },
  {
    id: "template-2",
    name: "Contract Review Checklist",
    content: "<h1>Contract Review Checklist</h1><ul><li>Review terms and conditions</li><li>Check for compliance issues</li></ul>",
    category: "GENERAL_TEMPLATE",
    createdBy: "1",
    createdByName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    tags: ["contract", "checklist", "review"],
    description: "Standard contract review checklist",
  },
  {
    id: "template-3",
    name: "Acme Corp - M&A Terms",
    content: "<h1>M&A Transaction Terms</h1><p>Specific terms for Acme Corp transaction...</p>",
    category: "CLIENT_DOCUMENT",
    clientId: "c1",
    clientName: "Acme Corporation",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    createdBy: "1",
    createdByName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    tags: ["m&a", "acme"],
    description: "Client-specific M&A terms document",
  },
]

export function getTemplatesByCategory(category: "CLIENT_DOCUMENT" | "GENERAL_TEMPLATE"): DocumentTemplate[] {
  return mockTemplates.filter((t) => t.category === category)
}

export function getTemplatesByClient(clientId: string): DocumentTemplate[] {
  return mockTemplates.filter((t) => t.clientId === clientId)
}

export function getTemplatesByMatter(matterId: string): DocumentTemplate[] {
  return mockTemplates.filter((t) => t.matterId === matterId)
}

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return mockTemplates.find((t) => t.id === id)
}

export function createTemplate(template: Omit<DocumentTemplate, "id" | "createdAt" | "updatedAt">): DocumentTemplate {
  // Check for duplicate names
  const existing = mockTemplates.find((t) => t.name === template.name && t.category === template.category)
  if (existing) {
    throw new Error(`Template with name "${template.name}" already exists in this category`)
  }

  const newTemplate: DocumentTemplate = {
    ...template,
    id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  mockTemplates.push(newTemplate)
  return newTemplate
}

export function updateTemplate(id: string, updates: Partial<DocumentTemplate>): DocumentTemplate | null {
  const template = mockTemplates.find((t) => t.id === id)
  if (!template) return null

  // Check for duplicate names if name is being changed
  if (updates.name && updates.name !== template.name) {
    const existing = mockTemplates.find(
      (t) => t.name === updates.name && t.category === (updates.category || template.category) && t.id !== id
    )
    if (existing) {
      throw new Error(`Template with name "${updates.name}" already exists in this category`)
    }
  }

  Object.assign(template, updates)
  template.updatedAt = new Date()
  return template
}

export function deleteTemplate(id: string): boolean {
  const index = mockTemplates.findIndex((t) => t.id === id)
  if (index !== -1) {
    mockTemplates.splice(index, 1)
    return true
  }
  return false
}

export function checkTemplateNameExists(name: string, category: "CLIENT_DOCUMENT" | "GENERAL_TEMPLATE", excludeId?: string): boolean {
  return mockTemplates.some(
    (t) => t.name === name && t.category === category && (!excludeId || t.id !== excludeId)
  )
}




