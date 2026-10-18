/** Folder hierarchy: firm (root) → client → matter. */
export type FolderKind = "firm" | "client" | "matter"

export interface DocumentFolder {
  id: string
  name: string
  kind: FolderKind
  /** Parent folder id; null for root (firm) */
  parentId: string | null
  /** For kind=client, client id; for kind=matter, matter id */
  entityId: string | null
  /** Human-readable entity name for display */
  entityName?: string
  createdAt: Date
  updatedAt: Date
}

export type DocumentPermission = "view" | "edit" | "manage"

export interface DocumentVersion {
  id: string
  documentId: string
  version: number
  /** File name as stored (or original upload name) */
  fileName: string
  /** MIME type */
  mimeType: string
  sizeBytes: number
  /** Optional note for this version (e.g. "Final draft") */
  note?: string
  uploadedByUserId: string
  uploadedByName: string
  uploadedAt: Date
}

export interface Document {
  id: string
  folderId: string
  /** Current version number (1-based) */
  currentVersion: number
  /** Display name (can match latest version fileName) */
  name: string
  /** Matter id if folder is matter-scoped; for search/linking */
  matterId: string | null
  clientId: string | null
  /** Who can view: user ids or "team" placeholder */
  visibility: "folder" | "matter" | "firm"
  createdAt: Date
  updatedAt: Date
  /** Resolved from folder + versions */
  versions?: DocumentVersion[]
}
