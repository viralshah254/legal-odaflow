export type ClientType = "Individual" | "Company" | "NGO" | "Partnership" | "Other"

export interface Client {
  id: string
  name: string
  type: ClientType
  email?: string
  phone?: string
  address?: string
  country?: string
  createdAt: Date
  updatedAt: Date
  kycStatus: "INCOMPLETE" | "PENDING_VERIFICATION" | "VERIFIED" | "EXPIRED"
}

export const mockClients: Client[] = [
  {
    id: "c1",
    name: "Acme Corporation",
    type: "Company",
    email: "contact@acme.com",
    phone: "+254 700 000 000",
    address: "Nairobi, Kenya",
    country: "Kenya",
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    kycStatus: "PENDING_VERIFICATION",
  },
  {
    id: "c2",
    name: "Smith Industries",
    type: "Company",
    email: "info@smith.com",
    phone: "+254 700 000 001",
    address: "Mombasa, Kenya",
    country: "Kenya",
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    kycStatus: "VERIFIED",
  },
  {
    id: "c3",
    name: "TechStart Inc",
    type: "Company",
    email: "hello@techstart.com",
    phone: "+254 700 000 002",
    address: "Nairobi, Kenya",
    country: "Kenya",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    kycStatus: "INCOMPLETE",
  },
  {
    id: "c4",
    name: "Johnson Family",
    type: "Individual",
    email: "johnson@email.com",
    phone: "+254 700 000 003",
    address: "Nairobi, Kenya",
    country: "Kenya",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    kycStatus: "VERIFIED",
  },
  {
    id: "c5",
    name: "ABC Corporation",
    type: "Company",
    email: "contact@abc.com",
    phone: "+254 700 000 004",
    address: "Kisumu, Kenya",
    country: "Kenya",
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    kycStatus: "EXPIRED",
  },
]

export function getClientById(id: string): Client | undefined {
  return mockClients.find((c) => id === id)
}

export function createClient(client: Omit<Client, "id" | "createdAt" | "updatedAt" | "kycStatus">): Client {
  const newClient: Client = {
    ...client,
    id: `c-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    kycStatus: "INCOMPLETE",
  }
  mockClients.push(newClient)
  return newClient
}

export function updateClient(id: string, updates: Partial<Client>): void {
  const client = mockClients.find((c) => c.id === id)
  if (client) {
    Object.assign(client, updates, { updatedAt: new Date() })
  }
}

