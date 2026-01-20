// Initialize KYC for existing mock clients
import { initializeKycForClient } from "./kyc"
import { mockClients } from "./clients"

// Initialize KYC checklists for all existing clients
export function initializeAllKyc() {
  mockClients.forEach((client) => {
    if (!getKycChecklist(client.id)) {
      initializeKycForClient(client.id, client.type)
    }
  })
}

import { getKycChecklist } from "./kyc"

// Call on module load
if (typeof window !== "undefined") {
  initializeAllKyc()
}

