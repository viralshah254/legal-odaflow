export interface Matter {
  id: string
  title: string
  ref: string
  clientId: string
  clientName: string
  stage: "Intake" | "Active" | "Discovery" | "Negotiation" | "Closing" | "Closed"
  status: "Active" | "On Hold" | "Closed"
  ownerId: string
  ownerName: string
  teamId?: string
  teamName?: string
  nextDeadline?: Date
  risk: "Low" | "Medium" | "High" | "Critical"
  createdAt: Date
  updatedAt: Date
  invoicedAmount?: number
  collectedAmount?: number
  collaborators?: Array<{
    userId: string
    userName: string
    accessScope: "MATTER_ONLY" | "MATTER_CLIENT_DOCS" | "FULL_CASE_SUPPORT"
    grantedAt: Date
  }>
  watchers?: string[]
}

export const mockMatters: Matter[] = [
  {
    id: "m1",
    title: "Acme Corp - M&A Transaction",
    ref: "MAT-2024-001",
    clientId: "c1",
    clientName: "Acme Corporation",
    stage: "Negotiation",
    status: "Active",
    ownerId: "1",
    ownerName: "Sarah Johnson",
    teamId: "team-1",
    teamName: "Corporate Law",
    nextDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    risk: "Medium",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    invoicedAmount: 500000,
    collectedAmount: 300000,
    collaborators: [
      {
        userId: "4",
        userName: "David Kim",
        accessScope: "FULL_CASE_SUPPORT",
        grantedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
    ],
    watchers: ["1"],
  },
  {
    id: "m2",
    title: "Smith vs. Jones - Contract Dispute",
    ref: "MAT-2024-002",
    clientId: "c2",
    clientName: "Smith Industries",
    stage: "Discovery",
    status: "Active",
    ownerId: "4",
    ownerName: "David Kim",
    teamId: "team-2",
    teamName: "Litigation",
    nextDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    risk: "High",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    invoicedAmount: 250000,
    collectedAmount: 150000,
  },
  {
    id: "m3",
    title: "TechStart Inc - Series B Funding",
    ref: "MAT-2024-003",
    clientId: "c3",
    clientName: "TechStart Inc",
    stage: "Active",
    status: "Active",
    ownerId: "2",
    ownerName: "Michael Chen",
    teamId: "team-1",
    teamName: "Corporate Law",
    nextDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    risk: "Low",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    invoicedAmount: 300000,
    collectedAmount: 200000,
  },
  {
    id: "m4",
    title: "Estate Planning - Johnson Family Trust",
    ref: "MAT-2024-004",
    clientId: "c4",
    clientName: "Johnson Family",
    stage: "Closing",
    status: "Active",
    ownerId: "3",
    ownerName: "Emily Rodriguez",
    teamId: "team-1",
    teamName: "Corporate Law",
    nextDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    risk: "Critical",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    invoicedAmount: 75000,
    collectedAmount: 50000,
  },
  {
    id: "m5",
    title: "Employment Dispute - ABC Corp",
    ref: "MAT-2024-005",
    clientId: "c5",
    clientName: "ABC Corporation",
    stage: "Discovery",
    status: "On Hold",
    ownerId: "4",
    ownerName: "David Kim",
    teamId: "team-2",
    teamName: "Litigation",
    nextDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    risk: "Medium",
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    invoicedAmount: 120000,
    collectedAmount: 80000,
  },
]

export function getMatterById(id: string): Matter | undefined {
  return mockMatters.find((m) => m.id === id)
}

export function getMattersByOwner(ownerId: string): Matter[] {
  return mockMatters.filter((m) => m.ownerId === ownerId)
}

export function getMattersByTeam(teamId: string): Matter[] {
  return mockMatters.filter((m) => m.teamId === teamId)
}

export function getMattersAtRisk(): Matter[] {
  return mockMatters.filter((m) => m.risk === "Critical" || m.risk === "High")
}

