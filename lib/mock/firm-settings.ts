export interface FirmSettings {
  firmName: string
  industry: string
  location: string
  description?: string
}

let firmSettings: FirmSettings = {
  firmName: "Legal by OdaFlow",
  industry: "Legal Services",
  location: "Nairobi, Kenya",
  description: "A world-class legal CRM for modern law firms.",
}

export function getFirmSettings(): FirmSettings {
  return { ...firmSettings }
}

export function updateFirmSettings(updates: Partial<FirmSettings>): FirmSettings {
  firmSettings = { ...firmSettings, ...updates }
  // In a real app, this would save to localStorage or backend
  if (typeof window !== "undefined") {
    localStorage.setItem("firm-settings", JSON.stringify(firmSettings))
  }
  return { ...firmSettings }
}

// Load from localStorage on initialization
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("firm-settings")
  if (saved) {
    try {
      firmSettings = { ...firmSettings, ...JSON.parse(saved) }
    } catch (e) {
      // Invalid JSON, use defaults
    }
  }
}




