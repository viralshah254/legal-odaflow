import { KycChecklist, KycDocument, KycDocStatus, getRequiredKycDocsForClientType } from "@/lib/types/kyc"

export const mockKycChecklists: Map<string, KycChecklist> = new Map()

export function initializeKycForClient(clientId: string, clientType: string): KycChecklist {
  const requiredDocs = getRequiredKycDocsForClientType(clientType)
  const documents: KycDocument[] = requiredDocs.map((docType, index) => ({
    id: `kyc-${clientId}-${index}`,
    docType,
    status: "MISSING" as KycDocStatus,
  }))

  const checklist: KycChecklist = {
    clientId,
    documents,
    completed: false,
    lastUpdated: new Date(),
  }

  mockKycChecklists.set(clientId, checklist)
  return checklist
}

export function getKycChecklist(clientId: string): KycChecklist | undefined {
  return mockKycChecklists.get(clientId)
}

export function updateKycDocument(
  clientId: string,
  docId: string,
  updates: Partial<KycDocument>
): void {
  const checklist = mockKycChecklists.get(clientId)
  if (!checklist) return

  const docIndex = checklist.documents.findIndex((d) => d.id === docId)
  if (docIndex === -1) return

  checklist.documents[docIndex] = {
    ...checklist.documents[docIndex],
    ...updates,
  }

  checklist.completed = checklist.documents.every(
    (d) => d.status === "VERIFIED" || d.status === "RECEIVED"
  )
  checklist.lastUpdated = new Date()

  mockKycChecklists.set(clientId, checklist)
}

export function getMissingKycDocs(): Array<{ clientId: string; clientName: string; docs: KycDocument[] }> {
  const missing: Array<{ clientId: string; clientName: string; docs: KycDocument[] }> = []
  
  mockKycChecklists.forEach((checklist, clientId) => {
    const missingDocs = checklist.documents.filter((d) => d.status === "MISSING")
    if (missingDocs.length > 0) {
      missing.push({
        clientId,
        clientName: `Client ${clientId}`, // Would be resolved from client data
        docs: missingDocs,
      })
    }
  })
  
  return missing
}

export function getExpiredKycDocs(): Array<{ clientId: string; clientName: string; docs: KycDocument[] }> {
  const expired: Array<{ clientId: string; clientName: string; docs: KycDocument[] }> = []
  const now = new Date()
  
  mockKycChecklists.forEach((checklist, clientId) => {
    const expiredDocs = checklist.documents.filter(
      (d) => d.status === "VERIFIED" && d.expiryDate && new Date(d.expiryDate) < now
    )
    if (expiredDocs.length > 0) {
      expired.push({
        clientId,
        clientName: `Client ${clientId}`,
        docs: expiredDocs,
      })
    }
  })
  
  return expired
}




