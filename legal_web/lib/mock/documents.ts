import type { DocumentFolder, Document, DocumentVersion } from "@/lib/types/documents"
import { mockClients } from "@/lib/mock/clients"
import { mockMatters } from "@/lib/mock/matters"
import { getMatterById } from "@/lib/mock/matters"

const STORAGE_KEY_FOLDERS = "odaflow_dms_folders"
const STORAGE_KEY_DOCUMENTS = "odaflow_dms_documents"
const STORAGE_KEY_VERSIONS = "odaflow_dms_versions"

function loadFolders(): DocumentFolder[] {
  const root: DocumentFolder = {
    id: "folder-root",
    name: "Firm",
    kind: "firm",
    parentId: null,
    entityId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
  const list: DocumentFolder[] = [root]
  mockClients.forEach((c) => {
    list.push({
      id: `folder-client-${c.id}`,
      name: c.name,
      kind: "client",
      parentId: "folder-root",
      entityId: c.id,
      entityName: c.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })
  })
  mockMatters.forEach((m) => {
    list.push({
      id: `folder-matter-${m.id}`,
      name: m.title,
      kind: "matter",
      parentId: `folder-client-${m.clientId}`,
      entityId: m.id,
      entityName: m.title,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })
  })
  if (typeof window === "undefined") return list
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FOLDERS)
    if (!raw) return list
    const stored = JSON.parse(raw) as DocumentFolder[]
    const merged = new Map(list.map((f) => [f.id, { ...f, createdAt: new Date(f.createdAt), updatedAt: new Date(f.updatedAt) }]))
    stored.forEach((f) => {
      merged.set(f.id, {
        ...f,
        createdAt: new Date(f.createdAt),
        updatedAt: new Date(f.updatedAt),
      })
    })
    return Array.from(merged.values())
  } catch {
    return list
  }
}

const defaultDocs: Document[] = [
  {
    id: "doc-1",
    folderId: "folder-matter-m1",
    currentVersion: 2,
    name: "Due Diligence Checklist",
    matterId: "m1",
    clientId: "c1",
    visibility: "matter",
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "doc-2",
    folderId: "folder-matter-m1",
    currentVersion: 1,
    name: "Engagement Letter.pdf",
    matterId: "m1",
    clientId: "c1",
    visibility: "matter",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "doc-3",
    folderId: "folder-matter-m2",
    currentVersion: 1,
    name: "Pleadings Draft v1.docx",
    matterId: "m2",
    clientId: "c2",
    visibility: "matter",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
]

function loadDocuments(): Document[] {
  if (typeof window === "undefined") return [...defaultDocs]
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCUMENTS)
    if (!raw) {
      saveDocuments(defaultDocs)
      return [...defaultDocs]
    }
    const parsed = JSON.parse(raw) as Document[]
    return parsed.map((d) => ({
      ...d,
      createdAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
    }))
  } catch {
    return [...defaultDocs]
  }
}

function saveDocuments(docs: Document[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_DOCUMENTS, JSON.stringify(docs))
}

const defaultVersions: DocumentVersion[] = [
  {
    id: "ver-1-1",
    documentId: "doc-1",
    version: 1,
    fileName: "Due Diligence Checklist v1.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 45678,
    uploadedByUserId: "1",
    uploadedByName: "Sarah Johnson",
    uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    id: "ver-1-2",
    documentId: "doc-1",
    version: 2,
    fileName: "Due Diligence Checklist v2.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 52100,
    note: "Final draft",
    uploadedByUserId: "2",
    uploadedByName: "Michael Chen",
    uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "ver-2-1",
    documentId: "doc-2",
    version: 1,
    fileName: "Engagement Letter.pdf",
    mimeType: "application/pdf",
    sizeBytes: 128000,
    uploadedByUserId: "1",
    uploadedByName: "Sarah Johnson",
    uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "ver-3-1",
    documentId: "doc-3",
    version: 1,
    fileName: "Pleadings Draft v1.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 89000,
    uploadedByUserId: "4",
    uploadedByName: "David Kim",
    uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
]

function loadVersions(): DocumentVersion[] {
  if (typeof window === "undefined") return [...defaultVersions]
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VERSIONS)
    if (!raw) {
      saveVersions(defaultVersions)
      return [...defaultVersions]
    }
    const parsed = JSON.parse(raw) as DocumentVersion[]
    return parsed.map((v) => ({
      ...v,
      uploadedAt: new Date(v.uploadedAt),
    }))
  } catch {
    return [...defaultVersions]
  }
}

