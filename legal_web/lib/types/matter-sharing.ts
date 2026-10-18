export type MatterAccessLevel = "READ_ONLY" | "WRITE" | "OWNER"

export interface MatterShare {
  id: string
  matterId: string
  userId: string
  userName: string
  accessLevel: MatterAccessLevel
  sharedBy: string
  sharedByName: string
  sharedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface Matter {
  id: string
  title: string
  clientId: string
  clientName: string
  ownerId: string
  ownerName: string
  status: string
  type: string
  risk?: "Critical" | "High" | "Medium" | "Low"
  shares?: MatterShare[]
}




