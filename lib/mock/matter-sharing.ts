import { MatterShare, MatterAccessLevel } from "@/lib/types/matter-sharing"
import { mockMatters } from "./matters"

// Mock matter shares - tracks who has access to which matters
const matterShares: MatterShare[] = [
  {
    id: "share-1",
    matterId: "m1",
    userId: "2",
    userName: "Michael Chen",
    accessLevel: "WRITE",
    sharedBy: "1",
    sharedByName: "Sarah Johnson",
    sharedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    id: "share-2",
    matterId: "m1",
    userId: "3",
    userName: "Emily Rodriguez",
    accessLevel: "READ_ONLY",
    sharedBy: "1",
    sharedByName: "Sarah Johnson",
    sharedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "share-3",
    matterId: "m2",
    userId: "5",
    userName: "Lisa Wang",
    accessLevel: "READ_ONLY",
    sharedBy: "4",
    sharedByName: "David Kim",
    sharedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
]

export function getMatterShares(matterId: string): MatterShare[] {
  return matterShares.filter((s) => s.matterId === matterId)
}

export function getUserMatterShares(userId: string): MatterShare[] {
  return matterShares.filter((s) => s.userId === userId)
}

export function shareMatter(
  matterId: string,
  userId: string,
  userName: string,
  accessLevel: MatterAccessLevel,
  sharedBy: string,
  sharedByName: string
): MatterShare {
  // Check if share already exists
  const existing = matterShares.find((s) => s.matterId === matterId && s.userId === userId)
  if (existing) {
    existing.accessLevel = accessLevel
    existing.updatedAt = new Date()
    return existing
  }

  const newShare: MatterShare = {
    id: `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    matterId,
    userId,
    userName,
    accessLevel,
    sharedBy,
    sharedByName,
    sharedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  matterShares.push(newShare)
  return newShare
}

export function removeMatterShare(shareId: string): boolean {
  const index = matterShares.findIndex((s) => s.id === shareId)
  if (index !== -1) {
    matterShares.splice(index, 1)
    return true
  }
  return false
}

export function updateMatterShareAccess(shareId: string, accessLevel: MatterAccessLevel): MatterShare | null {
  const share = matterShares.find((s) => s.id === shareId)
  if (share) {
    share.accessLevel = accessLevel
    share.updatedAt = new Date()
    return share
  }
  return null
}

export function getUserAccessibleMatters(userId: string): string[] {
  // Get matters user owns
  const ownedMatters = mockMatters.filter((m) => m.ownerId === userId).map((m) => m.id)

  // Get matters shared with user
  const sharedMatters = getUserMatterShares(userId).map((s) => s.matterId)

  return [...new Set([...ownedMatters, ...sharedMatters])]
}

export function hasMatterAccess(userId: string, matterId: string, requiredLevel: MatterAccessLevel = "READ_ONLY"): boolean {
  const matter = mockMatters.find((m) => m.id === matterId)
  if (!matter) return false

  // Owner has all access
  if (matter.ownerId === userId) return true

  const share = matterShares.find((s) => s.matterId === matterId && s.userId === userId)
  if (!share) return false

  // Check access level
  if (requiredLevel === "READ_ONLY") return true
  if (requiredLevel === "WRITE") return share.accessLevel === "WRITE" || share.accessLevel === "OWNER"
  if (requiredLevel === "OWNER") return share.accessLevel === "OWNER"

  return false
}

export function getMatterAccessLevel(userId: string, matterId: string): MatterAccessLevel | null {
  const matter = mockMatters.find((m) => m.id === matterId)
  if (!matter) return null

  if (matter.ownerId === userId) return "OWNER"

  const share = matterShares.find((s) => s.matterId === matterId && s.userId === userId)
  return share ? share.accessLevel : null
}