function saveVersions(versions: DocumentVersion[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_VERSIONS, JSON.stringify(versions))
}

export function getFolders(): DocumentFolder[] {
  return loadFolders()
}

export function getFolderById(id: string): DocumentFolder | undefined {
  return loadFolders().find((f) => f.id === id)
}

export function getChildFolders(parentId: string | null): DocumentFolder[] {
  return loadFolders()
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getDocumentsByFolder(folderId: string): Document[] {
  return loadDocuments()
    .filter((d) => d.folderId === folderId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getDocumentsByMatter(matterId: string): Document[] {
  return loadDocuments()
    .filter((d) => d.matterId === matterId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getDocumentById(id: string): Document | undefined {
  const doc = loadDocuments().find((d) => d.id === id)
  if (!doc) return undefined
  const versions = loadVersions().filter((v) => v.documentId === id).sort((a, b) => b.version - a.version)
  return { ...doc, versions }
}

export function getVersions(documentId: string): DocumentVersion[] {
  return loadVersions()
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => b.version - a.version)
}

export function getLatestVersion(documentId: string): DocumentVersion | undefined {
  return getVersions(documentId)[0]
}

/** Mock full-text search: match name and version file names */
export function searchDocuments(query: string, filters?: { matterId?: string; folderId?: string }): Document[] {
  const q = query.toLowerCase().trim()
  let docs = loadDocuments()
  if (filters?.matterId) docs = docs.filter((d) => d.matterId === filters.matterId)
  if (filters?.folderId) docs = docs.filter((d) => d.folderId === filters.folderId)
  if (!q) return docs
  const versions = loadVersions()
  return docs.filter((d) => {
    const nameMatch = d.name.toLowerCase().includes(q)
    const versionMatch = versions.some(
      (v) => v.documentId === d.id && (v.fileName.toLowerCase().includes(q) || (v.note && v.note.toLowerCase().includes(q)))
    )
    return nameMatch || versionMatch
  })
}

function nextDocumentId(): string {
  const docs = loadDocuments()
  const max = docs.reduce((acc, d) => {
    const n = parseInt(d.id.replace(/\D/g, ""), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `doc-${max + 1}`
}

function nextVersionId(): string {
  const vers = loadVersions()
  const max = vers.reduce((acc, v) => {
    const n = parseInt(v.id.replace(/\D/g, ""), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `ver-${max + 1}`
}

export function uploadDocument(params: {
  folderId: string
  fileName: string
  sizeBytes: number
  mimeType: string
  uploadedByUserId: string
  uploadedByName: string
  note?: string
}): Document {
  const folder = getFolderById(params.folderId)
  let matterId: string | null = null
  let clientId: string | null = null
  if (folder?.kind === "matter" && folder.entityId) {
    matterId = folder.entityId
    const matter = getMatterById(folder.entityId)
    clientId = matter?.clientId ?? null
  } else if (folder?.kind === "client" && folder.entityId) {
    clientId = folder.entityId
  }

  const docId = nextDocumentId()
  const version: DocumentVersion = {
    id: nextVersionId(),
    documentId: docId,
    version: 1,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    note: params.note,
    uploadedByUserId: params.uploadedByUserId,
    uploadedByName: params.uploadedByName,
    uploadedAt: new Date(),
  }
  const doc: Document = {
    id: docId,
    folderId: params.folderId,
    currentVersion: 1,
    name: params.fileName,
    matterId,
    clientId,
    visibility: "matter",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const docs = loadDocuments()
  docs.push(doc)
  saveDocuments(docs)
  const vers = loadVersions()
  vers.push(version)
  saveVersions(vers)
  return doc
}

/** Add a new version to an existing document */
export function addDocumentVersion(
  documentId: string,
  params: {
    fileName: string
    sizeBytes: number
    mimeType: string
    uploadedByUserId: string
    uploadedByName: string
    note?: string
}
): Document | null {
  const docs = loadDocuments()
  const idx = docs.findIndex((d) => d.id === documentId)
  if (idx === -1) return null
  const doc = docs[idx]
  const nextVer = doc.currentVersion + 1
  const version: DocumentVersion = {
    id: nextVersionId(),
    documentId,
    version: nextVer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    note: params.note,
    uploadedByUserId: params.uploadedByUserId,
    uploadedByName: params.uploadedByName,
    uploadedAt: new Date(),
  }
  docs[idx] = { ...doc, currentVersion: nextVer, updatedAt: new Date() }
  saveDocuments(docs)
  const vers = loadVersions()
  vers.push(version)
  saveVersions(vers)
  return docs[idx]
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
